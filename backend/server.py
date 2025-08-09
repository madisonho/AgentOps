import os
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from flight_recorder.recorder import FlightRecorder
from replay.replay_engine import ReplayEngine


DATA_DIR = Path(os.getenv("AGENT_FR_DATA_DIR", "./data"))
recorder = FlightRecorder(DATA_DIR)


app = FastAPI(title="Agent Flight Recorder")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartRunRequest(BaseModel):
    metadata: Optional[Dict[str, Any]] = None


@app.post("/runs/start")
def start_run(req: StartRunRequest):
    run_id = recorder.start_run(req.metadata)
    return {"run_id": run_id}


@app.post("/runs/{run_id}/finish")
def finish_run(run_id: str):
    recorder.finish_run(run_id)
    return {"ok": True}


@app.get("/runs/{run_id}/events")
def get_events(run_id: str):
    events = list(recorder.iter_events(run_id))
    if not events:
        raise HTTPException(status_code=404, detail="No events for run")
    return {"events": events}


@app.get("/runs/{run_id}/timeline")
def get_timeline(run_id: str):
    trace_path = DATA_DIR / "runs" / run_id / "trace.jsonl"
    engine = ReplayEngine(trace_path)
    return {"timeline": engine.timeline(), "steps": [s.__dict__ for s in engine.list_steps()]}


@app.get("/artifacts/{artifact_id}")
def get_artifact(artifact_id: str):
    # naive search by prefix
    artifacts_dir = DATA_DIR / "artifacts"
    for p in artifacts_dir.glob(f"{artifact_id}*"):
        data = p.read_bytes()
        return Response(content=data, media_type="application/octet-stream")
    raise HTTPException(status_code=404, detail="Artifact not found")


class NarrationRequest(BaseModel):
    text: str
    voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel default


@app.post("/narrate")
async def narrate(req: NarrationRequest):
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="ELEVENLABS_API_KEY not set")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{req.voice_id}"
    payload = {
        "text": req.text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
    }
    headers = {"xi-api-key": api_key, "accept": "audio/mpeg", "content-type": "application/json"}

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=payload)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        audio = r.content

    artifact_id = recorder.save_artifact(audio, mime_type="audio/mpeg")
    return {"artifact_id": artifact_id}


@app.get("/health")
def health():
    return {"status": "ok"}

