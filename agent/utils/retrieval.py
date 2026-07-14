from abc import ABC, abstractmethod
from enum import Enum

from langchain_classic.retrievers import (
    ContextualCompressionRetriever,
    EnsembleRetriever,
    ParentDocumentRetriever,
)
from langchain_classic.retrievers.multi_query import MultiQueryRetriever
from langchain_cohere import CohereRerank
from langchain_community.document_loaders import YoutubeLoader
from langchain_community.document_loaders.youtube import TranscriptFormat
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_core.stores import InMemoryStore
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


class RetrievalStrategyType(str, Enum):
    """Supported retrieval strategies."""

    NAIVE = "naive"                      # dense embedding similarity search
    BM25 = "bm25"                        # sparse keyword search
    RERANKING = "reranking"              # dense candidates re-scored by Cohere rerank
    MULTI_QUERY = "multi_query"          # LLM rephrases the query into several variants
    PARENT_DOCUMENT = "parent_document"  # match small chunks, return their parents
    ENSEMBLE = "ensemble"                # reciprocal-rank fusion of dense + bm25


# ---------------------------------------------------------------------------
# Small builders shared by the strategies below.
# ---------------------------------------------------------------------------

def _make_splitter(chunk_size: int, chunk_overlap: int) -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )


def _split(docs: list[Document], chunk_size: int, chunk_overlap: int) -> list[Document]:
    return _make_splitter(chunk_size, chunk_overlap).split_documents(docs)


def _vector_retriever(splits: list[Document], embeddings, k: int) -> BaseRetriever:
    store = InMemoryVectorStore.from_documents(documents=splits, embedding=embeddings)
    return store.as_retriever(search_kwargs={"k": k})


def _bm25_retriever(splits: list[Document], k: int) -> BM25Retriever:
    retriever = BM25Retriever.from_documents(splits)
    retriever.k = k
    return retriever


# ---------------------------------------------------------------------------
# Strategies. Every strategy indexes raw docs and exposes a single langchain
# retriever, so `retrieve` is the same everywhere.
# ---------------------------------------------------------------------------

class RetrievalStrategy(ABC):
    """A retrieval strategy owns how documents are indexed and queried.

    Concrete strategies build a langchain ``BaseRetriever`` in :meth:`index`;
    :meth:`retrieve` simply delegates to it.
    """

    def __init__(self):
        self.retriever: BaseRetriever | None = None

    @abstractmethod
    def index(self, docs: list[Document]) -> None:
        """Build the internal retriever from raw (unsplit) documents."""

    def retrieve(self, query: str) -> list[Document]:
        if self.retriever is None:
            return []
        return self.retriever.invoke(query)


class NaiveStrategy(RetrievalStrategy):
    """Dense retrieval: embed chunks into a vector store and do similarity search."""

    def __init__(self, embeddings, k: int = 4, chunk_size: int = 1000, chunk_overlap: int = 200):
        super().__init__()
        self.embeddings = embeddings
        self.k = k
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def index(self, docs: list[Document]) -> None:
        splits = _split(docs, self.chunk_size, self.chunk_overlap)
        self.retriever = _vector_retriever(splits, self.embeddings, self.k)


class BM25Strategy(RetrievalStrategy):
    """Sparse retrieval: keyword scoring over chunks with the BM25 algorithm."""

    def __init__(self, k: int = 4, chunk_size: int = 1000, chunk_overlap: int = 200):
        super().__init__()
        self.k = k
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def index(self, docs: list[Document]) -> None:
        splits = _split(docs, self.chunk_size, self.chunk_overlap)
        self.retriever = _bm25_retriever(splits, self.k)


class RerankingStrategy(RetrievalStrategy):
    """Fetch a wide set of dense candidates, then re-score them with Cohere rerank.

    Requires the ``COHERE_API_KEY`` environment variable.
    """

    def __init__(
        self,
        embeddings,
        k: int = 4,
        fetch_k: int = 20,
        cohere_model: str = "rerank-english-v3.0",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ):
        super().__init__()
        self.embeddings = embeddings
        self.k = k
        self.fetch_k = fetch_k
        self.cohere_model = cohere_model
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def index(self, docs: list[Document]) -> None:
        splits = _split(docs, self.chunk_size, self.chunk_overlap)
        base_retriever = _vector_retriever(splits, self.embeddings, self.fetch_k)
        compressor = CohereRerank(model=self.cohere_model, top_n=self.k)
        self.retriever = ContextualCompressionRetriever(
            base_compressor=compressor,
            base_retriever=base_retriever,
        )


class MultiQueryStrategy(RetrievalStrategy):
    """Have an LLM rephrase the query into several variants and union the results."""

    def __init__(
        self,
        embeddings,
        llm,
        k: int = 4,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ):
        super().__init__()
        self.embeddings = embeddings
        self.llm = llm
        self.k = k
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def index(self, docs: list[Document]) -> None:
        splits = _split(docs, self.chunk_size, self.chunk_overlap)
        base_retriever = _vector_retriever(splits, self.embeddings, self.k)
        # include_original guarantees results even if the LLM produces no usable
        # rephrasings (e.g. a reasoning model emitting only its thinking block).
        self.retriever = MultiQueryRetriever.from_llm(
            retriever=base_retriever,
            llm=self.llm,
            include_original=True,
        )


