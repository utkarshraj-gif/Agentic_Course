from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from backend.models.course import CapstoneProject, CapstoneDetail
from backend.services.course_service import CourseService

router = APIRouter(prefix="/capstones", tags=["Capstones"])

@router.get("")
def get_all_capstones() -> Dict[str, Any]:
    """Returns capstones wrapped in { capstones: [...] } for frontend compatibility."""
    return {"capstones": [c.model_dump() for c in CourseService.get_capstones()]}

@router.get("/{capstone_id}", response_model=CapstoneDetail)
def get_capstone_detail(capstone_id: str):
    capstone = CourseService.get_capstone_detail(capstone_id)
    if not capstone:
        raise HTTPException(status_code=404, detail=f"Capstone '{capstone_id}' not found")
    return capstone

