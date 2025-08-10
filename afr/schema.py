"""Schema definitions for Agent Flight Recorder events."""
from typing import Dict, Any, Optional, List, Union, Literal
from pydantic import BaseModel, Field, validator
from datetime import datetime

# Current schema version
CURRENT_SCHEMA = "1.0"

class ModelInfo(BaseModel):
    """Information about the model used in a call."""
    name: str
    version: str
    provider: str

class TokenUsage(BaseModel):
    """Token usage information for a model call."""
    prompt: int
    completion: int

class BaseEvent(BaseModel):
    """Base event model with common fields."""
    type: str
    schema_version: Literal["1.0"] = Field(default=CURRENT_SCHEMA)
    run_id: str
    ts_ms: int = Field(default_factory=lambda: int(datetime.now().timestamp() * 1000))

    @validator('schema_version')
    def validate_schema_version(cls, v):
        if v != CURRENT_SCHEMA:
            raise ValueError(f"Unsupported schema version: {v}")
        return v

class RunStartedEvent(BaseEvent):
    """Event emitted when a run starts."""
    type: str = "run.started"
    agent: str
    labels: Dict[str, str] = {}

class RunFinishedEvent(BaseEvent):
    """Event emitted when a run finishes."""
    type: str = "run.finished"
    ok: bool
    error: Optional[str] = None

class StepStartedEvent(BaseEvent):
    """Event emitted when a step starts."""
    type: str = "step.started"
    step_id: str
    name: str
    parent_step_id: Optional[str] = None

class StepFinishedEvent(BaseEvent):
    """Event emitted when a step finishes."""
    type: str = "step.finished"
    step_id: str
    name: str
    output_ref: str  # artifact:// URL
    duration_ms: Optional[int] = None

class ModelCallEvent(BaseEvent):
    """Event emitted for a model call."""
    type: str = "model.call"
    step_id: str
    call_id: str
    model: ModelInfo
    params: Dict[str, Any]
    prompt_ref: str  # artifact:// URL
    output_ref: str  # artifact:// URL
    tokens: TokenUsage
    latency_ms: int

class ArtifactSavedEvent(BaseEvent):
    """Event emitted when an artifact is saved."""
    type: str = "artifact.saved"
    artifact_id: str  # relative path under artifacts/
    mime: str
    sha256: str
    bytes: int
    path: str  # absolute path on disk

# Union of all event types for type checking
Event = Union[
    RunStartedEvent,
    RunFinishedEvent,
    StepStartedEvent,
    StepFinishedEvent,
    ModelCallEvent,
    ArtifactSavedEvent
]

def validate_event(event_dict: Dict[str, Any]) -> Event:
    """Validate an event against the schema.
    
    Args:
        event_dict: Dictionary containing event data
        
    Returns:
        Validated event object
        
    Raises:
        ValueError: If the event is invalid
    """
    event_type = event_dict.get('type')
    
    event_classes = {
        'run.started': RunStartedEvent,
        'run.finished': RunFinishedEvent,
        'step.started': StepStartedEvent,
        'step.finished': StepFinishedEvent,
        'model.call': ModelCallEvent,
        'artifact.saved': ArtifactSavedEvent
    }
    
    if event_type not in event_classes:
        raise ValueError(f"Unknown event type: {event_type}")
    
    return event_classes[event_type](**event_dict)

def migrate_event(event: Dict[str, Any], from_version: str, to_version: str = CURRENT_SCHEMA) -> Dict[str, Any]:
    """Migrate an event between schema versions.
    
    Args:
        event: The event to migrate
        from_version: The version to migrate from
        to_version: The version to migrate to (defaults to CURRENT_SCHEMA)
        
    Returns:
        The migrated event
    """
    # For now, just validate the event and return it as-is
    # In the future, this would contain migration logic between versions
    if from_version != to_version:
        raise ValueError(f"Migration from {from_version} to {to_version} not yet implemented")
    return event
