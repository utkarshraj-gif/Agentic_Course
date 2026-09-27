# backend/routes/admin_cohorts.py
# FastAPI routes for Enterprise Cohort Management & Bulk Operations

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.services.cohort_service import CohortService

router = APIRouter(prefix="/admin/cohorts", tags=["Admin Cohorts"])


class CreateCohortPayload(BaseModel):
    name: str = Field(..., description="Cohort Name")
    description: Optional[str] = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class AssignCoursePayload(BaseModel):
    course_id: str = Field(..., description="Target Course ID")
    start_date: Optional[str] = None
    deadline: Optional[str] = None


class BulkEnrollPayload(BaseModel):
    user_ids: List[str] = Field(..., description="List of Learner User IDs")


@router.get("")
def list_cohorts():
    cohorts = CohortService.list_cohorts()
    return {
        "status": "success",
        "count": len(cohorts),
        "data": cohorts
    }


@router.post("")
def create_cohort(payload: CreateCohortPayload):
    try:
        new_cohort = CohortService.create_cohort(
            name=payload.name,
            description=payload.description or "",
            start_date=payload.start_date,
            end_date=payload.end_date
        )
        return {
            "status": "success",
            "message": f"Cohort '{payload.name}' created.",
            "data": new_cohort
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{cohort_id}")
def get_cohort_detail(cohort_id: str):
    cohort = CohortService.get_cohort_detail(cohort_id)
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Cohort '{cohort_id}' not found.")
    return {
        "status": "success",
        "data": cohort
    }


@router.post("/{cohort_id}/courses")
def assign_course_to_cohort(cohort_id: str, payload: AssignCoursePayload):
    try:
        res = CohortService.assign_course_to_cohort(
            cohort_id=cohort_id,
            course_id=payload.course_id,
            start_date=payload.start_date,
            deadline=payload.deadline
        )
        return {
            "status": "success",
            "message": f"Course assigned to cohort with deadline {payload.deadline}.",
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{cohort_id}/enroll")
def bulk_enroll_learners(cohort_id: str, payload: BulkEnrollPayload):
    try:
        res = CohortService.bulk_enroll_learners(
            cohort_id=cohort_id,
            user_ids=payload.user_ids
        )
        return {
            "status": "success",
            "message": f"Bulk enrolled {res['enrolled_count']} learners into cohort.",
            "data": res
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{cohort_id}/members/{user_id}")
def remove_cohort_member(cohort_id: str, user_id: str):
    try:
        res = CohortService.remove_member(cohort_id=cohort_id, user_id=user_id)
        return {"status": "success", "message": res["message"]}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
