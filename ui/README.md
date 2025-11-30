# YouTube Q&A UI

A simple Next.js application that integrates with the YouTube Q&A FastAPI backend.

## Features

- Prepare YouTube videos for Q&A by processing transcripts
- Ask questions about video content using AI
- Clean, modern white-themed interface
- Real-time feedback and error handling

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure the API URL (optional):
   - The default API URL is `http://localhost:8000`
   - To change it, edit `.env.local` and update `NEXT_PUBLIC_API_URL`

3. Make sure the FastAPI backend is running:
```bash
cd ../agent
# Start your FastAPI server
uvicorn main:app --reload
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Step 1**: Enter a YouTube URL and click "Prepare Video"
   - The system will download and process the video transcript
   - Wait for confirmation that the video is ready

2. **Step 2**: Ask questions about the video
   - Type your question in the text area
   - Click "Ask Question" to get an AI-generated answer

## Backend CORS Setup

For the frontend to communicate with the FastAPI backend, you need to enable CORS. Add this to your `main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Tech Stack

- Next.js 15
- TypeScript
- Tailwind CSS
- React
