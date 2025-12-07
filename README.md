# YouTube Q&A App

A full-stack application for asking questions about YouTube video content using AI.

## Project Structure

- `agent/` - Python FastAPI backend with LangChain agent
- `ui/` - Next.js frontend application

## Getting Started

### Backend (API)

```bash
cd agent
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

### Frontend (UI)

```bash
cd ui
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Environment Variables

Both `agent/` and `ui/` directories contain `.env.example` files. Copy these to `.env` and configure with your API keys and settings.

## Features

- Upload YouTube video URLs
- AI-powered Q&A on video transcripts
- Real-time streaming responses
- Web search integration
- Human-in-the-loop approval workflow