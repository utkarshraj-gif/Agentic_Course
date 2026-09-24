from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class AgentRunRequest(BaseModel):
    agent_id: str = Field(..., description="Target agent (aiops, clinical, legal, inventory)")
    input_data: Optional[Dict[str, Any]] = Field(default=None, description="Custom payload or parameters")
    simulate: bool = Field(default=True, description="Whether to run simulated offline execution or live pipeline")

class AgentRunResponse(BaseModel):
    run_id: str
    agent_id: str
    status: str
    execution_time_ms: float
    summary: str
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    result: Dict[str, Any] = Field(default_factory=dict)

class AgentStatus(BaseModel):
    agent_id: str
    name: str
    status: str
    mode: str = "offline"
    capabilities: List[str] = Field(default_factory=list)
