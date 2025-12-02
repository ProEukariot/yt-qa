from typing import TypedDict, Annotated
from langchain.messages import AnyMessage
import operator

class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    context: list[str]
    thread_id: str
