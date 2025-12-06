from fastapi import FastAPI
from langchain_community.document_loaders import YoutubeLoader
from langchain_community.document_loaders.youtube import TranscriptFormat
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_community.embeddings import JinaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.messages import HumanMessage
from pydantic import SecretStr, BaseModel
import os
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
    api_key = os.getenv("JINA_API_KEY")
    embeddings = JinaEmbeddings(
        jina_api_key=SecretStr(api_key) if api_key else None,
        model_name="jina-embeddings-v2-base-en",
        session=None,
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
def ask_question(thread_id: str, request: AskQuestionRequest):
    from agent import agent
    from utils.state import AgentState

    # Check if vector store exists for the thread_id
    if thread_id not in vector_stores:
        return {
            "error": f"No vector store found for thread_id: {thread_id}. Please prepare the URL first.",
            "thread_id": thread_id,
        }

    # Create initial state with the user's question
    init_state: AgentState = {
        "messages": [HumanMessage(request.question)],
        "context": [],
        "thread_id": thread_id,
    }

    config = {"configurable": {"thread_id": thread_id}}

    # Invoke the agent graph
    response = agent.invoke(init_state, config)  # type: ignore

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

        return {
            "status": "interrupted",
            "thread_id": thread_id,
            "question": request.question,
            "current_node": current_node,
            "interrupt_data": interrupt_data,
        }

    # Execution completed - extract the final answer
    final_messages = response.get("messages", [])
    answer = final_messages[-1].content if final_messages else "No response generated"

    return {
        "status": "completed",
        "question": request.question,
        "thread_id": thread_id,
        "answer": answer,
        "context": response.get("context", []),
    }


@app.post("/resume/{thread_id}")
def resume_agent(thread_id: str, request: ResumeRequest):
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

    # Resume the agent with the approval decision
    response = agent.invoke(Command(resume=request.approved), config)  # type: ignore

    # Execution completed (only single interrupt expected)
    final_messages = response.get("messages", [])
    answer = final_messages[-1].content if final_messages else "No response generated"

    return {
        "status": "completed",
        "thread_id": thread_id,
        "answer": answer,
        "context": response.get("context", []),
    }
