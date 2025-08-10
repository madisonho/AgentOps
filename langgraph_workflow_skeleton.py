# langgraph_workflow_skeleton.py

# Import necessary libraries
from typing import Annotated, Dict, Any, Optional
from typing_extensions import TypedDict
import os
import json
import uuid
import time
from datetime import datetime
from pathlib import Path
import glob
import logging
from typing import Dict, List, TypedDict, Optional, Literal, Any, cast, Type, Union
from datetime import datetime
import argparse
from json import JSONEncoder
from uuid import uuid4
from typing import Dict, Any, Optional

class VendorSelectionWorkflow:
    """Main workflow class for vendor selection process."""
    
    def __init__(self):
        """Initialize the workflow with default settings."""
        self.llm = MockAzureChatOpenAI()
    
    def create_workflow(self, recorder=None):
        """Create and configure the LangGraph workflow.
        
        Args:
            recorder: Optional recorder instance for tracking workflow execution
            
        Returns:
            Configured LangGraph workflow
        """
        # Create the graph
        workflow = StateGraph(State)
        
        # Add nodes
        workflow.add_node("vendor_search", vendor_search_node)
        workflow.add_node("shortlisting", shortlisting_node)
        workflow.add_node("sorting", sorting_node)
        workflow.add_node("user_reply", user_reply_node)
        
        # Define the edges
        workflow.add_edge(START, "vendor_search")
        workflow.add_edge("vendor_search", "shortlisting")
        workflow.add_edge("shortlisting", "sorting")
        workflow.add_edge("sorting", "user_reply")
        workflow.add_edge("user_reply", END)
        
        # Compile the graph
        return workflow.compile()

from dotenv import load_dotenv

class AIMessageEncoder(JSONEncoder):
    """Custom JSON encoder that handles AIMessage objects."""
    def default(self, obj: Any) -> Any:
        if hasattr(obj, 'dict') and callable(obj.dict):
            return obj.dict()
        elif hasattr(obj, 'dict') and not callable(obj.dict):
            return dict(obj.dict)
        elif hasattr(obj, '__dict__'):
            return {k: v for k, v in obj.__dict__.items() if not k.startswith('_')}
        return str(obj)

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.tracers import ConsoleCallbackHandler
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatGeneration, ChatResult

class MockChatGeneration(ChatGeneration):
    """Mock chat generation for testing."""
    text: str
    message: AIMessage
    generation_info: Dict = {}
    
    def __init__(self, text: str, **data: Any):
        # Initialize with required fields first
        data["text"] = text
        data["message"] = AIMessage(content=text)
        data["generation_info"] = {}
        super().__init__(**data)

class MockChatResult(ChatResult):
    """Mock chat result for testing."""
    text: str = ""
    
    def __init__(self, text: str, **data: Any):
        # Initialize with required fields first
        data["generations"] = [MockChatGeneration(text)]
        data["text"] = text
        super().__init__(**data)

class MockAzureChatOpenAI(BaseChatModel):
    """Mock AzureChatOpenAI for testing without actual API calls."""
    
    model_name: str = "gpt-4"
    deployment_name: str = "test-deployment"
    temperature: float = 0.7
    max_tokens: int = 500
    
    def _generate(
        self, messages: List[BaseMessage], stop: Optional[List[str]] = None, **kwargs: Any
    ) -> ChatResult:
        """Mock implementation of the generate method."""
        # Simple response based on the last user message
        last_message = messages[-1].content if messages else ""
        
        if "vendor" in last_message.lower() and "search" in last_message.lower():
            response = """Here are some relevant vendors:
            1. Eco Paints Inc. - Eco-friendly paints, 4.5/5 rating
            2. Green Coatings - Sustainable options, 4.3/5 rating
            3. Nature's Hue - All-natural ingredients, 4.7/5 rating"""
        elif "shortlist" in last_message.lower():
            response = """Top 3 vendors based on criteria:
            1. Nature's Hue - Best overall rating and eco-score
            2. Eco Paints Inc. - Good balance of price and quality
            3. Green Coatings - Most affordable option"""
        elif "sort" in last_message.lower():
            response = """Vendors sorted by eco-rating:
            1. Nature's Hue - 4.8/5 eco-rating
            2. Green Coatings - 4.6/5 eco-rating
            3. Eco Paints Inc. - 4.4/5 eco-rating"""
        else:
            response = """Here's a summary of the top eco-friendly paint vendors in California:
            - Nature's Hue: Best overall with 4.8/5 eco-rating
            - Green Coatings: Great value at 4.6/5
            - Eco Paints Inc.: Reliable choice at 4.4/5"""
            
        return MockChatResult(response)
    
    def _llm_type(self) -> str:
        return "mock_azure_chat_openai"

