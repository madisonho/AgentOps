#!/usr/bin/env python3
"""Script to record a sample run of the workflow."""
import os
import sys
import json
import time
import uuid
from pathlib import Path
from datetime import datetime

# Add the project root to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from langgraph_workflow_skeleton import (
    State, vendor_search_node, shortlisting_node, 
    sorting_node, user_reply_node, graph
)
from afr.recorder import recorder

def generate_sample_run() -> str:
    """Generate a sample run and return the run directory."""
    # Generate a deterministic run ID based on the current time
    run_id = f"sample_{int(time.time())}"
    
    # Start the run
    recorder.start_run(
        agent="dummy_workflow",
        labels={
            "environment": "test",
            "workflow_type": "vendor_selection"
        }
    )
    
    try:
        # Create a sample input state
        initial_state = {
            "messages": [
                {
                    "role": "user",
                    "content": "Find me the top 3 most eco-friendly paint vendors in California with a rating above 4.0"
                }
            ]
        }
        
        # Simulate the workflow steps with recording
        recorder.start_step("vendor_search", "Vendor Search")
        vendor_result = vendor_search_node(initial_state)
        recorder.finish_step("vendor_search", "Vendor Search", vendor_result)
        
        recorder.start_step("shortlisting", "Vendor Shortlisting")
        shortlist_result = shortlisting_node(vendor_result)
        recorder.finish_step("shortlisting", "Vendor Shortlisting", shortlist_result)
        
        recorder.start_step("sorting", "Vendor Sorting")
        sort_result = sorting_node(shortlist_result)
        recorder.finish_step("sorting", "Vendor Sorting", sort_result)
        
        recorder.start_step("user_reply", "Generate User Reply")
        final_result = user_reply_node(sort_result)
        recorder.finish_step("user_reply", "Generate User Reply", final_result)
        
        # Finish the run successfully
        recorder.finish_run(ok=True)
        
        print(f"Sample run completed successfully. Run ID: {run_id}")
        print(f"Run directory: {recorder.run_dir}")
        
        return str(recorder.run_dir)
        
    except Exception as e:
        # Record the error and re-raise
        recorder.finish_run(ok=False, error=str(e))
        print(f"Error during sample run: {e}", file=sys.stderr)
        raise

def main():
    """Run the sample recording."""
    try:
        run_dir = generate_sample_run()
        
        # Print the first few events as a sample
        events_file = Path(run_dir) / "events.jsonl"
        print("\nFirst 8 events from events.jsonl:")
        print("-" * 80)
        
        with open(events_file, "r") as f:
            for i, line in enumerate(f):
                if i >= 8:
                    break
                event = json.loads(line)
                print(f"{event['type']} (ts={event['ts_ms']})")
                
        print("\nTo view all events, run:")
        print(f"cat {events_file}")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
