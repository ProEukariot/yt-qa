from utils.nodes import retrieve, generate
from langgraph.graph import StateGraph, START, END
from langchain.messages import HumanMessage
from utils.state import AgentState
from langgraph.checkpoint.memory import InMemorySaver
from dotenv import load_dotenv


load_dotenv()

checkpointer = InMemorySaver()

workflow = StateGraph(AgentState)

workflow.add_node("retrieve", retrieve)
workflow.add_node("generate", generate)

workflow.add_edge(START, "retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

agent = workflow.compile(checkpointer=checkpointer)


def main():
    thread_id = 1234

    initState: AgentState = {
        "messages": [HumanMessage("How are you?")],
        "context": [],
        "thread_id": ""
    }

    response = agent.invoke(initState, {"configurable": {"thread_id": thread_id}})
    print(response)


if __name__ == "__main__":
    main()
