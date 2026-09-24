from fastapi import APIRouter, HTTPException
from typing import List
from backend.models.agent import AgentRunRequest, AgentRunResponse, AgentStatus
from backend.services.agent_service import AgentService

router = APIRouter(prefix="/agents", tags=["Agents"])

@router.get("", response_model=List[AgentStatus])
def get_agents():
    return AgentService.get_agent_status_list()

@router.post("/run", response_model=AgentRunResponse)
def run_agent(request: AgentRunRequest):
    return AgentService.execute_agent(
        agent_id=request.agent_id,
        input_data=request.input_data,
        simulate=request.simulate
    )
