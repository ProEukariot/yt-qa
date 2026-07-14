# YouTube Q&A App

A full-stack application for asking questions about the content of a YouTube video.
The backend loads a video's transcript, indexes it with a retrieval-augmented
generation (RAG) pipeline, and answers questions with a local LLM — with optional
web search behind a human-in-the-loop approval step.

## Project Structure

- `agent/` - Python FastAPI backend built on LangGraph
  - `agent.py` - the LangGraph workflow (`retrieve → generate → approval → tools`)
  - `main.py` - FastAPI app with streaming (SSE) endpoints
  - `utils/retrieval.py` - the `RAG` class and pluggable retrieval strategies
  - `utils/nodes.py` - graph nodes (retrieve, generate, approval)
  - `utils/tools.py` - the Tavily web-search tool
  - `eval/` - RAGAS evaluation harness comparing the retrieval strategies
- `ui/` - Next.js frontend application

## How It Works

1. A YouTube URL is uploaded for a `thread_id`; its transcript is loaded and
   indexed into an in-memory RAG store using the chosen retrieval strategy.
2. A question runs through the LangGraph agent: relevant transcript chunks are
   **retrieved**, an answer is **generated**, and if the model decides to call the
   web-search tool, execution is **interrupted for human approval** before the
   tool runs.
3. Responses (node progress, streamed tokens, approval requests, final answer)
   are streamed to the UI over Server-Sent Events.

### Retrieval Strategies

The strategy is selected per upload (`utils/retrieval.py`):

| Strategy          | Description                                              |
| ----------------- | ------------------------------------------------------- |
| `naive`           | Dense embedding similarity search                       |
| `bm25`            | Sparse keyword search                                   |
| `reranking`       | Dense candidates re-scored by Cohere rerank             |
| `multi_query`     | LLM rephrases the query into several variants           |
| `parent_document` | Match small child chunks, return their larger parents   |
| `ensemble`        | Reciprocal-rank fusion of dense + BM25                  |

## Prerequisites

- Python 3.10+
- Node.js 18+
- [Ollama](https://ollama.com/) running locally with the models used by the agent:
  ```bash
  ollama pull qwen3.5:9b
  ollama pull qwen3-embedding:8b
  ```

## Getting Started

### Backend (API)

```bash
cd agent
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env     # then fill in your keys
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

#### API Endpoints

| Method | Path                       | Description                                          |
| ------ | -------------------------- | ---------------------------------------------------- |
| `POST` | `/upload-video/{thread_id}` | Load a YouTube URL and index it (`strategy` optional) |
| `POST` | `/run/{thread_id}`          | Ask a question; streams the agent's response (SSE)   |
| `POST` | `/resume/{thread_id}`       | Approve/decline a pending tool call and continue     |

### Frontend (UI)

```bash
cd ui
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `agent/.env` and configure:

| Variable          | Used by                                    | Required                        |
| ----------------- | ------------------------------------------ | ------------------------------- |
| `TAVILY_API_KEY`  | Web-search tool                            | For web search                  |
| `COHERE_API_KEY`  | `reranking` retrieval strategy             | For the `reranking` strategy    |
| `OPENAI_API_KEY`  | RAGAS eval when using the OpenAI provider  | For OpenAI-based evaluation     |

The LLM and embedding models run locally via Ollama, so core Q&A needs no API key
(only the web-search and reranking features do).

## Evaluation

`agent/eval/eval.py` compares the retrieval strategies with
[RAGAS](https://docs.ragas.io/) — generating a synthetic test set from a video's
transcript and scoring each strategy on Faithfulness, Context Precision, and
Response Relevancy, alongside token usage/cost.

```bash
cd agent
python eval/eval.py --url "https://www.youtube.com/watch?v=..." --size 10
```

By default the answerer and judge use OpenAI (`OPENAI_API_KEY` required); pass
`--generation local --judge local` to run entirely on Ollama. Results are written
to `agent/eval/results.csv`.

## Features

- Ask questions about any YouTube video's transcript
- Local, private LLM + embeddings via Ollama (no per-query API cost)
- Six pluggable retrieval strategies
- Real-time streaming responses (Server-Sent Events)
- Web search integration (Tavily)
- Human-in-the-loop approval workflow for tool calls
- RAGAS-based evaluation harness for comparing retrieval strategies
