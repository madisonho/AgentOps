# Schema for Workflow Log Data Extraction
# This schema is designed for use with LLM structured output extraction

REGEX_SCHEMA = {
    "metrics": {
        "vendor_search_node": {
            "latency": "float",  # seconds
            "source_diversity": "int",  # number of unique files/sources
            "vendors_considered": "int"  # number of vendors considered
        },
        "shortlisting_node": {
            "latency": "float",  # seconds
            "leads_rejected": "int",  # number of vendors rejected
            "leads_shortlisted": "int"  # number of vendors shortlisted
        },
        "weighting_and_sorting_node": {
            "latency": "float"  # seconds
        },
        "output_node": {
            "latency": "float"  # seconds
        }
    },
    "summary": {
        "basic_information": {
            "user_query": "str",  # exact query text
            "number_of_nodes": "int",  # number of distinct nodes executed
            "end_to_end_runtime": "float",  # seconds
            "data_volume_processed": {
                "files": "int",  # number of files
                "records": "int"  # number of vendor records
            }
        }
    },
    "workflow_run_timestamp": "str"  # timestamp for each workflow execution
}

LLM_SCHEMA = {
    "metrics": {
        "weighting_and_sorting_node": {
            "constraints_identified": "int",  # number of criteria/weights
            "reasoning_for_constraints": "list[str]"  # reasoning for each constraint/weight
        }
    },
    "summary": {
        "results_analysis": {
            "results_selected": "list[str]",  # list of top vendors
            "results_rejected": "list[dict]"  # list of rejected vendors with reason
        },
        "compliance_analysis": {
            "vendors": "list[dict]"  # for each vendor: name, compliance violations, carbon score, transparency, pricing
        }
    }
}

import re
import sys
from langchain_core.prompts import PromptTemplate

LOG_FILE = "workflow.log"

def extract_regex_metrics(log_path):
    metrics = {
        "metrics": {
            "vendor_search_node": {},
            "shortlisting_node": {},
            "weighting_and_sorting_node": {},
            "output_node": {}
        },
        "summary": {
            "basic_information": {
                "user_query": None,
                "number_of_nodes": None,
                "end_to_end_runtime": None,
                "data_volume_processed": {"files": None, "records": None}
            }
        },
        "workflow_run_timestamp": None
    }
    with open(log_path, "r") as f:
        log = f.read()

    # Vendor Search Node
    vsn_latency = re.search(r"vendor_search_node latency: ([\d.]+) seconds", log)
    if vsn_latency:
        metrics["metrics"]["vendor_search_node"]["latency"] = float(vsn_latency.group(1))
    vsn_files = re.search(r"vendor_search_node files processed: (\d+)", log)
    if vsn_files:
        metrics["metrics"]["vendor_search_node"]["source_diversity"] = int(vsn_files.group(1))
    vsn_records = re.search(r"Loaded (\d+) vendor records", log)
    if vsn_records:
        metrics["metrics"]["vendor_search_node"]["vendors_considered"] = int(vsn_records.group(1))

    # Shortlisting Node
    sn_latency = re.search(r"shortlisting_node latency: ([\d.]+) seconds", log)
    if sn_latency:
        metrics["metrics"]["shortlisting_node"]["latency"] = float(sn_latency.group(1))
    sn_leads_rejected = re.findall(r"Reason for Rejection:", log)
    if sn_leads_rejected:
        metrics["metrics"]["shortlisting_node"]["leads_rejected"] = len(sn_leads_rejected)
    sn_leads_shortlisted = re.findall(r"Shortlisted Vendors", log)
    if sn_leads_shortlisted:
        # This is a rough count, you may want to improve this with more context
        metrics["metrics"]["shortlisting_node"]["leads_shortlisted"] = len(sn_leads_shortlisted)

    # Weighting and Sorting Node
    wsn_latency = re.search(r"sorting_node latency: ([\d.]+) seconds", log)
    if wsn_latency:
        metrics["metrics"]["weighting_and_sorting_node"]["latency"] = float(wsn_latency.group(1))

    # Output Node
    on_latency = re.search(r"user_reply_node latency: ([\d.]+) seconds", log)
    if on_latency:
        metrics["metrics"]["output_node"]["latency"] = float(on_latency.group(1))

    # Basic Information
    # Fix regex for user_query extraction
    user_query = re.search(r"initial state: \{'messages': \[\{'role': 'user', 'content': '([^']+)'\}\]\}", log)
    if user_query:
        metrics["summary"]["basic_information"]["user_query"] = user_query.group(1)
    nodes_executed = set(re.findall(r"Running (\w+_node)", log))
    metrics["summary"]["basic_information"]["number_of_nodes"] = len(nodes_executed)
    end_to_end = re.search(r"Total workflow latency: ([\d.]+) seconds", log)
    if end_to_end:
        metrics["summary"]["basic_information"]["end_to_end_runtime"] = float(end_to_end.group(1))
    files_processed = re.search(r"vendor_search_node files processed: (\d+)", log)
    if files_processed:
        metrics["summary"]["basic_information"]["data_volume_processed"]["files"] = int(files_processed.group(1))
    records_processed = re.search(r"Loaded (\d+) vendor records", log)
    if records_processed:
        metrics["summary"]["basic_information"]["data_volume_processed"]["records"] = int(records_processed.group(1))
    timestamp = re.search(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) INFO Starting workflow", log)
    if timestamp:
        metrics["workflow_run_timestamp"] = timestamp.group(1)

    return metrics

