# backend/models/diagram.py
# Generic Graph Schema for Architecture and Process Flow Diagrams

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, model_validator


class DiagramNode(BaseModel):
    """
    Independent graph node specification.
    Contains strictly domain and metadata properties,
    completely decoupled from React Flow layout concerns.
    """
    id: str = Field(..., description="Unique node identifier")
    label: str = Field(..., description="Primary node title")
    subtitle: Optional[str] = Field(None, description="Secondary subtitle or role description")
    type: str = Field("service", description="Node semantic category: user, service, database")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary domain metadata")


class DiagramEdge(BaseModel):
    """
    Independent directed edge definition connecting two nodes.
    """
    id: str = Field(..., description="Unique edge identifier")
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    label: Optional[str] = Field(None, description="Edge interaction or payload description")
    animated: Optional[bool] = Field(False, description="Flag for dynamic active-pulse styling")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary edge metadata")


class Diagram(BaseModel):
    """
    Complete generic graph definition consumed by frontend ELK + React Flow.
    """
    id: str = Field(..., description="Unique diagram identifier")
    name: str = Field(..., description="Display title for the architecture flow")
    direction: str = Field("RIGHT", description="Target layout direction: RIGHT, DOWN, LEFT, UP")
    description: Optional[str] = Field(None, description="High-level architecture summary")
    nodes: List[DiagramNode] = Field(default_factory=list, description="List of graph nodes")
    edges: List[DiagramEdge] = Field(default_factory=list, description="List of graph edges")

    @model_validator(mode="after")
    def validate_graph_integrity(self) -> 'Diagram':
        # 1. Validate unique node IDs
        node_ids = set()
        for node in self.nodes:
            if node.id in node_ids:
                raise ValueError(f"Duplicate node ID detected: '{node.id}'")
            node_ids.add(node.id)

        # 2. Validate unique edge IDs and valid endpoints
        edge_ids = set()
        for edge in self.edges:
            if edge.id in edge_ids:
                raise ValueError(f"Duplicate edge ID detected: '{edge.id}'")
            edge_ids.add(edge.id)

            if edge.source not in node_ids:
                raise ValueError(
                    f"Edge '{edge.id}' references non-existent source node: '{edge.source}'"
                )

            if edge.target not in node_ids:
                raise ValueError(
                    f"Edge '{edge.id}' references non-existent target node: '{edge.target}'"
                )

        return self
