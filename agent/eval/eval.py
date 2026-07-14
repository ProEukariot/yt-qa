"""RAGAS evaluation comparing every retrieval strategy in ``utils.retrieval``.

Pipeline
--------
1. Load a YouTube transcript once into raw documents.
2. Generate a synthetic test set (question / reference answer / reference
   context) from those documents with RAGAS' ``TestsetGenerator``.
3. For every retrieval strategy: index the documents, and for each test
   question retrieve context and generate an answer, recording token usage.
4. Score every strategy with RAGAS metrics: Faithfulness, Context Precision
   and Response Relevancy, and report token counts / cost.

Everything runs against the local Ollama models, so there is no API cost; the
"token cost" column is a nominal figure derived from the price constants below
and is mainly useful for comparing how much context each strategy feeds the
generator.

Run from the ``agent`` directory::

    python eval/eval.py --url "https://www.youtube.com/watch?v=..." --size 10
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Compatibility shim. RAGAS 0.4.3 imports ``ChatVertexAI`` from
# ``langchain_community.chat_models.vertexai`` at module load time, but that
# path was removed in langchain-community v1. We register a stub module so the
# import succeeds; the Vertex integration is never used from this script.
# This MUST run before the first ``import ragas``.
# ---------------------------------------------------------------------------
import sys
import types


def _install_vertexai_shim() -> None:
    name = "langchain_community.chat_models.vertexai"
    if name in sys.modules:
        return
    try:  # if a real implementation exists, leave it alone
        __import__(name)
        return
    except Exception:
        pass
    stub = types.ModuleType(name)
    stub.ChatVertexAI = type("ChatVertexAI", (), {})  # type: ignore[attr-defined]
    sys.modules[name] = stub


_install_vertexai_shim()

# The classic ``ragas.metrics`` imports and the ``langchain-community`` sunset
# both emit DeprecationWarnings on every run. The classic API is stable and
# still the supported path here, so quiet the noise.
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from langchain_community.document_loaders import YoutubeLoader
from langchain_community.document_loaders.youtube import TranscriptFormat
from langchain_core.documents import Document
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from ragas import EvaluationDataset, evaluate
from ragas.dataset_schema import SingleTurnSample
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.llms import LangchainLLMWrapper
from ragas.metrics import (
    Faithfulness,
    LLMContextPrecisionWithReference,
    ResponseRelevancy,
)
from ragas.run_config import RunConfig
from ragas.testset import TestsetGenerator

# Make ``utils`` importable when running this file directly from anywhere.
AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR))

from utils.retrieval import RetrievalStrategyType, build_strategy  # noqa: E402

# ---------------------------------------------------------------------------
# Configuration (overridable via CLI flags).
# ---------------------------------------------------------------------------
DEFAULT_VIDEO_URL = "https://www.youtube.com/watch?v=aircAruvnKk"  # 3Blue1Brown: neural networks
DEFAULT_TESTSET_SIZE = 10

K = 4  # documents each strategy retrieves

# Retrieval strategies always embed with the local model (the vector store is
# part of the strategy under test); this is independent of the judge/generation
# provider chosen below.
RETRIEVAL_EMBEDDING_MODEL = "qwen3-embedding:8b"

# Model choices per provider. The generation model answers the questions (the
# thing being evaluated); the judge model is what RAGAS uses to score answers
# and to write the synthetic test set.
OLLAMA_GENERATION_MODEL = "qwen3.5:9b"
OLLAMA_JUDGE_MODEL = "qwen3.5:9b"
OLLAMA_JUDGE_EMBEDDING_MODEL = "qwen3-embedding:8b"

OPENAI_GENERATION_MODEL = "gpt-4o-mini"
OPENAI_JUDGE_MODEL = "gpt-4o-mini"
OPENAI_JUDGE_EMBEDDING_MODEL = "text-embedding-3-small"

# Token prices (USD per 1M tokens) as (input, output), keyed by generation
# model, so the token counts turn into a meaningful cost. Local models are free.
TOKEN_PRICES: dict[str, tuple[float, float]] = {
    "qwen3.5:9b": (0.0, 0.0),
    "gpt-4o": (2.5, 10.0),
    "gpt-4o-mini": (0.15, 0.6),
}

# Concurrency for the RAGAS judge phase. With an OpenAI judge this can be raised
# for a faster scoring pass; keep it modest if you switch the judge back to a
# local Ollama server, where many parallel requests cause timeouts.
RUN_CONFIG = RunConfig(timeout=600, max_workers=4, max_retries=3)

TESTSET_CACHE = Path(__file__).resolve().parent / "testset.json"
RESULTS_CSV = Path(__file__).resolve().parent / "results.csv"

GENERATION_SYSTEM_PROMPT = """You are a helpful assistant that answers questions about a video using ONLY the context below.
If the context does not contain the answer, say you don't know based on the video.

