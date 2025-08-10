# AgentOps Workflow

This project implements a vendor selection workflow using LangGraph, integrated with the Agent Flight Recorder (AFR) for tracking and recording workflow executions.

## Features

- Vendor search and selection workflow
- Integration with Agent Flight Recorder for execution tracking
- Mock LLM implementation for testing
- Artifact recording and versioning

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd AgentOps-main
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

## Usage

Run the workflow with recording:
```bash
python langgraph_workflow_skeleton.py --record --query "Find eco-friendly paint vendors in California"
```

## Recording

When run with the `--record` flag, the workflow will save execution data to the `runs/` directory, including:
- Execution logs
- Model inputs/outputs
- Artifacts
- Performance metrics

## License

MIT
