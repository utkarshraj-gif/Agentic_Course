# backend/routes/diagrams.py
# FastAPI endpoints for dynamic architecture and process flow diagrams

import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status

from backend.models.diagram import Diagram
from backend.services.graph_builder import GraphBuilderService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diagrams", tags=["Architecture & Process Diagrams"])


@router.get("", response_model=List[Dict[str, Any]])
def list_available_diagrams():
    """
    Returns list of all available architecture diagrams and workflows.
    """
    return GraphBuilderService.list_diagrams()


@router.get("/{diagram_id}", response_model=Diagram)
def get_diagram(diagram_id: str):
    """
    Retrieve generic, decoupled graph definition for layout & interactive rendering.
    Validates graph integrity (unique IDs, valid edge endpoints).
    """
    diagram = GraphBuilderService.get_diagram(diagram_id)
    if not diagram:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagram with ID '{diagram_id}' was not found. Available diagrams: {[d['id'] for d in GraphBuilderService.list_diagrams()]}"
        )
    return diagram
