# backend/routes/admin_courses.py
# FastAPI endpoints for Velloe Learns Course Management & Course Builder

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.services.course_management_service import CourseManagementService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/courses", tags=["Admin Course Builder"])


class CreateCoursePayload(BaseModel):
    title: str = Field(..., description="Course Title")
    slug: Optional[str] = Field(None, description="URL Slug")
    short_title: Optional[str] = None
    category: Optional[str] = "Engineering"
    level: Optional[str] = "Intermediate"
    icon: Optional[str] = "🤖"
    banner_image: Optional[str] = "/course-enterprise-ai-banner.jpg"
    short_description: Optional[str] = None
    description: Optional[str] = None
    estimated_duration: Optional[str] = "4 Weeks"
    estimated_hours: Optional[int] = 20
    tags: Optional[List[str]] = Field(default_factory=list)
    created_by: Optional[str] = "Administrator"


class UpdateCoursePayload(BaseModel):
    title: Optional[str] = None
    short_title: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    level: Optional[str] = None
    icon: Optional[str] = None
    banner_image: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    estimated_duration: Optional[str] = None
    estimated_hours: Optional[int] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


class AddModulePayload(BaseModel):
    title: str = Field(..., description="Module title")
    description: Optional[str] = ""
    tools: Optional[List[str]] = Field(default_factory=list)
    module_number: Optional[int] = None
    position: Optional[int] = None


class UpdateModulePayload(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tools: Optional[List[str]] = None


class AddClassPayload(BaseModel):
    course_id: Optional[str] = None
    title: str = Field(..., description="Class title")
    short_title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = ""
    duration: Optional[str] = "60 min"
    lesson_content: Optional[str] = None
    topics: Optional[List[str]] = Field(default_factory=list)
    learning_objectives: Optional[List[str]] = Field(default_factory=list)
    diagrams: Optional[List[str]] = Field(default_factory=list)
    code_examples: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    quiz: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    skills: Optional[List[str]] = Field(default_factory=list)


class UpdateClassPayload(BaseModel):
    title: Optional[str] = None
    short_title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[str] = None
    lesson_content: Optional[str] = None
    topics: Optional[List[str]] = None
    learning_objectives: Optional[List[str]] = None
    diagrams: Optional[List[str]] = None
    code_examples: Optional[List[Dict[str, Any]]] = None
    quiz: Optional[List[Dict[str, Any]]] = None
    skills: Optional[List[str]] = None


@router.get("")
def list_admin_courses(include_drafts: bool = Query(True)):
    courses = CourseManagementService.list_courses(include_drafts=include_drafts)
    return {
        "status": "success",
        "count": len(courses),
        "data": courses
    }


@router.post("")
def create_course(payload: CreateCoursePayload):
    try:
        new_course = CourseManagementService.create_course(payload.dict(exclude_unset=True))
        return {
            "status": "success",
            "message": "Course created successfully in Draft status.",
            "data": new_course
        }
    except Exception as e:
        logger.error(f"Error creating course: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{course_id}")
def get_course_detail(course_id: str):
    course = CourseManagementService.get_course_detail(course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Course '{course_id}' not found.")
    return {
        "status": "success",
        "data": course
    }


@router.patch("/{course_id}")
def update_course(course_id: str, payload: UpdateCoursePayload):
    try:
        updated = CourseManagementService.update_course(course_id, payload.dict(exclude_unset=True))
        return {
            "status": "success",
            "message": "Course updated successfully.",
            "data": updated
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{course_id}")
def delete_course(course_id: str, archive_only: bool = Query(True)):
    if archive_only:
        res = CourseManagementService.archive_course(course_id)
    else:
        res = CourseManagementService.delete_course(course_id)
    return {
        "status": "success",
        "message": res["message"]
    }


@router.post("/{course_id}/duplicate")
def duplicate_course(course_id: str):
    try:
        duplicated = CourseManagementService.duplicate_course(course_id)
        return {
            "status": "success",
            "message": f"Course duplicated as '{duplicated['title']}'.",
            "data": duplicated
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{course_id}/validate")
def validate_course(course_id: str):
    res = CourseManagementService.validate_course(course_id)
    return {
        "status": "success",
        "data": res
    }


@router.post("/{course_id}/publish")
def publish_course(course_id: str):
    res = CourseManagementService.publish_course(course_id)
    if not res["success"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": res["message"], "errors": res.get("errors", [])}
        )
    return {
        "status": "success",
        "message": res["message"],
        "data": res.get("course")
    }


@router.post("/{course_id}/unpublish")
def unpublish_course(course_id: str):
    res = CourseManagementService.unpublish_course(course_id)
    return {
        "status": "success",
        "message": res["message"],
        "data": res.get("course")
    }


# Modules
@router.post("/{course_id}/modules")
def add_module(course_id: str, payload: AddModulePayload):
    try:
        updated_course = CourseManagementService.add_module(course_id, payload.dict(exclude_unset=True))
        return {
            "status": "success",
            "message": "Module created successfully.",
            "data": updated_course
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/modules/{module_id}")
def update_module(module_id: str, payload: UpdateModulePayload):
    res = CourseManagementService.update_module(module_id, payload.dict(exclude_unset=True))
    return {"status": "success", "message": res["message"]}


@router.delete("/modules/{module_id}")
def delete_module(module_id: str):
    res = CourseManagementService.delete_module(module_id)
    return {"status": "success", "message": res["message"]}


# Classes
@router.post("/modules/{module_id}/classes")
def add_class(module_id: str, payload: AddClassPayload):
    try:
        updated_course = CourseManagementService.add_class(module_id, payload.dict(exclude_unset=True))
        return {
            "status": "success",
            "message": "Class created successfully.",
            "data": updated_course
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/classes/{class_id}")
def update_class(class_id: str, payload: UpdateClassPayload):
    try:
        res = CourseManagementService.update_class(class_id, payload.dict(exclude_unset=True))
        return {"status": "success", "message": res["message"], "class_id": class_id}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/classes/{class_id}")
def delete_class(class_id: str):
    res = CourseManagementService.delete_class(class_id)
    return {"status": "success", "message": res["message"]}