class ParentDocumentStrategy(RetrievalStrategy):
    """Match against small child chunks but return their larger parent chunks."""

    def __init__(
        self,
        embeddings,
        k: int = 4,
        parent_chunk_size: int = 2000,
        child_chunk_size: int = 400,
    ):
        super().__init__()
        self.embeddings = embeddings
        self.k = k
        self.parent_chunk_size = parent_chunk_size
        self.child_chunk_size = child_chunk_size

    def index(self, docs: list[Document]) -> None:
        retriever = ParentDocumentRetriever(
            vectorstore=InMemoryVectorStore(embedding=self.embeddings),
            docstore=InMemoryStore(),
            parent_splitter=_make_splitter(self.parent_chunk_size, 0),
            child_splitter=_make_splitter(self.child_chunk_size, 0),
            search_kwargs={"k": self.k},
        )
        # ParentDocumentRetriever splits internally, so it takes the raw docs.
        retriever.add_documents(docs)
        self.retriever = retriever


class EnsembleStrategy(RetrievalStrategy):
    """Combine dense and BM25 retrievers via reciprocal-rank fusion."""

    def __init__(
        self,
        embeddings,
        k: int = 4,
        weights: tuple[float, float] = (0.5, 0.5),
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ):
        super().__init__()
        self.embeddings = embeddings
        self.k = k
        self.weights = weights
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def index(self, docs: list[Document]) -> None:
        splits = _split(docs, self.chunk_size, self.chunk_overlap)
        dense = _vector_retriever(splits, self.embeddings, self.k)
        bm25 = _bm25_retriever(splits, self.k)
        self.retriever = EnsembleRetriever(retrievers=[dense, bm25], weights=list(self.weights))


def build_strategy(
    strategy: RetrievalStrategyType,
    *,
    embedding_model: str = "qwen3-embedding:8b",
    chat_model: str = "qwen3.5:9b",
    k: int = 4,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> RetrievalStrategy:
    """Construct the retrieval strategy for the given type.

    Embeddings / chat models are only created for the strategies that need them,
    so e.g. BM25 does not require a running embedding model.
    """
    if strategy is RetrievalStrategyType.BM25:
        return BM25Strategy(k=k, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    # Every remaining strategy relies on a dense component.
    embeddings = OllamaEmbeddings(model=embedding_model)

    if strategy is RetrievalStrategyType.NAIVE:
        return NaiveStrategy(embeddings, k=k, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    if strategy is RetrievalStrategyType.RERANKING:
        return RerankingStrategy(embeddings, k=k, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    if strategy is RetrievalStrategyType.MULTI_QUERY:
        return MultiQueryStrategy(
            embeddings,
            # Rephrasing is a simple transformation; disable reasoning so it stays
            # fast and returns clean, parseable query variants.
            ChatOllama(model=chat_model, reasoning=False),
            k=k,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    if strategy is RetrievalStrategyType.PARENT_DOCUMENT:
        return ParentDocumentStrategy(embeddings, k=k)

    if strategy is RetrievalStrategyType.ENSEMBLE:
        return EnsembleStrategy(embeddings, k=k, chunk_size=chunk_size, chunk_overlap=chunk_overlap)

    raise NotImplementedError(f"Retrieval strategy '{strategy.value}' is not implemented yet")


class RAG:
    """Retrieval-Augmented Generation store for a single video transcript.

    The retrieval behaviour is selected via ``strategy``; the query surface stays
    the same regardless of which strategy is used.
    """

    def __init__(
        self,
        strategy: RetrievalStrategyType | str = RetrievalStrategyType.NAIVE,
        *,
        embedding_model: str = "qwen3-embedding:8b",
        chat_model: str = "qwen3.5:9b",
        k: int = 4,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ):
        self.strategy_type = RetrievalStrategyType(strategy)
        self.strategy = build_strategy(
            self.strategy_type,
            embedding_model=embedding_model,
            chat_model=chat_model,
            k=k,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    def ingest_youtube(self, url: str, chunk_size_seconds: int = 120) -> dict:
        """Load a YouTube transcript and index it with the configured strategy."""
        loader = YoutubeLoader.from_youtube_url(
            url,
            transcript_format=TranscriptFormat.CHUNKS,
            chunk_size_seconds=chunk_size_seconds,
        )
        docs = loader.load()
        self.strategy.index(docs)

        return {"num_documents": len(docs)}

    def query(self, query: str) -> list[str]:
        """Return the page content of the most relevant chunks for the query."""
        return [doc.page_content for doc in self.strategy.retrieve(query)]


# Registry of RAG instances keyed by thread_id.
rag_stores: dict[str, RAG] = {}
