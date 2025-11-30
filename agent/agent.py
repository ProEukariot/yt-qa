from utils.nodes import retrieve, generate
from langgraph.graph import StateGraph, START, END
from langchain.messages import HumanMessage
from utils.state import AgentState
from dotenv import load_dotenv

load_dotenv()

workflow = StateGraph(AgentState)

workflow.add_node("retrieve", retrieve)
workflow.add_node("generate", generate)

workflow.add_edge(START, "retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

agent = workflow.compile()


def main():
    initState: AgentState = {
        "messages": [HumanMessage("How are you?")],
        "context": [],
        "video_id": ""
    }

    response = agent.invoke(initState)
    print(response)


if __name__ == "__main__":
    main()