# Use the mock implementation for testing
AzureChatOpenAI = MockAzureChatOpenAI

# Import the Agent Flight Recorder
from afr.recorder import recorder

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)


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
    run_id: Optional[str] = None
    step_id: Optional[str] = None
    recorder: Optional[Any] = None  # Add recorder to the state

# Initialize the graph builder
graph_builder = StateGraph(State)

# Helper function to generate step IDs
def generate_step_id(prefix: str = "step") -> str:
    """Generate a unique step ID."""
    return f"{prefix}_{str(uuid.uuid4())[:8]}"

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

def vendor_search_node(state: State) -> State:
    """Search for vendors based on the user query."""
    import glob
    
    # Get the recorder from state
    recorder = state.get('recorder')
    if not recorder:
        logger.warning("No recorder found in state, skipping recording")
    
    # Generate a unique step ID for this node execution
    step_id = generate_step_id("vendor_search")
    
    # Start recording the step if recorder is available
    if recorder:
        recorder.start_step(step_id, "Vendor Search")
    start_time = time.perf_counter()
    
    try:
        logger.info("Running vendor_search_node with state: %s", state)
        
        # Find all vendor_data* files
        vendor_files = glob.glob("vendor_data*")
        all_vendor_data = []
        for file_path in vendor_files:
            with open(file_path, "r") as f:
                try:
                    data = json.load(f)
                except Exception:
                    data = json.loads(f.read())
                all_vendor_data.extend(data)
        
        logger.info("Loaded %d vendor records from %d files", len(all_vendor_data), len(vendor_files))
        
        # System prompt for LLM
        system_prompt = (
            "You are a compliance and vendor selection expert. "
            "Given the following vendor data and the user's query, identify all vendors relevant to the query. "
            "Return a longlist of relevant vendors with their details. "
            "Also, return the number of files (webpages) you have processed as 'files_processed'."
        )
        
        user_message = state["messages"][-1].content
        llm_input = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
            {"role": "system", "content": json.dumps(all_vendor_data, default=str)}
        ]
        
        # Record the model call
        call_id = f"call_{str(uuid.uuid4())[:8]}"
        recorder.record_model_call(
            step_id=step_id,
            call_id=call_id,
            model_name="gpt-4",  # Update with actual model name
            model_version="0613",  # Update with actual version
            model_provider="openai",  # Update with actual provider
            params={"temperature": 0.7, "max_tokens": 2000},
            prompt=json.dumps(llm_input, indent=2),
            output="",  # Will be updated after the call
            prompt_tokens=0,  # Will be updated after tokenization
            completion_tokens=0,  # Will be updated after tokenization
            latency_ms=0  # Will be updated after the call
        )
        
        # Make the actual LLM call
        call_start = time.perf_counter()
        result = llm.invoke(llm_input)
        call_duration = int((time.perf_counter() - call_start) * 1000)  # ms
        
        # Get the response content
        response_content = result.content if hasattr(result, 'content') else str(result)
        
        # In a real implementation, you would calculate actual token usage
        # For now, we'll use a simple approximation
        prompt_tokens = len(json.dumps(llm_input)) // 4  # Approximate
        completion_tokens = len(response_content) // 4  # Approximate
        
        # Update the model call with the actual output and token usage
        recorder.record_model_call(
            step_id=step_id,
            call_id=call_id,
            model_name="gpt-4",
            model_version="0613",
            model_provider="openai",
            params={"temperature": 0.7, "max_tokens": 2000},
            prompt=json.dumps(llm_input, indent=2),
            output=response_content,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=call_duration
        )
        
        # Log performance metrics
        elapsed = time.perf_counter() - start_time
        logger.info("vendor_search_node latency: %.4f seconds", elapsed)
        
        # Extract leads discovered from LLM result if possible
        leads_discovered = None
        if hasattr(result, 'content') and isinstance(result.content, str):
            import re
            match = re.search(r"leads discovered[\:\s]+(\d+)", result.content, re.IGNORECASE)
            if match:
                leads_discovered = int(match.group(1))
                logger.info("vendor_search_node leads discovered: %d", leads_discovered)
        
        # Convert result to a serializable format
        if hasattr(result, 'dict'):
            result_data = result.dict()
        else:
            result_data = {"content": str(result) if hasattr(result, 'content') else str(result)}
        
        # Create a serializable result dictionary
        result_dict = {
            "output": result_data,
            "leads_discovered": leads_discovered,
            "latency_seconds": elapsed,
            "files_processed": len(vendor_files)
        }
        
        # Finish recording the step if recorder is available
        if recorder:
            recorder.finish_step(step_id, "Vendor Search", result_dict)
        
        return result_dict
        
    except Exception as e:
        # Record the error and re-raise
        recorder.finish_step(step_id, "Vendor Search", {"error": str(e)})
        raise

