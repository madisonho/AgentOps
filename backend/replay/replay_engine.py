import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


@dataclass
class ReplayStep:
    step_id: str
    step_name: str
    parent_id: Optional[str]
    started_ms: int
    finished_ms: Optional[int]
    model_output_artifact_id: Optional[str]
    status: str


class ReplayEngine:
    """Consumes JSONL traces and produces deterministic playback frames."""

    def __init__(self, trace_path: str | Path):
        self.trace_path = Path(trace_path)
        if not self.trace_path.exists():
            raise FileNotFoundError(self.trace_path)
        self.events = [json.loads(line) for line in self.trace_path.read_text().splitlines() if line.strip()]

    def list_steps(self) -> List[ReplayStep]:
        started: Dict[str, Dict[str, Any]] = {}
        finished: Dict[str, Dict[str, Any]] = {}
        model_output_by_step: Dict[str, str] = {}

        for ev in self.events:
            etype = ev.get("type")
            if etype == "step.started":
                started[ev["step_id"]] = ev
            elif etype == "step.finished":
                finished[ev["step_id"]] = ev
            elif etype == "model.call":
                step_id = ev.get("step_id")
                if step_id:
                    model_output_by_step[step_id] = ev.get("output_artifact_id") or ev.get("output_artifact_id")

        steps: List[ReplayStep] = []
        for step_id, ev in started.items():
            steps.append(
                ReplayStep(
                    step_id=step_id,
                    step_name=ev.get("step_name", "step"),
                    parent_id=ev.get("parent_id"),
                    started_ms=ev.get("timestamp_ms"),
                    finished_ms=(finished.get(step_id) or {}).get("timestamp_ms"),
                    model_output_artifact_id=model_output_by_step.get(step_id),
                    status=(finished.get(step_id) or {}).get("status", "unknown"),
                )
            )
        steps.sort(key=lambda s: s.started_ms)
        return steps

    def timeline(self) -> List[Dict[str, Any]]:
        """Return timeline events ordered by timestamp_ms for UI playback."""
        return sorted(self.events, key=lambda e: e.get("timestamp_ms", 0))

