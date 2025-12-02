# YouTube Q&A UI

A Next.js application that integrates with the YouTube Q&A FastAPI backend.

## Features

- Multiple chat conversations with thread-based isolation
- Collapsible sidebar for managing chats
- Prepare YouTube videos for Q&A by processing transcripts
- Ask questions about video content using AI
- Real-time message history with timestamps
- Clean, modern interface with chat-style layout
- Persistent chat storage using localStorage
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

1. **Create a Chat**: Click "New Chat" in the sidebar to start a new conversation
   - Each chat is isolated with its own thread_id
   - Switch between chats using the sidebar

2. **Prepare a Video**: Enter a YouTube URL and click "Prepare Video"
   - The system will download and process the video transcript
   - Wait for confirmation that the video is ready
   - The chat will be associated with this video

3. **Ask Questions**: Type questions in the input at the bottom
   - View the conversation history above
   - Each message shows a timestamp
   - Messages are preserved when you switch between chats

4. **Manage Chats**:
   - Use the sidebar to view all your chats
   - Click on any chat to view its conversation
   - Collapse/expand the sidebar using the arrow button
   - Chats are saved automatically in your browser

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
