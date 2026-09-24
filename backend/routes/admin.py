# backend/routes/admin.py
# FastAPI routes for VELLOE Agentic AI Academy Administration & Telemetry

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.services.admin_service import AdminService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin & Telemetry"])


class AdminLoginPayload(BaseModel):
    email: str = Field(..., description="Administrator email")
    password: str = Field(..., description="Administrator password / security key")


@router.post("/auth/login")
def admin_login(payload: AdminLoginPayload):
    admin = AdminService.authenticate(payload.email, payload.password)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator credentials or unauthorized access key."
        )
    return {
        "status": "success",
        "data": admin
    }


@router.get("/overview")
def get_admin_overview():
    kpis = AdminService.get_overview_kpis()
    return {
        "status": "success",
        "data": kpis
    }


@router.get("/learners")
def get_admin_learners(
    cohort: Optional[str] = Query(None, description="Filter by cohort"),
    search: Optional[str] = Query(None, description="Search by name, email, or role")
):
    learners = AdminService.get_learners(cohort=cohort, search=search)
    return {
        "status": "success",
        "count": len(learners),
        "data": learners
    }


@router.get("/learners/{user_id}")
def get_admin_learner_dossier(user_id: str):
    dossier = AdminService.get_learner_dossier(user_id)
    if not dossier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Learner '{user_id}' not found."
        )
    return {
        "status": "success",
        "data": dossier
    }


@router.get("/analytics/curriculum")
def get_curriculum_analytics():
    analytics = AdminService.get_curriculum_analytics()
    return {
        "status": "success",
        "data": analytics
    }


@router.get("/activity")
def get_live_activity(limit: int = Query(50, ge=1, le=200)):
    feed = AdminService.get_live_activity_stream(limit=limit)
    return {
        "status": "success",
        "data": feed
    }


@router.get("/sandboxes")
def get_sandbox_telemetry():
    telemetry = AdminService.get_sandbox_telemetry()
    return {
        "status": "success",
        "data": telemetry
    }
