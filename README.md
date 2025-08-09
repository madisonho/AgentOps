# Agent Flight Recorder with Cinematic Replay

A powerful tool for recording, visualizing, and analyzing AI agent execution flows with a focus on vendor selection workflows.

## Overview

This project consists of two main components:
1. **Backend (FastAPI)**: Records agent execution, manages runs, and provides API endpoints for replaying and analyzing agent behavior.
2. **Frontend (React)**: Interactive UI for visualizing agent execution, including a vendor selection demo that showcases the agent's decision-making process.

## Features

### Core Features
- **Execution Recording**: Captures detailed traces of agent executions
- **Temporal Visualization**: Timeline view of agent steps and decisions
- **Cinematic Replay**: Playback of agent execution with step-by-step visualization
- **Artifact Management**: Stores and displays inputs, outputs, and intermediate states

### Vendor Selection Demo
- Interactive vendor browsing and filtering
- Real-time visualization of agent decision process
- Side-by-side comparison of vendor selection criteria
- Detailed vendor profiles with ratings and reviews

## Project Structure

```
AgentOps/
├── backend/                  # FastAPI backend
│   ├── flight_recorder/      # Core recording functionality
│   ├── replay/               # Replay engine for execution traces
│   └── server.py             # Main FastAPI application
│
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── ui/
│   │   │   ├── components/   # Reusable UI components
│   │   │   ├── pages/        # Page components
│   │   │   └── App.tsx       # Main application component
│   │   └── main.tsx          # Entry point
│   └── package.json
│
└── langgraph_workflow_skeleton.py  # Example agent workflow
```

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Install Python dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Start the backend server:
   ```bash
   uvicorn server:app --reload --port 8003
   ```
   The API will be available at `http://localhost:8003`

### Frontend Setup

1. Install Node.js dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`

## Using the Application

1. **Start a New Run**
   ```bash
   curl -X POST http://localhost:8003/runs/start -H "Content-Type: application/json" -d '{"metadata": {"demo": true}}'
   ```
   This will return a `run_id` that you can use to track the execution.

2. **View the Timeline**
   - Open `http://localhost:5173` in your browser
   - The main dashboard shows the agent's execution timeline
   - Click on any step to see detailed information

3. **Vendor Selection Demo**
   - Navigate to the "Vendor Selection Demo" in the sidebar
   - Browse and filter through available vendors
   - Select a vendor to see the agent's decision process

## API Endpoints

- `POST /runs/start` - Start a new recording session
- `POST /runs/{run_id}/finish` - Finish a recording session
- `GET /runs/{run_id}/timeline` - Get the execution timeline
- `GET /runs/{run_id}/events` - Get all events for a run
- `GET /artifacts/{artifact_id}` - Retrieve a specific artifact
- `POST /narrate` - Generate narration for execution steps
- `GET /health` - Health check endpoint

## Development

### Backend
- The backend is built with FastAPI and uses Pydantic for data validation
- New features should include appropriate tests in the `tests/` directory
- Follow PEP 8 style guidelines

### Frontend
- Uses React with TypeScript
- Styled with Material-UI (MUI) components
- State management with React Context and Hooks
- Follow the existing component structure for new features

## License

This project is proprietary and confidential. All rights reserved.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