def shortlisting_node(state: State) -> State:
    """Shortlist vendors based on the user query."""
    step_id = generate_step_id("shortlisting")
    recorder.start_step(step_id, "Vendor Shortlisting")
    start_time = time.perf_counter()
    
    try:
        logger.info("Running shortlisting_node with state: %s", state)
        
        system_prompt = SYSTEM_PROMPTS["shortlisting"]
        user_message = state["messages"][-1].content
        
        # Prepare the LLM input
        llm_input = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        # Record the model call
        call_id = f"call_{str(uuid.uuid4())[:8]}"
        recorder.record_model_call(
            step_id=step_id,
            call_id=call_id,
            model_name="gpt-4",  # Update with actual model name
            model_version="0613",  # Update with actual version
            model_provider="openai",  # Update with actual provider
            params={"temperature": 0.7, "max_tokens": 2000},
            prompt=json.dumps(llm_input, indent=2),
            output="",  # Will be updated after the call
            prompt_tokens=0,  # Will be updated after tokenization
            completion_tokens=0,  # Will be updated after tokenization
            latency_ms=0  # Will be updated after the call
        )
        
        # Make the actual LLM call
        call_start = time.perf_counter()
        result = llm.invoke(llm_input)
        call_duration = int((time.perf_counter() - call_start) * 1000)  # ms
        
        # Get the response content
        response_content = result.content if hasattr(result, 'content') else str(result)
        
        # Calculate token usage (approximate)
        prompt_tokens = len(json.dumps(llm_input)) // 4
        completion_tokens = len(response_content) // 4
        
        # Update the model call with the actual output and token usage
        recorder.record_model_call(
            step_id=step_id,
            call_id=call_id,
            model_name="gpt-4",
            model_version="0613",
            model_provider="openai",
            params={"temperature": 0.7, "max_tokens": 2000},
            prompt=json.dumps(llm_input, indent=2),
            output=response_content,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=call_duration
        )
        
        # Log performance metrics
        elapsed = time.perf_counter() - start_time
        logger.info("shortlisting_node latency: %.4f seconds", elapsed)
        
        # Create the result dictionary
        result_dict = {"messages": [result]}
        
        # Finish recording the step with the result
        recorder.finish_step(step_id, "Vendor Shortlisting", result_dict)
        
        return result_dict
        
    except Exception as e:
        # Record the error and re-raise
        recorder.finish_step(step_id, "Vendor Shortlisting", {"error": str(e)})
        raise

