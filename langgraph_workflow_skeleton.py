# langgraph_workflow_skeleton.py

# Import necessary libraries
from typing import Annotated
from typing_extensions import TypedDict
import os
import json
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain.chat_models import AzureChatOpenAI


from dotenv import load_dotenv
load_dotenv()


# Define the state schema
class State(TypedDict):
    messages: Annotated[list, add_messages]

# Initialize the graph builder
graph_builder = StateGraph(State)

# Initialize the LLM (OpenAI, Anthropic, etc.)
# Replace with your actual model and API key
llm = AzureChatOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    azure_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"],
    openai_api_version=os.environ["AZURE_OPENAI_API_VERSION"],
)


# Define system prompts for each node
SYSTEM_PROMPTS = {
    "shortlisting": "You are skilled at shortlisting. Select the top 5 best vendors from the provided list based on the criteria mentioned in the user query. For example, if they care about eco-friendliness, look through the media information and make sure it does not have any bad climate related press. If they have a hard budget, make sure the vendors do not cross that. Return the shortlisted vendors with all their information.",
    "sorting": "You are an analyst. Sort the shortlisted vendors based on the user's criteria in their initial request. Return vendors from best to worst.",
    "user_reply": "You are a helpful assistant. Summarize the sorted vendor list for the user, along with vendor names and basic information. Share no more than 2 top vendors to the user."
}

# Update node functions to use system prompts

def vendor_search_node(state: State):
    # Load synthetic vendor data
    with open("synthetic_vendor_data.json", "r") as f:
        vendor_data = json.load(f)
    # Pass vendor data as a system message (stringified JSON)
    return {"messages": [{"role": "system", "content": json.dumps(vendor_data)}]}

def shortlisting_node(state: State):
    system_prompt = SYSTEM_PROMPTS["shortlisting"]
    user_message = state["messages"][-1].content
    return {"messages": [llm.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ])]}

def sorting_node(state: State):
    system_prompt = SYSTEM_PROMPTS["sorting"]
    user_message = state["messages"][-1].content
    return {"messages": [llm.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ])]}

def user_reply_node(state: State):
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

# Example: Run the chatbot (simple loop)
def stream_graph_updates(user_input: str):
    for event in graph.stream({"messages": [{"role": "user", "content": user_input}]}):
        for value in event.values():
            print("Assistant:", value["messages"][-1].content)

if __name__ == "__main__":
    user_query = input("Enter your vendor selection query: ")
    initial_state = {"messages": [{"role": "user", "content": user_query}]}
    result = graph.invoke(initial_state)
    print("Workflow result:")
    print(result)
