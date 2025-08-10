"""Agent Flight Recorder for tracking and replaying agent executions."""
import os
import json
import hashlib
import time
import uuid
from pathlib import Path
from typing import Dict, Any, Optional, Union, List, Tuple
from datetime import datetime

from .schema import validate_event, ArtifactSavedEvent, CURRENT_SCHEMA

class Recorder:
    """Records agent execution events and artifacts for later replay and analysis."""
    
    def __init__(self, runs_dir: str = "./runs"):
        """Initialize the recorder.
        
        Args:
            runs_dir: Base directory where run data will be stored
        """
        self.runs_dir = Path(runs_dir).resolve()
        self.run_id = None
        self.run_dir = None
        self.artifacts_dir = None
        self.events_file = None
        self.step_start_times = {}
        self._ensure_runs_dir()
    
    def _ensure_runs_dir(self) -> None:
        """Ensure the runs directory exists."""
        self.runs_dir.mkdir(parents=True, exist_ok=True)
    
    def start_run(self, agent: str, labels: Optional[Dict[str, str]] = None) -> str:
        """Start a new run.
        
        Args:
            agent: Identifier for the agent
            labels: Optional key-value pairs to associate with the run
            
        Returns:
            The ID of the new run
        """
        if self.run_id is not None:
            self.finish_run(ok=False, error="New run started before previous run finished")
        
        self.run_id = str(uuid.uuid4())
        self.run_dir = self.runs_dir / self.run_id
        self.artifacts_dir = self.run_dir / "artifacts"
        self.events_file = self.run_dir / "events.jsonl"
        
        # Create necessary directories
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        
        # Record the run start event
        self._record_event(
            "run.started",
            agent=agent,
            labels=labels or {}
        )
        
        return self.run_id
    
    def finish_run(self, ok: bool = True, error: Optional[str] = None) -> None:
        """Finish the current run.
        
        Args:
            ok: Whether the run completed successfully
            error: Error message if the run failed
        """
        if self.run_id is None:
            return
        
        self._record_event(
            "run.finished",
            ok=ok,
            error=error
        )
        
        # Clean up
        self.run_id = None
        self.run_dir = None
        self.artifacts_dir = None
        self.events_file = None
        self.step_start_times = {}
    
    def start_step(self, step_id: str, name: str, parent_step_id: Optional[str] = None) -> None:
        """Record the start of a step.
        
        Args:
            step_id: Unique identifier for the step
            name: Human-readable name for the step
            parent_step_id: Optional ID of the parent step
        """
        self.step_start_times[step_id] = time.time()
        self._record_event(
            "step.started",
            step_id=step_id,
            name=name,
            parent_step_id=parent_step_id
        )
    
    def finish_step(self, step_id: str, name: str, result: Any = None, error: Optional[str] = None) -> None:
        """Record the completion of a step.
        
        Args:
            step_id: The step ID
            name: The step name
            result: The step result (will be saved as an artifact)
            error: Optional error message if the step failed
        """
        if step_id not in self.step_start_times:
            raise ValueError(f"No start time recorded for step {step_id}")
        
        # Calculate duration
        duration_ms = int((time.time() - self.step_start_times[step_id]) * 1000)
        
        # Save the result as an artifact if provided
        output_ref = None
        if result is not None:
            # Convert result to a serializable format if it's not already
            serializable_result = self._make_serializable(result)
            output_ref = self.save_artifact(
                f"steps/{step_id}.json",
                serializable_result,
                mime="application/json"
            )
        
        # Record the step finished event
        self._record_event(
            "step.finished",
            step_id=step_id,
            name=name,
            output_ref=output_ref,
            error=error,
            duration_ms=duration_ms
        )
        
        # Clean up
        del self.step_start_times[step_id]
    
    def _make_serializable(self, obj: Any) -> Any:
        """Recursively convert an object to a serializable format."""
        if obj is None or isinstance(obj, (str, int, float, bool)):
            return obj
        elif isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple, set)):
            return [self._make_serializable(item) for item in obj]
        elif hasattr(obj, 'dict') and callable(obj.dict):
            return obj.dict()
        elif hasattr(obj, '__dict__'):
            return {k: self._make_serializable(v) for k, v in obj.__dict__.items() 
                   if not k.startswith('_')}
        return str(obj)
    
    def record_model_call(
        self,
        step_id: str,
        call_id: str,
        model_name: str,
        model_version: str,
        model_provider: str,
        params: Dict[str, Any],
        prompt: str,
        output: str,
        prompt_tokens: int,
        completion_tokens: int,
        latency_ms: int
    ) -> str:
        """Record a model call and save its input and output.
        
        Args:
            step_id: ID of the step that made the call
            call_id: Unique identifier for the call
            model_name: Name of the model
            model_version: Version of the model
            model_provider: Provider of the model
            params: Parameters used for the call
            prompt: The input prompt
            output: The model's output
            prompt_tokens: Number of tokens in the prompt
            completion_tokens: Number of tokens in the completion
            latency_ms: Time taken for the call in milliseconds
            
        Returns:
            Reference to the saved output artifact
        """
        # Save the prompt and output as artifacts
        prompt_ref = self.save_artifact(
            f"calls/{call_id}_prompt.txt",
            prompt,
            mime="text/plain"
        )
        
        output_ref = self.save_artifact(
            f"calls/{call_id}_output.txt",
            output,
            mime="text/plain"
        )
        
        # Record the model call event
        self._record_event(
            "model.call",
            step_id=step_id,
            call_id=call_id,
            model={
                "name": model_name,
                "version": model_version,
                "provider": model_provider
            },
            params=params,
            prompt_ref=prompt_ref,
            output_ref=output_ref,
            tokens={
                "prompt": prompt_tokens,
                "completion": completion_tokens
            },
            latency_ms=latency_ms
        )
        
        return output_ref
    
    def save_artifact(
        self,
        rel_path: str,
        content: Any,
        mime: str
    ) -> str:
        """Save an artifact and return its reference.
        
        Args:
            rel_path: Relative path for the artifact (under artifacts/)
            content: The content to save
            mime: MIME type of the content
            
        Returns:
            Artifact reference (artifact:// URL)
        """
        if self.run_id is None:
            raise RuntimeError("No active run to save artifact to")
        
        # Normalize path
        rel_path = rel_path.lstrip("/")
        artifact_path = self.artifacts_dir / rel_path
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert content to bytes if needed
        if isinstance(content, (dict, list)):
            from langgraph_workflow_skeleton import AIMessageEncoder
            content_str = json.dumps(content, indent=2, ensure_ascii=False, cls=AIMessageEncoder)
            content_bytes = content_str.encode("utf-8")
        elif isinstance(content, str):
            content_bytes = content.encode("utf-8")
        else:
            content_bytes = content
        
        # Write the content
        artifact_path.write_bytes(content_bytes)
        
        # Calculate hash
        sha256 = hashlib.sha256(content_bytes).hexdigest()
        
        # Record the artifact saved event
        self._record_event(
            "artifact.saved",
            artifact_id=rel_path,
            mime=mime,
            sha256=sha256,
            bytes=len(content_bytes),
            path=str(artifact_path.absolute())
        )
        
        return f"artifact://artifacts/{rel_path}"
    
    def _record_event(self, event_type: str, **kwargs) -> None:
        """Record an event.
        
        Args:
            event_type: Type of the event
            **kwargs: Event-specific data
        """
        if self.run_id is None and event_type != "run.started":
            raise RuntimeError(f"No active run to record {event_type} event")
        
        event = {
            "type": event_type,
            "schema_version": CURRENT_SCHEMA,
            "run_id": self.run_id,
            "ts_ms": int(time.time() * 1000),
            **kwargs
        }
        
        # Validate the event
        try:
            validate_event(event)
        except Exception as e:
            raise ValueError(f"Invalid {event_type} event: {e}")
        
        # Write the event to the log file
        with open(self.events_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")

# Global instance for convenience
recorder = Recorder()
