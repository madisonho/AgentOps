"""Tests for the Agent Flight Recorder."""
import os
import json
import time
import tempfile
import pytest
from pathlib import Path
from unittest.mock import patch

from afr.recorder import Recorder, recorder
from afr.schema import validate_event, CURRENT_SCHEMA

@pytest.fixture
def temp_dir():
    """Create a temporary directory for test runs."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)

class TestRecorder:
    """Test the Recorder class."""
    
    def test_start_run(self, temp_dir):
        """Test starting a run creates the necessary directories and files."""
        rec = Recorder(runs_dir=temp_dir)
        run_id = rec.start_run("test_agent")
        
        assert run_id is not None
        assert (temp_dir / run_id).exists()
        assert (temp_dir / run_id / "artifacts").exists()
        assert (temp_dir / run_id / "events.jsonl").exists()
        
        # Verify the run.started event was written
        with open(temp_dir / run_id / "events.jsonl", "r") as f:
            events = [json.loads(line) for line in f]
            
        assert len(events) == 1
        assert events[0]["type"] == "run.started"
        assert events[0]["agent"] == "test_agent"
        
        # Clean up
        rec.finish_run(ok=True)
    
    def test_finish_run(self, temp_dir):
        """Test finishing a run records the run.finished event."""
        rec = Recorder(runs_dir=temp_dir)
        run_id = rec.start_run("test_agent")
        
        # Finish the run
        rec.finish_run(ok=True, error=None)
        
        # Verify both events were written
        with open(temp_dir / run_id / "events.jsonl", "r") as f:
            events = [json.loads(line) for line in f]
            
        assert len(events) == 2
        assert events[0]["type"] == "run.started"
        assert events[1]["type"] == "run.finished"
        assert events[1]["ok"] is True
    
    def test_step_recording(self, temp_dir):
        """Test recording steps."""
        rec = Recorder(runs_dir=temp_dir)
        run_id = rec.start_run("test_agent")
        
        # Record a step
        rec.start_step("step1", "Test Step")
        time.sleep(0.1)  # Ensure duration > 0
        output_ref = rec.finish_step("step1", "Test Step", {"result": "success"})
        
        # Verify the step events and artifact
        with open(temp_dir / run_id / "events.jsonl", "r") as f:
            events = [json.loads(line) for line in f]
        
        # Should have run.started, step.started, artifact.saved, step.finished
        assert len(events) >= 3
        assert events[1]["type"] == "step.started"
        assert events[1]["step_id"] == "step1"
        
        # Find the step.finished event
        finished_events = [e for e in events if e.get("type") == "step.finished"]
        assert len(finished_events) == 1
        assert finished_events[0]["step_id"] == "step1"
        assert finished_events[0]["duration_ms"] > 0
        
        # Verify the artifact was created
        artifact_path = finished_events[0]["output_ref"].replace("artifact://artifacts/", "")
        assert (temp_dir / run_id / "artifacts" / artifact_path).exists()
        
        rec.finish_run(ok=True)
    
    def test_model_call_recording(self, temp_dir):
        """Test recording model calls."""
        rec = Recorder(runs_dir=temp_dir)
        run_id = rec.start_run("test_agent")
        
        # Record a model call
        output_ref = rec.record_model_call(
            step_id="step1",
            call_id="call1",
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
        
        # Verify the model.call event and artifacts
        with open(temp_dir / run_id / "events.jsonl", "r") as f:
            events = [json.loads(line) for line in f]
        
        # Should have run.started, model.call, and artifact.saved events
        assert len(events) >= 3
        
        # Find the model.call event
        model_events = [e for e in events if e.get("type") == "model.call"]
        assert len(model_events) == 1
        
        model_event = model_events[0]
        assert model_event["model"]["name"] == "gpt-4"
        assert model_event["tokens"]["prompt"] == 5
        assert model_event["tokens"]["completion"] == 8
        assert model_event["latency_ms"] == 500
        
        # Verify the prompt and output artifacts exist
        prompt_path = model_event["prompt_ref"].replace("artifact://artifacts/", "")
        output_path = model_event["output_ref"].replace("artifact://artifacts/", "")
        
        assert (temp_dir / run_id / "artifacts" / prompt_path).exists()
        assert (temp_dir / run_id / "artifacts" / output_path).exists()
        
        rec.finish_run(ok=True)
    
    def test_artifact_saving(self, temp_dir):
        """Test saving artifacts."""
        rec = Recorder(runs_dir=temp_dir)
        run_id = rec.start_run("test_agent")
        
        # Save a text artifact
        text_ref = rec.save_artifact("test.txt", "Hello, world!", "text/plain")
        
        # Save a JSON artifact
        json_ref = rec.save_artifact(
            "data.json",
            {"key": "value", "nested": {"a": 1}},
            "application/json"
        )
        
        # Verify the artifacts were saved
        text_path = text_ref.replace("artifact://artifacts/", "")
        json_path = json_ref.replace("artifact://artifacts/", "")
        
        assert (temp_dir / run_id / "artifacts" / text_path).read_text() == "Hello, world!"
        assert json.loads((temp_dir / run_id / "artifacts" / json_path).read_text()) == {"key": "value", "nested": {"a": 1}}
        
        # Verify the artifact.saved events
        with open(temp_dir / run_id / "events.jsonl", "r") as f:
            events = [json.loads(line) for line in f]
        
        # Should have run.started and 2 artifact.saved events
        assert len(events) == 3
        assert events[1]["type"] == "artifact.saved"
        assert events[2]["type"] == "artifact.saved"
        
        rec.finish_run(ok=True)
    
    def test_global_recorder(self, temp_dir):
        """Test the global recorder instance."""
        # Configure the global recorder
        recorder.runs_dir = temp_dir
        
        # Use the global recorder
        run_id = recorder.start_run("test_agent")
        recorder.finish_step("step1", "Test Step", {"result": "success"})
        recorder.finish_run(ok=True)
        
        # Verify the run was recorded
        assert (temp_dir / run_id / "events.jsonl").exists()

class TestSchema:
    """Test the schema validation and migration."""
    
    def test_validate_event(self):
        """Test event validation."""
        # Valid event
        valid_event = {
            "type": "run.started",
            "schema_version": CURRENT_SCHEMA,
            "run_id": "test123",
            "agent": "test_agent",
            "ts_ms": 1234567890,
            "labels": {"env": "test"}
        }
        
        validated = validate_event(valid_event)
        assert validated["type"] == "run.started"
        
        # Invalid event (missing required field)
        invalid_event = valid_event.copy()
        del invalid_event["agent"]
        
        with pytest.raises(ValueError):
            validate_event(invalid_event)
    
    def test_migrate_event(self):
        """Test event migration (identity for now)."""
        event = {
            "type": "run.started",
            "schema_version": "1.0",
            "run_id": "test123",
            "agent": "test_agent",
            "ts_ms": 1234567890
        }
        
        migrated = validate_event(event)
        assert migrated == event
        
        # Test with a future version (should raise)
        future_event = event.copy()
        future_event["schema_version"] = "2.0"
        
        with pytest.raises(ValueError):
            validate_event(future_event)
