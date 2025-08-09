import json
import os
import time
import uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Generator, Iterable, Optional


DEFAULT_DATA_DIR = Path(os.getenv("AGENT_FR_DATA_DIR", "./data"))


def _now_ms() -> int:
    return int(time.time() * 1000)


@dataclass
class Event:
    type: str
    run_id: str
    timestamp_ms: int
    payload: Dict[str, Any]

    def to_json(self) -> str:
        return json.dumps({
            "type": self.type,
            "run_id": self.run_id,
            "timestamp_ms": self.timestamp_ms,
            **self.payload,
        }, ensure_ascii=False)


class FlightRecorder:
    """Writes structured JSONL events and stores artifacts.

    Layout:
      data/
        runs/<run_id>/trace.jsonl
        artifacts/<artifact_id>
    """

    def __init__(self, base_dir: Path | str = DEFAULT_DATA_DIR):
        self.base_dir = Path(base_dir)
        self.runs_dir = self.base_dir / "runs"
        self.artifacts_dir = self.base_dir / "artifacts"
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

    # -------- Run/Step helpers --------
    def start_run(self, metadata: Optional[Dict[str, Any]] = None) -> str:
        run_id = uuid.uuid4().hex[:12]
        run_dir = self.runs_dir / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        self._emit(run_id, "run.started", {"metadata": metadata or {}})
        return run_id

    def finish_run(self, run_id: str, status: str = "success", error: Optional[str] = None) -> None:
        self._emit(run_id, "run.finished", {"status": status, "error": error})

    def start_step(self, run_id: str, step_name: str, metadata: Optional[Dict[str, Any]] = None, parent_id: Optional[str] = None) -> str:
        step_id = uuid.uuid4().hex[:12]
        self._emit(run_id, "step.started", {"step_id": step_id, "step_name": step_name, "parent_id": parent_id, "metadata": metadata or {}})
        return step_id

    def finish_step(self, run_id: str, step_id: str, status: str = "success", output_artifact_id: Optional[str] = None, error: Optional[str] = None) -> None:
        self._emit(run_id, "step.finished", {"step_id": step_id, "status": status, "output_artifact_id": output_artifact_id, "error": error})

    # -------- Model calls --------
    def model_call(self, run_id: str, step_id: str, provider: str, model: str, prompt: Any, output: Any, parameters: Optional[Dict[str, Any]] = None, latency_ms: Optional[int] = None, tokens: Optional[Dict[str, int]] = None) -> None:
        prompt_artifact_id = self.save_artifact(prompt, mime_type="application/json" if isinstance(prompt, (dict, list)) else "text/plain")
        output_artifact_id = self.save_artifact(output, mime_type="application/json" if isinstance(output, (dict, list)) else "text/plain")
        self._emit(run_id, "model.call", {
            "step_id": step_id,
            "provider": provider,
            "model": model,
            "parameters": parameters or {},
            "latency_ms": latency_ms,
            "tokens": tokens or {},
            "prompt_artifact_id": prompt_artifact_id,
            "output_artifact_id": output_artifact_id,
        })

    # -------- Artifacts --------
    def save_artifact(self, data: Any, *, mime_type: str = "application/octet-stream", suffix: Optional[str] = None) -> str:
        artifact_id = uuid.uuid4().hex
        # Choose extension based on mime
        extension = None
        if suffix:
            extension = suffix
        elif mime_type.startswith("text/"):
            extension = ".txt"
        elif mime_type == "application/json":
            extension = ".json"
        elif mime_type == "audio/mpeg":
            extension = ".mp3"
        else:
            extension = ""

        path = self.artifacts_dir / f"{artifact_id}{extension}"

        if isinstance(data, (dict, list)):
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        elif isinstance(data, (bytes, bytearray)):
            path.write_bytes(data)
        else:
            path.write_text(str(data))

        # Emit event linking artifact
        self._emit(None, "artifact.saved", {
            "artifact_id": artifact_id,
            "path": str(path),
            "mime_type": mime_type,
        })
        return artifact_id

    # -------- Utilities --------
    def _trace_path(self, run_id: str) -> Path:
        return self.runs_dir / run_id / "trace.jsonl"

    def _emit(self, run_id: Optional[str], event_type: str, payload: Dict[str, Any]) -> None:
        # Some events (artifact.saved) can be out-of-run; allow run_id None
        rid = run_id or payload.get("run_id") or "global"
        path = self._trace_path(rid) if run_id else (self.base_dir / "global.jsonl")
        path.parent.mkdir(parents=True, exist_ok=True)
        event = Event(type=event_type, run_id=rid, timestamp_ms=_now_ms(), payload=payload)
        with path.open("a", encoding="utf-8") as f:
            f.write(event.to_json() + "\n")

    # Read API
    def iter_events(self, run_id: str) -> Iterable[Dict[str, Any]]:
        path = self._trace_path(run_id)
        if not path.exists():
            return []
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue


class ModelWrapper:
    """Wraps a LangChain chat model to auto-log model.call events."""

    def __init__(self, recorder: FlightRecorder, run_id: str, step_id_supplier):
        self.recorder = recorder
        self.run_id = run_id
        self._get_step_id = step_id_supplier  # callable -> str

    def wrap(self, chat_model: Any, provider: str, model_name: Optional[str] = None) -> Any:
        """Return a proxy object with invoke(...) that logs model.call events.

        We avoid monkey-patching Pydantic models (e.g., ChatOpenAI), which may
        reject attribute assignment. The returned proxy forwards attributes to
        the underlying model where possible.
        """
        underlying_invoke = getattr(chat_model, "invoke")
        resolved_model_name = model_name or getattr(chat_model, "model_name", "unknown")

        recorder = self.recorder
        run_id = self.run_id
        get_step_id = self._get_step_id

        class _Proxy:
            def __init__(self, inner: Any):
                self._inner = inner
                self.model_name = resolved_model_name

            def __getattr__(self, item: str):
                # Delegate everything except attributes we override
                return getattr(self._inner, item)

            def invoke(self, messages: Any, *args: Any, **kwargs: Any):
                start = time.perf_counter()
                result = underlying_invoke(messages, *args, **kwargs)
                elapsed_ms = int((time.perf_counter() - start) * 1000)

                # Extract text + token info where available
                output_text: Any = getattr(result, "content", result)
                tokens: Dict[str, int] = {}
                response_metadata = getattr(result, "response_metadata", None)
                if isinstance(response_metadata, dict):
                    # compatible with various providers
                    for key in ("input_tokens", "output_tokens", "total_tokens", "prompt_tokens", "completion_tokens"):
                        if key in response_metadata:
                            tokens[key] = response_metadata[key]

                recorder.model_call(
                    run_id=run_id,
                    step_id=get_step_id(),
                    provider=provider,
                    model=resolved_model_name,
                    prompt=messages,
                    output=output_text,
                    parameters=kwargs,
                    latency_ms=elapsed_ms,
                    tokens=tokens,
                )
                return result

        return _Proxy(chat_model)


def step(recorder: FlightRecorder, run_id: str, step_name: str, parent_id: Optional[str] = None):
    """Context manager to record step.started/finished around a block.

    Usage:
        with step(rec, run_id, "shortlisting") as ctx:
            ...
    """
    class _StepCtx:
        def __enter__(self):
            self.step_id = recorder.start_step(run_id, step_name, parent_id=parent_id)
            return self

        def __exit__(self, exc_type, exc, tb):
            status = "success" if exc is None else "error"
            recorder.finish_step(run_id, self.step_id, status=status, error=str(exc) if exc else None)
            # Do not suppress exceptions
            return False

    return _StepCtx()

