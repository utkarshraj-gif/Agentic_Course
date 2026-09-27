from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Any, Dict
from backend.models.course import ClassModule, ClassDetail, TechStackItem, CurriculumOverview
from backend.services.course_service import CourseService
from backend.services.course_management_service import CourseManagementService

router = APIRouter(prefix="/curriculum", tags=["Curriculum"])

@router.get("", response_model=CurriculumOverview)
def get_curriculum_overview():
    """Returns the full curriculum overview with weeks and classes dict."""
    return CourseService.get_overview()

@router.get("/courses")
def get_learner_courses():
    """Returns all published courses for the learner catalog."""
    courses = CourseManagementService.list_courses(include_drafts=False)
    results = []
    for c in courses:
        results.append({
            "id": c["id"],
            "slug": c["slug"],
            "title": c["title"],
            "shortTitle": c.get("short_title") or c["title"],
            "category": c.get("category", "Production AI"),
            "level": c.get("level", "Advanced"),
            "icon": c.get("icon", "🤖"),
            "description": c.get("description", ""),
            "enrolled": True,
            "bannerImage": c.get("banner_image", "/course-enterprise-ai-banner.jpg"),
            "totalWeeks": c.get("modules_count", 0),
            "totalClasses": c.get("classes_count", 0),
        })
    return {
        "status": "success",
        "count": len(results),
        "data": results
    }

@router.get("/courses/{slug_or_id}")
def get_course_curriculum_by_slug(slug_or_id: str):
    """Returns the full curriculum overview for a specific course slug or ID."""
    overview = CourseManagementService.get_course_curriculum_overview(slug_or_id)
    if not overview:
        if slug_or_id in ["enterprise-ai", "default"]:
            return CourseService.get_overview()
        raise HTTPException(status_code=404, detail=f"Course '{slug_or_id}' not found")
    return overview

@router.get("/list", response_model=List[ClassModule])
def get_all_classes(
    week: Optional[int] = Query(None, description="Filter by week (1-7)"),
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

@router.get("/classes/{class_id}")
def get_class_detail(class_id: str):
    """Returns the full class detail with rendered HTML, TOC, code files, and diagrams.
    Supports both static classes (1-15) and dynamic course classes created by Admin."""
    if class_id.isdigit():
        num = int(class_id)
        if 0 <= num <= 15:
            detail = CourseService.get_class_detail(num)
            if detail:
                return detail

    # Fallback or dynamic class resolution
    dynamic_detail = CourseManagementService.get_dynamic_class_detail(class_id)
    if dynamic_detail:
        return dynamic_detail

    raise HTTPException(status_code=404, detail=f"Class '{class_id}' not found")

@router.get("/classes/{class_id}/quiz")
def get_class_quiz(class_id: str):
    """Returns the quiz associated with a class."""
    dynamic_detail = CourseManagementService.get_dynamic_class_detail(class_id)
    if dynamic_detail and dynamic_detail.get("meta", {}).get("quiz"):
        return {
            "status": "success",
            "classId": dynamic_detail.get("id"),
            "questions": dynamic_detail["meta"]["quiz"]
        }
    return {
        "status": "success",
        "classId": class_id,
        "questions": []
    }

