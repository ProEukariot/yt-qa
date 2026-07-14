from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langchain.messages import HumanMessage
from utils.retrieval import RAG, RetrievalStrategyType, rag_stores
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



class PrepareUrlRequest(BaseModel):
    url: str
    strategy: RetrievalStrategyType = RetrievalStrategyType.NAIVE


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

    # Build a RAG store for this thread from the YouTube transcript
    rag = RAG(strategy=request.strategy)
    stats = rag.ingest_youtube(url)
    rag_stores[thread_id] = rag

    return {
        "message": "Video uploaded successfully",
        "thread_id": thread_id,
        "url": url,
        "strategy": request.strategy.value,
        "num_documents": stats["num_documents"],
    }


@app.post("/run/{thread_id}")
async def ask_question(thread_id: str, request: AskQuestionRequest):
    from agent import agent
    from utils.state import AgentState

    # Check if vector store exists for the thread_id
    if thread_id not in rag_stores:
        return {
            "error": f"No RAG store found for thread_id: {thread_id}. Please prepare the URL first.",
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
    if thread_id not in rag_stores:
        return {
            "error": f"No RAG store found for thread_id: {thread_id}. Please prepare the URL first.",
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
