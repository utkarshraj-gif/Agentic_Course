from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from backend.models.course import ClassModule, ClassDetail, TechStackItem, CurriculumOverview
from backend.services.course_service import CourseService

router = APIRouter(prefix="/curriculum", tags=["Curriculum"])

@router.get("", response_model=CurriculumOverview)
def get_curriculum_overview():
    """Returns the full curriculum overview with weeks and classes dict.
    This is the shape the frontend SPA expects for rendering the landing page."""
    return CourseService.get_overview()

@router.get("/list", response_model=List[ClassModule])
def get_all_classes(
    week: Optional[int] = Query(None, description="Filter by week (1-6)"),
    search: Optional[str] = Query(None, description="Search by title or topic")
):
    """Returns a flat list of ClassModule objects, optionally filtered."""
    classes = CourseService.get_classes()
    if week is not None:
        classes = [c for c in classes if c.week == week]
    if search:
        s = search.lower()
        classes = [
            c for c in classes
            if s in c.title.lower() or s in c.description.lower() or any(s in t.lower() for t in c.topics)
        ]
    return classes

@router.get("/tech-stack", response_model=List[TechStackItem])
def get_tech_stack():
    return CourseService.get_tech_stack()

@router.get("/classes/{class_id}", response_model=ClassDetail)
def get_class_detail(class_id: int):
    """Returns the full class detail with rendered HTML, TOC, code files, and diagrams."""
    detail = CourseService.get_class_detail(class_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Class {class_id} not found")
    return detail
