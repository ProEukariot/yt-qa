from utils.state import AgentState
from langchain_ollama import ChatOllama
from langchain.messages import SystemMessage, AIMessage, ToolMessage
from main import vector_stores
from langgraph.prebuilt import ToolNode
from utils.tools import tavily_search_tool
from typing import Literal
from langgraph.types import interrupt, Command
from langgraph.graph import END

toolkit = [tavily_search_tool]
tool_node = ToolNode(toolkit)

def approval(state: AgentState):
    """
    Human-in-the-loop approval node for tool calls.
    Interrupts execution and waits for user approval before proceeding.
    """
    last_message = state["messages"][-1]
    tool_calls = getattr(last_message, "tool_calls", [])

    # Format tool calls for display
    tool_info = [
        {
            "name": tc["name"],
            "args": tc["args"]
        } for tc in tool_calls
    ]

    # Interrupt and wait for human approval
    human_approval = interrupt({
        "question": "Do you want to execute these tool calls?",
        "tool_calls": tool_info
    })

    # Route based on approval
    if human_approval:
        return Command(goto="tools")
    else:
        # When declined, we need to add mock tool responses for each tool_call_id
        # to satisfy OpenAI's requirement that all tool calls have responses
        tool_responses = [
            ToolMessage(
                content="Tool execution was declined by the user.",
                tool_call_id=tc["id"]
            )
            for tc in tool_calls
        ]

        # Add a final message indicating tools were not executed
        decline_message = AIMessage(
            content="Tool execution was declined by the user. I'll answer based on the available context."
        )

        return Command(goto=END, update={"messages": tool_responses + [decline_message]})




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
        f"""You are a helpful assistant specialized in answering questions about a specific video.

Your role and guidelines:
1. ONLY answer questions that are relevant to the video content provided in the context below.
2. If the user asks about something mentioned in the video (like a product, person, concept, etc.) and seems interested in learning more, ask them if they would like you to search online for additional information.
3. If the question is completely irrelevant to the video and its context, politely inform the user that you can only help with questions about the video content.
4. Base your answers on the video context provided. If you need more information about something mentioned in the video, offer to search online.

Video Context: {state['context']}"""
    )
    model = ChatOllama(model="qwen3.5:9b")
    model = model.bind_tools(toolkit)

    response = model.invoke([systemMessage] + state["messages"])

    return {"messages": [response]}


