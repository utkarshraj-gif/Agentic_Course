# backend/routes/storage.py
# FastAPI routes for NeonDB storage (users, progress, bookmarks, activity)

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.services.storage_service import StorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/storage", tags=["Storage & Progress"])


# ---------------- Models ----------------

class UserSyncPayload(BaseModel):
    id: str = Field(..., description="Unique User ID")
    name: str = Field(..., description="Display Name")
    email: str = Field(..., description="Email address")


class LessonProgressPayload(BaseModel):
    user_id: str
    class_id: int
    completed: bool = True
    class_title: Optional[str] = None


class QuizProgressPayload(BaseModel):
    user_id: str
    class_id: int
    score: int
    total: int
    class_title: Optional[str] = None


class LastVisitedPayload(BaseModel):
    user_id: str
    class_id: int
    class_title: str


class ProjectStartPayload(BaseModel):
    user_id: str
    slug: str
    title: str


class BookmarkPayload(BaseModel):
    user_id: str
    class_id: int
    class_title: str


# ---------------- Routes ----------------

@router.post("/users/sync")
def sync_user(payload: UserSyncPayload):
    try:
        user = StorageService.sync_user(payload.id, payload.name, payload.email)
        return {"status": "success", "user": user}
    except Exception as e:
        logger.exception("Failed to sync user")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress/{user_id}")
def get_user_progress(user_id: str):
    try:
        data = StorageService.get_user_progress(user_id)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.exception(f"Failed to fetch progress for user {user_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/progress/lesson")
def mark_lesson_progress(payload: LessonProgressPayload):
    try:
        StorageService.mark_lesson(
            user_id=payload.user_id,
            class_id=payload.class_id,
            completed=payload.completed,
            class_title=payload.class_title
        )
        return {"status": "success"}
    except Exception as e:
        logger.exception("Failed to update lesson progress")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/progress/quiz")
def save_quiz_result(payload: QuizProgressPayload):
    try:
        StorageService.save_quiz(
            user_id=payload.user_id,
            class_id=payload.class_id,
            score=payload.score,
            total=payload.total,
            class_title=payload.class_title
        )
        return {"status": "success"}
    except Exception as e:
        logger.exception("Failed to save quiz result")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/progress/last-visited")
def set_last_visited(payload: LastVisitedPayload):
    try:
        StorageService.set_last_visited(
            user_id=payload.user_id,
            class_id=payload.class_id,
            class_title=payload.class_title
        )
        return {"status": "success"}
    except Exception as e:
        logger.exception("Failed to update last visited")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/progress/project")
def mark_project_started(payload: ProjectStartPayload):
    try:
        StorageService.mark_project_started(
            user_id=payload.user_id,
            slug=payload.slug,
            title=payload.title
        )
        return {"status": "success"}
    except Exception as e:
        logger.exception("Failed to mark project started")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bookmarks/{user_id}")
def get_bookmarks(user_id: str):
    try:
        bookmarks = StorageService.get_bookmarks(user_id)
        return {"status": "success", "bookmarks": bookmarks}
    except Exception as e:
        logger.exception(f"Failed to fetch bookmarks for {user_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bookmarks")
def add_bookmark(payload: BookmarkPayload):
    try:
        StorageService.add_bookmark(
            user_id=payload.user_id,
            class_id=payload.class_id,
            class_title=payload.class_title
        )
        return {"status": "success"}
    except Exception as e:
        logger.exception("Failed to add bookmark")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/bookmarks/{user_id}/{class_id}")
def remove_bookmark(user_id: str, class_id: int):
    try:
        StorageService.remove_bookmark(user_id, class_id)
        return {"status": "success"}
    except Exception as e:
        logger.exception("Failed to remove bookmark")
        raise HTTPException(status_code=500, detail=str(e))
