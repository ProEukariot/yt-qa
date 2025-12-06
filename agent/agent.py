from utils.nodes import tool_node, retrieve, generate
from langgraph.graph import StateGraph, START, END
from langchain.messages import HumanMessage
from utils.state import AgentState
from langgraph.checkpoint.memory import InMemorySaver
from dotenv import load_dotenv


load_dotenv()

checkpointer = InMemorySaver()

workflow = StateGraph(AgentState)

workflow.add_node("tools", tool_node)
workflow.add_node("retrieve", retrieve)
workflow.add_node("generate", generate)

workflow.add_edge(START, "retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("tools", "generate")


def router(state: AgentState):
    last_message = state["messages"][-1]

    print("last_message", last_message)

    # Check if the last message has tool calls (only AI messages have tool_calls)
    tool_calls = getattr(last_message, "tool_calls", [])
    if tool_calls:
        return "tools"
    else:
        return END


workflow.add_conditional_edges("generate", router)

agent = workflow.compile(checkpointer=checkpointer)


def main():
    thread_id = 1234  # use unique thread_id per agent conversation/interaction

    initState: AgentState = {
        "messages": [HumanMessage("How are you?")],
        "context": [],
        "thread_id": "",
    }

    response = agent.invoke(initState, {"configurable": {"thread_id": thread_id}})
    print(response)


if __name__ == "__main__":
    main()