# LLM extraction code (to be used with with_structured_output)
def extract_llm_metrics(log_text, llm, prompt):
    # Use LangChain's with_structured_output for direct schema-based extraction
    # Concatenate prompt and log_text for LLM input
    input_text = prompt + "\n" + log_text
    result = llm.with_structured_output(LLM_SCHEMA).invoke(input_text)
    return result

def estimate_environmental_impact(total_latency, total_api_calls=4):
    # Example formula: impact = total_latency (seconds) * total_api_calls * 0.0005 (kg CO2)
    return total_latency * total_api_calls * 0.0005

def estimate_api_cost(total_api_calls=4, cost_per_call=0.002):
    # Example formula: cost = total_api_calls * cost_per_call
    return total_api_calls * cost_per_call

# Output final string

def format_final_output(regex_metrics, llm_metrics):
    # Combine regex_metrics and llm_metrics into the required output format
    output = []
    output.append("METRICS\n=======\n")
    # Vendor Search Node
    vsn = regex_metrics["metrics"].get("vendor_search_node", {})
    output.append(f"Vendor Search Node:\n- Latency: {vsn.get('latency', 'Not specified')} seconds\n- Source diversity: {vsn.get('source_diversity', 'Not specified')} sources\n- Number of vendors considered: {vsn.get('vendors_considered', 'Not specified')} vendors\n")
    # Shortlisting Node
    sn = regex_metrics["metrics"].get("shortlisting_node", {})
    output.append(f"Shortlisting Node:\n- Latency: {sn.get('latency', 'Not specified')} seconds\n- Number of leads rejected: {sn.get('leads_rejected', 'Not specified')} vendors\n- Number of leads shortlisted: {sn.get('leads_shortlisted', 'Not specified')} vendors\n")
    # Weighting and Sorting Node
    wsn = regex_metrics["metrics"].get("weighting_and_sorting_node", {})
    wsn_llm = llm_metrics.get("metrics", {}).get("weighting_and_sorting_node", {}) if llm_metrics else {}
    output.append(f"Weighting and Sorting Node:\n- Number of constraints identified: {wsn_llm.get('constraints_identified', 'Not specified')} criteria\n- Latency: {wsn.get('latency', 'Not specified')} seconds\n")
    # Output Node
    on = regex_metrics["metrics"].get("output_node", {})
    output.append(f"Output Node:\n- Latency: {on.get('latency', 'Not specified')} seconds\n")

    # Calculate total latency and API calls for environmental impact and cost
    total_latency = sum([
        vsn.get('latency', 0) or 0,
        sn.get('latency', 0) or 0,
        wsn.get('latency', 0) or 0,
        on.get('latency', 0) or 0
    ])
    total_api_calls = 4  # Assuming one API call per node
    env_impact = estimate_environmental_impact(total_latency, total_api_calls)
    api_cost = estimate_api_cost(total_api_calls)
    output.append(f"\nEstimated total environmental impact: {env_impact:.4f} kg CO2\nEstimated total API cost: ${api_cost:.4f}\n")

    output.append("\nSUMMARY\n=======\n")
    bi = regex_metrics["summary"].get("basic_information", {})
    output.append(f"Basic Information:\n- User queried: \"{bi.get('user_query', 'Not specified')}\"\n- Number of nodes in workflow: {bi.get('number_of_nodes', 'Not specified')} nodes\n- End-to-end runtime: {bi.get('end_to_end_runtime', 'Not specified')} seconds\n- Data volume processed: {bi.get('data_volume_processed', {}).get('files', 'Not specified')} files/{bi.get('data_volume_processed', {}).get('records', 'Not specified')} records\n")
    # Results Analysis
    ra = llm_metrics.get("summary", {}).get("results_analysis", {}) if llm_metrics else {}
    output.append(f"Results Analysis:\n- Results selected: {ra.get('results_selected', 'Not specified')}\n- Results rejected: {ra.get('results_rejected', 'Not specified')}\n")
    # Compliance Analysis
    ca = llm_metrics.get("summary", {}).get("compliance_analysis", {}) if llm_metrics else {}
    output.append(f"Compliance Analysis:\n{ca.get('vendors', 'Not specified')}\n")
    return "".join(output)

