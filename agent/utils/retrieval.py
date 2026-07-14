from langchain_community.document_loaders import YoutubeLoader
from langchain_community.document_loaders.youtube import TranscriptFormat
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


class RAG:
    """Retrieval-Augmented Generation store for a single video transcript.

    Owns the embedding model, text splitting and the underlying vector store,
    exposing a small surface: ingest a video and query it.
    """

    def __init__(
        self,
        embedding_model: str = "qwen3-embedding:8b",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ):
        self.embeddings = OllamaEmbeddings(model=embedding_model)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        self.vector_store: InMemoryVectorStore | None = None

    def ingest_youtube(self, url: str, chunk_size_seconds: int = 120) -> dict:
        """Load a YouTube transcript, split it and build the vector store."""
        loader = YoutubeLoader.from_youtube_url(
            url,
            transcript_format=TranscriptFormat.CHUNKS,
            chunk_size_seconds=chunk_size_seconds,
        )
        docs = loader.load()
        splits = self.text_splitter.split_documents(docs)

        self.vector_store = InMemoryVectorStore.from_documents(
            documents=splits, embedding=self.embeddings
        )

        return {"num_documents": len(docs), "num_chunks": len(splits)}

    def query(self, query: str, k: int = 4) -> list[str]:
        """Return the page content of the top-k most similar chunks."""
        if self.vector_store is None:
            return []

        retrieved_docs = self.vector_store.similarity_search(query, k=k)
        return [doc.page_content for doc in retrieved_docs]


# Registry of RAG instances keyed by thread_id.
rag_stores: dict[str, RAG] = {}