def sorting_node(state: State) -> State:
    """Sort vendors based on the user's criteria."""
    step_id = generate_step_id("sorting")
    recorder.start_step(step_id, "Vendor Sorting")
    start_time = time.perf_counter()
    
    try:
        logger.info("Running sorting_node with state: %s", state)
        
        system_prompt = SYSTEM_PROMPTS["sorting"]
        user_message = state["messages"][-1].content
        
        # Prepare the LLM input
        llm_input = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        # Record the model call
        call_id = f"call_{str(uuid.uuid4())[:8]}"
        recorder.record_model_call(
            step_id=step_id,
            call_id=call_id,
            model_name="gpt-4",  # Update with actual model name
            model_version="0613",  # Update with actual version
            model_provider="openai",  # Update with actual provider
            params={"temperature": 0.7, "max_tokens": 2000},
            prompt=json.dumps(llm_input, indent=2),
            output="",  # Will be updated after the call
            prompt_tokens=0,  # Will be updated after tokenization
            completion_tokens=0,  # Will be updated after tokenization
            latency_ms=0  # Will be updated after the call
        )
        
        # Make the actual LLM call
        call_start = time.perf_counter()
        result = llm.invoke(llm_input)
        call_duration = int((time.perf_counter() - call_start) * 1000)  # ms
        
        # Get the response content
        response_content = result.content if hasattr(result, 'content') else str(result)
        
        # Calculate token usage (approximate)
        prompt_tokens = len(json.dumps(llm_input)) // 4
        completion_tokens = len(response_content) // 4
        
        # Update the model call with the actual output and token usage
        recorder.record_model_call(
            step_id=step_id,
            call_id=call_id,
            model_name="gpt-4",
            model_version="0613",
            model_provider="openai",
            params={"temperature": 0.7, "max_tokens": 2000},
            prompt=json.dumps(llm_input, indent=2),
            output=response_content,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=call_duration
        )
        
        # Log performance metrics
        elapsed = time.perf_counter() - start_time
        logger.info("sorting_node latency: %.4f seconds", elapsed)
        
        # Create the result dictionary
        result_dict = {"messages": [result]}
        
        # Finish recording the step with the result
        recorder.finish_step(step_id, "Vendor Sorting", result_dict)
        
        return result_dict
        
    except Exception as e:
        # Record the error and re-raise
        recorder.finish_step(step_id, "Vendor Sorting", {"error": str(e)})
        raise

def user_reply_node(state: State) -> State:
    """Generate a user-friendly reply with the sorted vendor list."""
    step_id = generate_step_id("user_reply")
    recorder.start_step(step_id, "Generate User Reply")
    start_time = time.perf_counter()
    
    try:
        logger.info("Running user_reply_node with state: %s", state)
        
        system_prompt = SYSTEM_PROMPTS["user_reply"]
        user_message = state["messages"][-1].content
        
        # Prepare the LLM input
        llm_input = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        
        # Record the model call
        call_id = f"call_{str(uuid.uuid4())[:8]}"
        recorder.record_model_call(
            step_id=step_id,
            call_id=call_id,
            model_name="gpt-4",  # Update with actual model name
            model_version="0613",  # Update with actual version
            model_provider="openai",  # Update with actual provider
            params={"temperature": 0.7, "max_tokens": 1000},
            prompt=json.dumps(llm_input, indent=2),
            output="",  # Will be updated after the call
            prompt_tokens=0,  # Will be updated after tokenization
            completion_tokens=0,  # Will be updated after tokenization
            latency_ms=0  # Will be updated after the call
        )
        
        # Make the actual LLM call
        call_start = time.perf_counter()
        result = llm.invoke(llm_input)
        call_duration = int((time.perf_counter() - call_start) * 1000)  # ms
        
        # Get the response content
        response_content = result.content if hasattr(result, 'content') else str(result)
        
        # Calculate token usage (approximate)
        prompt_tokens = len(json.dumps(llm_input)) // 4
        completion_tokens = len(response_content) // 4
        
        # Update the model call with the actual output and token usage
        recorder.record_model_call(
            step_id=step_id,
            call_id=call_id,
            model_name="gpt-4",
            model_version="0613",
            model_provider="openai",
            params={"temperature": 0.7, "max_tokens": 1000},
            prompt=json.dumps(llm_input, indent=2),
            output=response_content,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=call_duration
        )
        
        # Log performance metrics
        elapsed = time.perf_counter() - start_time
        logger.info("user_reply_node latency: %.4f seconds", elapsed)
        
        # Create the result dictionary
        result_dict = {"messages": [result]}
        
        # Finish recording the step with the result
        recorder.finish_step(step_id, "Generate User Reply", result_dict)
        
        return result_dict
        
    except Exception as e:
        # Record the error and re-raise
        recorder.finish_step(step_id, "Generate User Reply", {"error": str(e)})
        raise

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
graph_builder.add_edge(START, "vendor_search_node")
graph_builder.add_edge("user_reply", END)
graph_builder.add_edge("shortlisting", "sorting")
graph_builder.add_edge("sorting", "user_reply")