def extract_metrics(log_path):
    regex_metrics = extract_regex_metrics(log_path)
    # For now, llm_metrics will be empty as we're not doing LLM extraction yet
    llm_metrics = {}
    final_output = format_final_output(regex_metrics, llm_metrics)
    return final_output

if __name__ == "__main__":
    log_path = sys.argv[1] if len(sys.argv) > 1 else LOG_FILE
    with open(log_path, "r") as f:
        log_text = f.read()
    regex_metrics = extract_regex_metrics(log_path)

    # Define your extraction prompt here
    prompt = """# Workflow Log Data Extraction Prompt

You are a data extraction specialist. Extract the following metrics and summary information from the provided workflow log file. Be precise and only extract data that is explicitly present in the logs.

## METRICS TO EXTRACT

### Vendor Search Node
1. **Source diversity**: Number of unique data sources/files processed

### Weighting and Sorting Node
1. **Number of constraints identified**: Count the criteria/weights mentioned in sorting analysis
2. Reasoning for each constraint and weight

## SUMMARY TO EXTRACT

### Basic Information
- **User query**: Extract the original user query/input
- **Number of nodes in workflow**: Count distinct workflow nodes executed

### Results Analysis
- **Results selected**: List the final top vendors recommended
- **Results rejected**: List any 3 vendors who seemed promising, but were rejected for not meeting certain criteria. Explain the criteria in depth.

For all vendors chosen (top vendors and 3 rejected vendors), list the following information:
    - **Compliance violations**: Any mentioned violations (illegal_sourcing, etc.)
    - **Carbon footprint**: High/low carbon scores
    - **Supply chain transparency**: Transparent/Partial/Opaque
    - **Budget constraints**: Pricing per gallon

## EXTRACTION RULES

1. **Be precise**: Only extract data explicitly stated in logs
2. **Use exact values**: Don't round or estimate numbers
3. **Quote directly**: Use exact text for queries and vendor names
4. **Mark missing data**: Use "Not specified" if data isn't available
5. **Multiple runs**: If multiple workflow runs are present, extract data for each run separately
6. **Timestamp awareness**: Note which log entries belong to which workflow execution
"""
    llm = None  # Placeholder, replace with actual LLM instance

    llm_metrics = None
    if llm:
        llm_metrics = extract_llm_metrics(log_text, llm, prompt)

    # Output final string
    final_output = format_final_output(regex_metrics, llm_metrics)
    print(final_output)
