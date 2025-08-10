# Agent Flight Recorder (AFR)

The Agent Flight Recorder (AFR) is a system for tracking and replaying agent executions. It records events and artifacts during a run, enabling deterministic replay and analysis.

## Overview

AFR records:
- **Events**: Structured data about what happened during a run (e.g., steps started/finished, model calls)
- **Artifacts**: Files generated during a run (e.g., prompts, model outputs, intermediate results)

## Getting Started

### Installation

No installation is required beyond the standard Python dependencies. The AFR is included in your project.

### Basic Usage

1. **Initialize the Recorder**

   ```python
   from afr.recorder import recorder
   
   # Start a new run
   run_id = recorder.start_run(
       agent="my_agent",
       labels={"environment": "production", "version": "1.0.0"}
   )
   ```

2. **Record Steps**

   ```python
   # Start a step
   recorder.start_step("data_processing", "Process Input Data")
   
   # ... do work ...
   
   # Finish the step with output
   recorder.finish_step("data_processing", "Process Input Data", {"status": "success", "items_processed": 42})
   ```

3. **Record Model Calls**

   ```python
   output_ref = recorder.record_model_call(
       step_id="generate_response",
       call_id="call_123",
       model_name="gpt-4",
       model_version="0613",
       model_provider="openai",
       params={"temperature": 0.7, "max_tokens": 100},
       prompt="Hello, world!",
       output="Hello, how can I help you today?",
       prompt_tokens=5,
       completion_tokens=8,
       latency_ms=500
   )
   ```

4. **Save Artifacts**

   ```python
   # Save any file as an artifact
   artifact_ref = recorder.save_artifact(
       "results/final_output.json",
       {"result": "success", "data": [...]},
       "application/json"
   )
   ```

5. **Finish the Run**

   ```python
   # Finish the run (success)
   recorder.finish_run(ok=True)
   
   # Or with an error
   try:
       # ... do work ...
   except Exception as e:
       recorder.finish_run(ok=False, error=str(e))
       raise
   ```

## Directory Structure

Each run is stored in its own directory under `runs/`:

```
runs/
  <RUN_ID>/
    events.jsonl       # All events for the run (one JSON object per line)
    artifacts/         # Directory containing all artifacts
      steps/           # Step outputs
      calls/           # Model call inputs/outputs
      ...              # Other artifacts
```

## Event Types

### Run Events

- **run.started**: Emitted when a run starts
- **run.finished**: Emitted when a run finishes

### Step Events

- **step.started**: Emitted when a step starts
- **step.finished**: Emitted when a step finishes

### Model Call Events

- **model.call**: Emitted for each model call

### Artifact Events

- **artifact.saved**: Emitted when an artifact is saved

## Replaying a Run

To replay a run, use the recorded events and artifacts:

```python
import json

run_dir = "runs/<RUN_ID>"

# Read events
with open(f"{run_dir}/events.jsonl", "r") as f:
    events = [json.loads(line) for line in f]

# Process events
for event in events:
    if event["type"] == "step.finished":
        # Load the step output
        artifact_path = event["output_ref"].replace("artifact://artifacts/", "")
        with open(f"{run_dir}/artifacts/{artifact_path}", "r") as f:
            output = json.load(f)
        print(f"Step {event['step_id']} output: {output}")
```

## Schema Evolution

The AFR is designed to handle schema changes:

1. Each event includes a `schema_version` field
2. The `afr.schema` module provides validation and migration
3. To add a new version:
   - Update `CURRENT_SCHEMA` in `afr/schema.py`
   - Add a new validator class
   - Implement migration logic in `migrate_event()`

## Testing

Run the tests with:

```bash
pytest tests/
```

## Example: Recording a Dummy Run

To record a sample run:

```bash
python scripts/record_dummy_run.py
```

This will create a new run in `runs/` and print the first few events.
