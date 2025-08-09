# langgraph_workflow_skeleton.py

# Import necessary libraries
from typing import Annotated
from typing_extensions import TypedDict
import os
import json
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_openai import ChatOpenAI


from dotenv import load_dotenv
load_dotenv()

from backend.flight_recorder.recorder import FlightRecorder, ModelWrapper, step


# Define the state schema
class State(TypedDict):
    messages: Annotated[list, add_messages]

# Initialize the graph builder
graph_builder = StateGraph(State)

# Initialize the LLM (OpenAI)
if os.getenv("OPENAI_API_KEY"):
    llm = ChatOpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0.2,
    )
else:
    # Fallback mock when no key is provided
    class _MockLLM:
        model_name = "mock-openai"
        def invoke(self, messages):
            user = next((m for m in reversed(messages) if m.get("role") == "user"), {"content": ""})
            content = user.get("content", "")
            reply = f"[MOCK RESPONSE] Processed: {content[:120]}"
            class _Msg:
                def __init__(self, c):
                    self.content = c
                    self.response_metadata = {"input_tokens": len(str(messages)), "output_tokens": len(reply)}
            return _Msg(reply)
    llm = _MockLLM()

RECORDER = FlightRecorder()
CURRENT_RUN_ID: str | None = None
_CURRENT_STEP_ID: str | None = None

def _get_current_step_id() -> str:
    return _CURRENT_STEP_ID or "unknown-step"


# Define system prompts for each node
SYSTEM_PROMPTS = {
    "shortlisting": "You are skilled at shortlisting. Select the top 5 best vendors from the provided list based on the criteria mentioned in the user query. For example, if they care about eco-friendliness, look through the media information and make sure it does not have any bad climate related press. If they have a hard budget, make sure the vendors do not cross that. Return the shortlisted vendors with all their information.",
    "sorting": "You are an analyst. Sort the shortlisted vendors based on the user's criteria in their initial request. Return vendors from best to worst.",
    "user_reply": "You are a helpful assistant. Summarize the sorted vendor list for the user, along with vendor names and basic information. Share no more than 2 top vendors to the user."
}

# Update node functions to use system prompts

def vendor_search_node(state: State):
    global _CURRENT_STEP_ID
    with step(RECORDER, CURRENT_RUN_ID, "vendor_search") as ctx:  # type: ignore[arg-type]
        _CURRENT_STEP_ID = ctx.step_id
        with open("synthetic_vendor_data.json", "r") as f:
            vendor_data = json.load(f)
        RECORDER.save_artifact(vendor_data, mime_type="application/json")
        return {"messages": [{"role": "system", "content": json.dumps(vendor_data)}]}

def shortlisting_node(state: State):
    global _CURRENT_STEP_ID
    with step(RECORDER, CURRENT_RUN_ID, "shortlisting") as ctx:  # type: ignore[arg-type]
        _CURRENT_STEP_ID = ctx.step_id
        system_prompt = SYSTEM_PROMPTS["shortlisting"]
        user_message = state["messages"][-1].content
        return {"messages": [llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ])]}

def sorting_node(state: State):
    global _CURRENT_STEP_ID
    with step(RECORDER, CURRENT_RUN_ID, "sorting") as ctx:  # type: ignore[arg-type]
        _CURRENT_STEP_ID = ctx.step_id
        system_prompt = SYSTEM_PROMPTS["sorting"]
        user_message = state["messages"][-1].content
        return {"messages": [llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ])]}

def user_reply_node(state: State):
    global _CURRENT_STEP_ID
    with step(RECORDER, CURRENT_RUN_ID, "user_reply") as ctx:  # type: ignore[arg-type]
        _CURRENT_STEP_ID = ctx.step_id
        system_prompt = SYSTEM_PROMPTS["user_reply"]
        user_message = state["messages"][-1].content
        return {"messages": [llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ])]}

# Initialize the graph with the updated node functions
graph_builder.add_node("vendor_search_node", vendor_search_node)
graph_builder.add_node("shortlisting", shortlisting_node)
graph_builder.add_node("sorting", sorting_node)
graph_builder.add_node("user_reply", user_reply_node)

# Conditional function for edge from START
def start_conditional(state: State):
    # If internal_recommendations.json exists, go to shortlisting
    if os.path.exists("internal_recommendations.json"):
        return "shortlisting"
    else:
        return "vendor_search_node"

graph_builder.add_conditional_edges(
    START,
    start_conditional
)

# Add entry and exit points
graph_builder.add_edge("vendor_search_node", "shortlisting")
graph_builder.add_edge(START, "shortlisting")
graph_builder.add_edge("user_reply", END)
graph_builder.add_edge("shortlisting", "sorting")
graph_builder.add_edge("sorting", "user_reply")

# Compile the graph
graph = graph_builder.compile()

def stream_graph_updates(user_input: str):
    for event in graph.stream({"messages": [{"role": "user", "content": user_input}]}):
        for value in event.values():
            print("Assistant:", value["messages"][-1].content)

def run_with_flight_recorder(user_query: str):
    global CURRENT_RUN_ID, _CURRENT_STEP_ID, llm
    CURRENT_RUN_ID = RECORDER.start_run({"source": "langgraph_skeleton"})
    wrapper = ModelWrapper(RECORDER, CURRENT_RUN_ID, _get_current_step_id)
    # Replace the global llm with the logging proxy so model.call events are recorded
    llm = wrapper.wrap(
        llm,
        provider="openai",
        model_name=os.environ.get("OPENAI_MODEL", getattr(llm, "model_name", "openai-model")),
    )
    try:
        initial_state = {"messages": [{"role": "user", "content": user_query}]}
        result = graph.invoke(initial_state)
        RECORDER.finish_run(CURRENT_RUN_ID, status="success")
        return result
    except Exception as e:
        RECORDER.finish_run(CURRENT_RUN_ID, status="error", error=str(e))
        raise

if __name__ == "__main__":
    query = input("Enter your vendor selection query: ")
    result = run_with_flight_recorder(query)
    print("Workflow result:")
    print(result)
