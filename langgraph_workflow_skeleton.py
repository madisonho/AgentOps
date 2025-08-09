# langgraph_workflow_skeleton.py

# Import necessary libraries
from typing import Annotated
from typing_extensions import TypedDict
import os
import json
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_community.chat_models import AzureChatOpenAI
from langchain_core.tracers import ConsoleCallbackHandler
import logging
import time


from dotenv import load_dotenv
load_dotenv()


# Configure logging
logging.basicConfig(
    filename="workflow.log",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)


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
    "shortlisting": "You are skilled at shortlisting. Select the top 5 best vendors from the provided list based on the criteria mentioned in the user query. For example, if they care about eco-friendliness, look through the media information and make sure it does not have a bad climate score. Reject vendors with compliance violations, bad climate scores or bad reviews. If they have a hard budget, make sure the vendors do not cross that. When you reject a vendor, make sure you have an explanation. The return format should be the shortlisted vendors with their information, and then all the rejected vendors with reasons for rejection.",
    "sorting": "You are an analyst. Analyze the user's input query to understand how much the user values each criterion (like climate, budget, etc.). Come up with a weight for each criterion. Then calculate the total utility for each vendor weighted by the weights you assigned. Sort the shortlisted vendors based on the total utility score in descending order. Return vendors from best to worst. The return format should start with the 5 top vendors, along with their scores. Make sure to separately include the remaining vendors with their scores, along with the reasoning for how you chose the weights and the formula you used to calculate utility.",
    "user_reply": "You are a helpful assistant. Summarize the sorted vendor list for the user, along with vendor names and basic information. Share no more than 2 top vendors to the user."
}

# Update node functions to use system prompts

def vendor_search_node(state: State):
    start = time.perf_counter()
    logger.info("Running vendor_search_node with state: %s", state)
    # Load synthetic vendor data
    with open("synthetic_vendor_data.json", "r") as f:
        vendor_data = json.load(f)
    logger.info("Loaded vendor data: %s", vendor_data)
    elapsed = time.perf_counter() - start
    logger.info("vendor_search_node latency: %.4f seconds", elapsed)
    num_vendors = len(vendor_data)
    discovery_efficiency = num_vendors / elapsed if elapsed > 0 else 0
    logger.info("vendor_search_node discovery efficiency: %.4f vendors/sec", discovery_efficiency)
    # Pass vendor data as a system message (stringified JSON)
    return {"messages": [{"role": "system", "content": json.dumps(vendor_data)}]}

def shortlisting_node(state: State):
    start = time.perf_counter()
    logger.info("Running shortlisting_node with state: %s", state)
    system_prompt = SYSTEM_PROMPTS["shortlisting"]
    user_message = state["messages"][-1].content
    result = llm.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ])
    logger.info("Shortlisting result: %s", result)
    elapsed = time.perf_counter() - start
    logger.info("shortlisting_node latency: %.4f seconds", elapsed)
    return {"messages": [result]}

def sorting_node(state: State):
    start = time.perf_counter()
    logger.info("Running sorting_node with state: %s", state)
    system_prompt = SYSTEM_PROMPTS["sorting"]
    user_message = state["messages"][-1].content
    result = llm.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ])
    logger.info("Sorting result: %s", result)
    elapsed = time.perf_counter() - start
    logger.info("sorting_node latency: %.4f seconds", elapsed)
    return {"messages": [result]}

def user_reply_node(state: State):
    start = time.perf_counter()
    logger.info("Running user_reply_node with state: %s", state)
    system_prompt = SYSTEM_PROMPTS["user_reply"]
    user_message = state["messages"][-1].content
    result = llm.invoke([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ])
    logger.info("User reply result: %s", result)
    elapsed = time.perf_counter() - start
    logger.info("user_reply_node latency: %.4f seconds", elapsed)
    return {"messages": [result]}

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

# Wrap graph invocation with tracing for granular logs
if __name__ == "__main__":
    workflow_start = time.perf_counter()
    user_query = input("Enter your vendor selection query: ")
    initial_state = {"messages": [{"role": "user", "content": user_query}]}
    handler = ConsoleCallbackHandler()
    logger.info("Starting workflow with initial state: %s", initial_state)
    result = graph.invoke(initial_state, config={"callbacks": [handler]})
    workflow_elapsed = time.perf_counter() - workflow_start
    logger.info("Workflow finished with result: %s", result)
    logger.info("Total workflow latency: %.4f seconds", workflow_elapsed)
    print("Workflow result:")
    print(result)
    logging.shutdown()

def rerun_from_node_with_weights(state, node_name, new_weights):
    """
    Update the weights in the state and rerun the workflow from the specified node.
    Args:
        state (dict): The current workflow state.
        node_name (str): The node to start rerunning from.
        new_weights (dict): The new weights to apply.
    Returns:
        dict: The result of the workflow from the specified node.
    """
    import copy
    updated_state = copy.deepcopy(state)
    updated_state["weights"] = new_weights
    logger.info(f"Rerunning workflow from node '{node_name}' with updated weights: {new_weights}")
    result = graph.invoke(updated_state, start_at=node_name)
    logger.info(f"Workflow result after rerun from '{node_name}': {result}")
    logging.shutdown()
    return result


if __name__ == "__main__":
    user_query = "Find paint vendors in Wyoming with rating above 4.5"
    initial_weights = {"price": 1, "rating": 2}
    initial_state = {"messages": [{"role": "user", "content": user_query}], "weights": initial_weights}
    result = graph.invoke(initial_state)
    print("Initial workflow result:")
    print(result)

    # Simulate modifying weights and rerunning from 'sorting'
    new_weights = {"price": 2, "rating": 1}
    rerun_result = rerun_from_node_with_weights(initial_state, "sorting", new_weights)
    print("Rerun result from 'sorting' with new weights:")
    print(rerun_result)