Video Context:
{context}"""


# ---------------------------------------------------------------------------
# Document loading.
# ---------------------------------------------------------------------------
def load_documents(url: str, chunk_size_seconds: int = 120) -> list[Document]:
    """Load a YouTube transcript as raw (unsplit) documents."""
    loader = YoutubeLoader.from_youtube_url(
        url,
        transcript_format=TranscriptFormat.CHUNKS,
        chunk_size_seconds=chunk_size_seconds,
    )
    docs = loader.load()
    if not docs:
        raise RuntimeError(f"No transcript could be loaded for {url!r}.")
    return docs


# ---------------------------------------------------------------------------
# Synthetic test set.
# ---------------------------------------------------------------------------
def build_testset(
    docs: list[Document],
    size: int,
    judge_llm: LangchainLLMWrapper,
    judge_embeddings: LangchainEmbeddingsWrapper,
    *,
    regenerate: bool = False,
) -> list[dict]:
    """Generate (or load from cache) a synthetic test set.

    Returns a list of ``{user_input, reference, reference_contexts}`` dicts.
    """
    if TESTSET_CACHE.exists() and not regenerate:
        print(f"Loading cached test set from {TESTSET_CACHE}")
        return json.loads(TESTSET_CACHE.read_text())

    print(f"Generating a synthetic test set of {size} questions (this is slow on local models)...")
    generator = TestsetGenerator(llm=judge_llm, embedding_model=judge_embeddings)
    testset = generator.generate_with_langchain_docs(
        documents=docs,
        testset_size=size,
        run_config=RUN_CONFIG,
        with_debugging_logs=False,
    )

    data: list[dict] = []
    for sample in testset.samples:
        es = sample.eval_sample
        data.append(
            {
                "user_input": es.user_input,
                "reference": es.reference,
                "reference_contexts": list(es.reference_contexts or []),
            }
        )

    TESTSET_CACHE.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"Saved {len(data)} questions to {TESTSET_CACHE}")
    return data


# ---------------------------------------------------------------------------
# Answer generation with token accounting.
# ---------------------------------------------------------------------------
@dataclass
class TokenStats:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    n: int = 0

    def add(self, usage: dict | None) -> None:
        if not usage:
            return
        self.prompt_tokens += usage.get("input_tokens", 0)
        self.completion_tokens += usage.get("output_tokens", 0)
        self.total_tokens += usage.get("total_tokens", 0)
        self.n += 1

    def averages(self, price_in_per_1m: float = 0.0, price_out_per_1m: float = 0.0) -> dict[str, float]:
        n = self.n or 1
        avg_in = self.prompt_tokens / n
        avg_out = self.completion_tokens / n
        avg_total = self.total_tokens / n
        cost = (
            self.prompt_tokens / 1e6 * price_in_per_1m
            + self.completion_tokens / 1e6 * price_out_per_1m
        )
        return {
            "avg_prompt_tokens": round(avg_in, 1),
            "avg_completion_tokens": round(avg_out, 1),
            "avg_total_tokens": round(avg_total, 1),
            "total_tokens": self.total_tokens,
            "est_cost_usd": round(cost, 6),
        }


def generate_answer(
    llm: BaseChatModel, question: str, contexts: list[str]
) -> tuple[str, dict | None]:
    """Answer ``question`` from ``contexts`` and return (answer, usage_metadata)."""
    system = SystemMessage(GENERATION_SYSTEM_PROMPT.format(context="\n\n".join(contexts)))
    response = llm.invoke([system, HumanMessage(question)])
    return response.content, getattr(response, "usage_metadata", None)


# ---------------------------------------------------------------------------
# Model factories. "generation" is the model being evaluated (answers the
# questions); "judge" is the model RAGAS uses to score and to write the test
# set. Either can run locally (Ollama) or on OpenAI.
# ---------------------------------------------------------------------------
def make_generation_llm(provider: str) -> BaseChatModel:
    if provider == "openai":
        return ChatOpenAI(model=OPENAI_GENERATION_MODEL, temperature=0)
    return ChatOllama(model=OLLAMA_GENERATION_MODEL, reasoning=False)


def generation_model_name(provider: str) -> str:
    return OPENAI_GENERATION_MODEL if provider == "openai" else OLLAMA_GENERATION_MODEL


def make_judge(
    provider: str,
) -> tuple[LangchainLLMWrapper, LangchainEmbeddingsWrapper]:
    if provider == "openai":
        llm = ChatOpenAI(model=OPENAI_JUDGE_MODEL, temperature=0)
        embeddings = OpenAIEmbeddings(model=OPENAI_JUDGE_EMBEDDING_MODEL)
    else:
        llm = ChatOllama(model=OLLAMA_JUDGE_MODEL, reasoning=False)
        embeddings = OllamaEmbeddings(model=OLLAMA_JUDGE_EMBEDDING_MODEL)
    return LangchainLLMWrapper(llm), LangchainEmbeddingsWrapper(embeddings)


# ---------------------------------------------------------------------------
# Per-strategy run.
# ---------------------------------------------------------------------------
def run_strategy(
    strategy_type: RetrievalStrategyType,
    docs: list[Document],
    testset: list[dict],
    gen_llm: BaseChatModel,
) -> tuple[EvaluationDataset, TokenStats]:
    """Index the docs, then retrieve + answer every test question."""
    # Retrieval always uses the local embedding model (and, for multi-query, the
    # local chat model); only the answerer and judge follow the chosen provider.
    strategy = build_strategy(
        strategy_type,
        embedding_model=RETRIEVAL_EMBEDDING_MODEL,
        chat_model=OLLAMA_GENERATION_MODEL,
        k=K,
    )
    strategy.index(docs)

    tokens = TokenStats()
    samples: list[SingleTurnSample] = []
    for i, item in enumerate(testset, start=1):
        question = item["user_input"]
        contexts = [d.page_content for d in strategy.retrieve(question)]
        answer, usage = generate_answer(gen_llm, question, contexts)
        tokens.add(usage)
        samples.append(
            SingleTurnSample(
                user_input=question,
                retrieved_contexts=contexts,
                response=answer,
                reference=item["reference"],
            )
        )
        print(f"  [{strategy_type.value}] {i}/{len(testset)} answered", flush=True)

    return EvaluationDataset(samples=samples), tokens


# ---------------------------------------------------------------------------
# Orchestration.
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Compare retrieval strategies with RAGAS.")
    parser.add_argument("--url", default=DEFAULT_VIDEO_URL, help="YouTube video URL to evaluate on.")
    parser.add_argument("--size", type=int, default=DEFAULT_TESTSET_SIZE, help="Number of synthetic questions.")
    parser.add_argument(
        "--strategies",
        nargs="*",
        default=[s.value for s in RetrievalStrategyType],
        help="Subset of strategies to run (default: all).",
    )
    parser.add_argument("--regenerate", action="store_true", help="Rebuild the synthetic test set, ignoring the cache.")
    parser.add_argument(
        "--generation",
        choices=["openai", "local"],
        default="openai",
        help="Provider for the model being evaluated (the answerer). Default: openai.",
    )
    parser.add_argument(
        "--judge",
        choices=["openai", "local"],
        default="openai",
        help="Provider for the RAGAS judge and synthetic test-set generator. Default: openai.",
    )
    args = parser.parse_args()

    load_dotenv(AGENT_DIR / ".env")

    if "openai" in (args.generation, args.judge) and not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError(
            "OPENAI_API_KEY is not set (add it to agent/.env). "
            "Use --generation local --judge local to run fully on Ollama."
        )

    gen_llm = make_generation_llm(args.generation)
    judge_llm, judge_embeddings = make_judge(args.judge)
    gen_model = generation_model_name(args.generation)
    price_in, price_out = TOKEN_PRICES.get(gen_model, (0.0, 0.0))
    print(f"Generation: {gen_model} ({args.generation}) | Judge: {args.judge}")

    print(f"Loading transcript: {args.url}")
    docs = load_documents(args.url)
    print(f"Loaded {len(docs)} documents.")

    testset = build_testset(docs, args.size, judge_llm, judge_embeddings, regenerate=args.regenerate)
    if not testset:
        raise RuntimeError("Test set is empty; cannot evaluate.")

    metrics = [
        Faithfulness(),
        LLMContextPrecisionWithReference(),
        ResponseRelevancy(),
    ]

    rows: list[dict] = []
    for name in args.strategies:
        strategy_type = RetrievalStrategyType(name)

        if strategy_type is RetrievalStrategyType.RERANKING and not os.getenv("COHERE_API_KEY"):
            print(f"Skipping '{name}': COHERE_API_KEY is not set.")
            continue

        print(f"\n=== Strategy: {name} ===")
        try:
            dataset, tokens = run_strategy(strategy_type, docs, testset, gen_llm)
            result = evaluate(
                dataset=dataset,
                metrics=metrics,
                llm=judge_llm,
                embeddings=judge_embeddings,
                run_config=RUN_CONFIG,
                raise_exceptions=False,
                show_progress=True,
            )
        except Exception as exc:  # keep going so one bad strategy doesn't kill the run
            print(f"Strategy '{name}' failed: {exc}")
            continue

        scores_df = result.to_pandas()
        row: dict = {"strategy": name}
        for metric in metrics:
            col = metric.name
            row[col] = round(scores_df[col].mean(), 4) if col in scores_df else float("nan")
        row.update(tokens.averages(price_in, price_out))
        rows.append(row)

    if not rows:
        print("\nNo strategies produced results.")
        return

    results = pd.DataFrame(rows).set_index("strategy")
    results.to_csv(RESULTS_CSV)

    print("\n" + "=" * 80)
    print("RETRIEVAL STRATEGY COMPARISON")
    print("=" * 80)
    print(results.to_string())
    print(f"\nSaved results to {RESULTS_CSV}")
    try:
        print("\nMarkdown:\n")
        print(results.reset_index().to_markdown(index=False))
    except ImportError:
        pass  # markdown table needs the optional `tabulate` package; the CSV/table above suffice


if __name__ == "__main__":
    main()
