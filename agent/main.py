from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langchain_community.document_loaders import YoutubeLoader
from langchain_community.document_loaders.youtube import TranscriptFormat
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.messages import HumanMessage
from pydantic import BaseModel
import os
import json
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory vector stores (keyed by thread_id)
vector_stores = {}


class PrepareUrlRequest(BaseModel):
    url: str


class AskQuestionRequest(BaseModel):
    question: str


class ResumeRequest(BaseModel):
    approved: bool


@app.get("/")
def hello_world():
    return {"message": "Hello World"}


@app.post("/upload-video/{thread_id}")
def prepare_url(thread_id: str, request: PrepareUrlRequest):
    url = request.url

    # Load YouTube transcript
    loader = YoutubeLoader.from_youtube_url(
        url,
        transcript_format=TranscriptFormat.CHUNKS,
        chunk_size_seconds=120,
    )

    docs = loader.load()

    # Split documents into smaller chunks for better retrieval
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    splits = text_splitter.split_documents(docs)

    # Create embeddings and store in InMemoryVectorStore
    embeddings = OllamaEmbeddings(
        model="qwen3-embedding:8b",
    )

    vector_stores[thread_id] = InMemoryVectorStore.from_documents(
        documents=splits, embedding=embeddings
    )

    return {
        "message": "Video uploaded successfully",
        "thread_id": thread_id,
        "url": url,
        "num_documents": len(docs),
        "num_chunks": len(splits),
    }


@app.post("/run/{thread_id}")
async def ask_question(thread_id: str, request: AskQuestionRequest):
    from agent import agent
    from utils.state import AgentState

    # Check if vector store exists for the thread_id
    if thread_id not in vector_stores:
        return {
            "error": f"No vector store found for thread_id: {thread_id}. Please prepare the URL first.",
            "thread_id": thread_id,
        }

    async def event_stream():
        # Create initial state with the user's question
        init_state: AgentState = {
            "messages": [HumanMessage(request.question)],
            "context": [],
            "thread_id": thread_id,
        }

        config = {"configurable": {"thread_id": thread_id}}

        try:
            # Stream events from the agent
            async for event in agent.astream_events(init_state, config, version="v2"):  # type: ignore
                event_type = event.get("event")
                name = event.get("name", "")
                data = event.get("data", {})

                # Node start events
                if event_type == "on_chain_start" and name in ["retrieve", "generate", "approval", "tools"]:
                    yield f"data: {json.dumps({'type': 'node_start', 'node': name})}\n\n"

                # Node end events
                elif event_type == "on_chain_end" and name in ["retrieve", "generate", "approval", "tools"]:
                    output_data = {}

                    # Extract relevant data based on node
                    if name == "retrieve" and "output" in data:
                        context = data["output"].get("context", [])
                        output_data = {"context_count": len(context)}
                    elif name == "generate" and "output" in data:
                        messages = data["output"].get("messages", [])
                        if messages:
                            last_msg = messages[-1]
                            output_data = {"message": str(last_msg.content) if hasattr(last_msg, 'content') else str(last_msg)}

                    yield f"data: {json.dumps({'type': 'node_end', 'node': name, 'data': output_data})}\n\n"

                # LLM token streaming
                elif event_type == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"

            # Check if the agent is interrupted
            state_snapshot = agent.get_state(config)  # type: ignore

            if state_snapshot.next:
                # Agent is interrupted - extract interrupt data
                interrupt_data = None
                current_node = None

                if state_snapshot.tasks:
                    task = state_snapshot.tasks[0]
                    current_node = task.name
                    if task.interrupts:
                        interrupt_data = task.interrupts[0].value

                yield f"data: {json.dumps({'type': 'interrupted', 'thread_id': thread_id, 'question': request.question, 'current_node': current_node, 'interrupt_data': interrupt_data})}\n\n"
            else:
                # Execution completed
                final_state = state_snapshot.values
                final_messages = final_state.get("messages", [])
                answer = final_messages[-1].content if final_messages else "No response generated"
                context = final_state.get("context", [])

                yield f"data: {json.dumps({'type': 'completed', 'question': request.question, 'thread_id': thread_id, 'answer': answer, 'context': context})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/resume/{thread_id}")
async def resume_agent(thread_id: str, request: ResumeRequest):
    from agent import agent
    from langgraph.types import Command

    # Check if vector store exists for the thread_id
    if thread_id not in vector_stores:
        return {
            "error": f"No vector store found for thread_id: {thread_id}. Please prepare the URL first.",
            "thread_id": thread_id,
        }

    config = {"configurable": {"thread_id": thread_id}}

    # Check if there's an interrupted state to resume from
    state_snapshot = agent.get_state(config)  # type: ignore
    if not state_snapshot.next:
        return {
            "error": "No interrupted state found for this thread_id. Nothing to resume.",
            "thread_id": thread_id,
        }

    async def event_stream():
        try:
            # Resume the agent with the approval decision and stream events
            async for event in agent.astream_events(Command(resume=request.approved), config, version="v2"):  # type: ignore
                event_type = event.get("event")
                name = event.get("name", "")
                data = event.get("data", {})

                # Node start events
                if event_type == "on_chain_start" and name in ["retrieve", "generate", "approval", "tools"]:
                    yield f"data: {json.dumps({'type': 'node_start', 'node': name})}\n\n"

                # Node end events
                elif event_type == "on_chain_end" and name in ["retrieve", "generate", "approval", "tools"]:
                    output_data = {}

                    if name == "tools" and "output" in data:
                        output_data = {"tool_output": str(data["output"])}

                    yield f"data: {json.dumps({'type': 'node_end', 'node': name, 'data': output_data})}\n\n"

                # LLM token streaming
                elif event_type == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"

            # Get final state
            final_snapshot = agent.get_state(config)  # type: ignore
            final_state = final_snapshot.values
            final_messages = final_state.get("messages", [])
            answer = final_messages[-1].content if final_messages else "No response generated"
            context = final_state.get("context", [])

            yield f"data: {json.dumps({'type': 'completed', 'thread_id': thread_id, 'answer': answer, 'context': context})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