# Compile the graph
graph = graph_builder.compile()

# Example: Run the chatbot (simple loop)
def stream_graph_updates(user_input: str):
    """Run the workflow with the given user input and stream the updates."""
    # Start a new run
    run_id = recorder.start_run(
        agent="vendor_selection_workflow",
        labels={"environment": "development", "version": "1.0.0"}
    )
    
    try:
        # Initialize the state with the user input
        state = {
            "messages": [{"role": "user", "content": user_input}],
            "run_id": run_id
        }
        
        # Stream the graph updates
        for event in graph.stream(state):
            for value in event.values():
                print("Assistant:", value["messages"][-1].content)
                
        # Finish the run successfully
        recorder.finish_run(ok=True)
        
    except Exception as e:
        # Record the error and re-raise
        recorder.finish_run(ok=False, error=str(e))
        raise

# Main entry point for the workflow
if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Run the vendor selection workflow")
    parser.add_argument("--query", type=str, help="The user query to process")
    parser.add_argument("--record", action="store_true", help="Enable recording of the workflow execution")
    args = parser.parse_args()
    
    # Initialize the workflow
    workflow = VendorSelectionWorkflow()
    
    # Run the workflow with the provided query or a default one
    query = args.query or "Find eco-friendly paint vendors in California with rating above 4.0"
    
    # Initialize the recorder if recording is enabled
    recorder = None
    run_id = None
    if args.record:
        from afr.recorder import Recorder
        recorder = Recorder(runs_dir="runs")
        # Start a new run before executing the workflow
        recorder.start_run(
            agent="vendor_selection_workflow",
            labels={"workflow_name": "Vendor Selection Workflow", "query": query}
        )
        run_id = recorder.run_id
        print(f"Workflow execution recorded. Run ID: {run_id}")
    
    try:
        # Initialize the state with the recorder
        initial_state = {
            "messages": [{"role": "user", "content": query}],
            "run_id": run_id,
            "recorder": recorder  # Include the recorder in the state
        }
        
        # Create the graph (passing the recorder is optional now since it's in the state)
        graph = workflow.create_workflow()
        
        # Run the graph
        result = graph.invoke(initial_state)
        
        # Run the workflow
        workflow_start = time.perf_counter()
        handler = ConsoleCallbackHandler()
        logger.info("Starting workflow with initial state: %s", initial_state)
        
        result = graph.invoke(
            initial_state, 
            config={"callbacks": [handler]}
        )
        
        workflow_elapsed = time.perf_counter() - workflow_start
        logger.info("Workflow finished with result: %s", result)
        logger.info("Total workflow latency: %.4f seconds", workflow_elapsed)
        
        # Print the final result
        print("\nWorkflow result:")
        print("-" * 80)
        if result and "messages" in result and result["messages"]:
            print(result["messages"][-1].content)
        else:
            print("No result generated.")
        print("-" * 80)
        
        # Finish recording if enabled
        if args.record:
            recorder.finish_run(ok=True)
            print(f"\nWorkflow execution recorded. Run ID: {run_id}")
            print(f"Run directory: {recorder.run_dir}")
    
    except Exception as e:
        # Record the error and re-raise
        if args.record:
            recorder.finish_run(ok=False, error=str(e))
        logger.error("Workflow failed: %s", str(e), exc_info=True)
        print(f"Error: {str(e)}")
        raise
    
    finally:
        # Ensure logging is properly shut down
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
    # new_weights = {"price": 2, "rating": 1}
    # rerun_result = rerun_from_node_with_weights(initial_state, "sorting", new_weights)
    # print("Rerun result from 'sorting' with new weights:")
    # print(rerun_result)
