from utils.state import AgentState
from langchain_openai import ChatOpenAI
from langchain.messages import SystemMessage
from main import vector_stores


def retrieve(state: AgentState):
    """
    Retrieve relevant documents from the vector store based on the user's question.
    """
    # Get the latest user message as the query
    messages = state["messages"]
    if not messages:
        return {"context": []}

    query = messages[-1].content
    thread_id = state["thread_id"]

    # Get vector store for this thread
    if not thread_id or thread_id not in vector_stores:
        print(f"No vector store found for thread_id: {thread_id}")
        return {"context": []}

    vector_store = vector_stores[thread_id]

    # Retrieve relevant documents using similarity search
    k = 4  # Number of documents to retrieve
    retrieved_docs = vector_store.similarity_search(query, k=k)

    # Extract page content from documents
    docs = [doc.page_content for doc in retrieved_docs]

    print(f"Retrieved {len(docs)} documents for query: '{query}'")
    print("-" * 50)
    if docs:
        print(f"First document preview: {docs[0][:200]}...")
    print("-" * 50)

    return {"context": docs}


def generate(state: AgentState):
    systemMessage = SystemMessage(
        f"You are helpful assistant. Use the context to provide the answer. If there is no information in the context, say you dont know. Context: {state['context']}"
    )
    model = ChatOpenAI(model="gpt-4o-mini")

    response = model.invoke([systemMessage] + state["messages"])

    return {"messages": [response]}
