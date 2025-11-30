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

# Global in-memory vector stores (keyed by video_id)
vector_stores = {}


class PrepareUrlRequest(BaseModel):
    url: str


class AskQuestionRequest(BaseModel):
    question: str
    video_id: str


@app.get("/")
def hello_world():
    return {"message": "Hello World"}


@app.post("/prepare-url/{video_id}")
def prepare_url(video_id: str, request: PrepareUrlRequest):
    url = request.url

    print("*" * 50)
    print("URL____>>>>>>", url)
    print("*" * 50)

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

    vector_stores[video_id] = InMemoryVectorStore.from_documents(
        documents=splits, embedding=embeddings
    )

    return {
        "message": "URL prepared successfully",
        "video_id": video_id,
        "url": url,
        "num_documents": len(docs),
        "num_chunks": len(splits),
    }


@app.post("/ask")
def ask_question(request: AskQuestionRequest):
    from agent import agent
    from utils.state import AgentState

    # Check if vector store exists for the video_id
    if request.video_id not in vector_stores:
        return {
            "error": f"No vector store found for video_id: {request.video_id}. Please prepare the URL first.",
            "video_id": request.video_id
        }

    # Create initial state with the user's question
    init_state: AgentState = {
        "messages": [HumanMessage(request.question)],
        "context": [],
        "video_id": request.video_id
    }

    # Invoke the agent graph
    response = agent.invoke(init_state)

    # Extract the final answer from the messages
    final_messages = response.get("messages", [])
    answer = final_messages[-1].content if final_messages else "No response generated"

    return {
        "question": request.question,
        "video_id": request.video_id,
        "answer": answer,
        "context": response.get("context", [])
    }
