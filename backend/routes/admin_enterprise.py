# backend/routes/admin_enterprise.py
# FastAPI routes for Course Versioning, Reviews, Audit Logging, and Learner Risk Engine

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.services.course_versioning_service import CourseVersioningService
from backend.services.audit_service import AuditService
from backend.services.risk_engine_service import RiskEngineService
from backend.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["Enterprise Operations & Risk Engine"])


# ---------------- COURSE VERSIONING & REVIEWS ----------------

class CreateVersionPayload(BaseModel):
    version_number: str = Field(..., description="e.g. 1.1 or 2.0")
    change_summary: str = Field(..., description="Explanation of revisions")
    created_by: Optional[str] = "Administrator"


class UpdateLifecyclePayload(BaseModel):
    status: str = Field(..., description="'in_review', 'approved', 'published', 'superseded', 'archived'")
    actor_name: Optional[str] = "Administrator"


class AddReviewCommentPayload(BaseModel):
    entity_type: str = Field(..., description="'course', 'module', 'class'")
    entity_id: str = Field(..., description="Target entity ID")
    author_name: str = Field(..., description="Reviewer name")
    comment: str = Field(..., description="Review critique or requested change")
    author_role: Optional[str] = "Reviewer"
    version_id: Optional[str] = None


@router.get("/courses/{course_id}/versions")
def list_course_versions(course_id: str):
    versions = CourseVersioningService.list_versions(course_id)
    return {"status": "success", "count": len(versions), "data": versions}


@router.post("/courses/{course_id}/versions")
def create_course_version(course_id: str, payload: CreateVersionPayload):
    try:
        ver = CourseVersioningService.create_version_draft(
            course_id=course_id,
            version_number=payload.version_number,
            change_summary=payload.change_summary,
            created_by=payload.created_by or "Administrator"
        )
        return {"status": "success", "message": f"Version {payload.version_number} draft created.", "data": ver}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/courses/versions/{version_id}/lifecycle")
def update_version_lifecycle(version_id: str, payload: UpdateLifecyclePayload):
    try:
        res = CourseVersioningService.update_version_lifecycle(
            version_id=version_id,
            new_status=payload.status,
            actor_name=payload.actor_name or "Administrator"
        )
        return {"status": "success", "message": f"Version transitioned to {payload.status}.", "data": res}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/courses/{course_id}/reviews")
def list_review_comments(course_id: str):
    reviews = CourseVersioningService.list_review_comments(course_id)
    return {"status": "success", "count": len(reviews), "data": reviews}


@router.post("/courses/{course_id}/reviews")
def add_review_comment(course_id: str, payload: AddReviewCommentPayload):
    try:
        res = CourseVersioningService.add_review_comment(
            course_id=course_id,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            author_name=payload.author_name,
            comment=payload.comment,
            author_role=payload.author_role or "Reviewer",
            version_id=payload.version_id
        )
        return {"status": "success", "message": "Review comment posted.", "data": res}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/courses/reviews/{review_id}/resolve")
def resolve_review_comment(review_id: int, resolved_by: str = Query("Administrator")):
    try:
        res = CourseVersioningService.resolve_review_comment(review_id, resolved_by=resolved_by)
        return {"status": "success", "message": "Review comment resolved.", "data": res}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ---------------- ENTERPRISE AUDIT LOGS ----------------

@router.get("/audit-logs")
def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None)
):
    logs = AuditService.list_logs(limit=limit, action=action, entity_type=entity_type)
    return {"status": "success", "count": len(logs), "data": logs}


# ---------------- DATA-DRIVEN LEARNER RISK ENGINE ----------------

@router.get("/risk-overview")
def get_learner_risk_overview():
    learners = AdminService.get_learners()
    overview = RiskEngineService.get_at_risk_overview(learners)
    return {"status": "success", "data": overview}


@router.get("/learners/{user_id}/risk")
def get_individual_learner_risk(user_id: str):
    learners = AdminService.get_learners()
    target = next((l for l in learners if l["id"] == user_id), None)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Learner '{user_id}' not found.")
    risk = RiskEngineService.calculate_learner_risk(target)
    return {"status": "success", "data": {**target, "risk": risk}}
