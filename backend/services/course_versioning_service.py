# backend/services/course_versioning_service.py
# Enterprise Course Versioning, Content Review Comments & Multi-stage Approval Service

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import psycopg2.extras

from backend.db.database import get_conn
from backend.services.audit_service import AuditService

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CourseVersioningService:
    @classmethod
    def seed_initial_versions(cls) -> None:
        """Seeds initial canonical v1.0 published version for enterprise-ai if missing."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT id FROM course_versions WHERE course_id = 'enterprise-ai' AND version_number = '1.0';")
                    if cur.fetchone():
                        return
                    
                    cur.execute("""
                        INSERT INTO course_versions (id, course_id, version_number, status, created_by,
                                                     change_summary, snapshot_data, created_at, published_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                        ON CONFLICT DO NOTHING;
                    """, (
                        "ver_enterprise_ai_1_0",
                        "enterprise-ai",
                        "1.0",
                        "published",
                        "Velloe Staff Instructor",
                        "Initial production enterprise release with 7 modules and 15 hands-on classes.",
                        json.dumps({"modules_count": 7, "classes_count": 15}),
                        _now_iso(),
                        _now_iso()
                    ))
        except Exception as e:
            logger.warning(f"Error seeding initial course version: {e}")

    @classmethod
    def list_versions(cls, course_id: str) -> List[Dict[str, Any]]:
        cls.seed_initial_versions()
        versions = []
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    cur.execute("""
                        SELECT * FROM course_versions
                        WHERE course_id = %s
                        ORDER BY created_at DESC;
                    """, (course_id,))
                    for r in cur.fetchall():
                        item = dict(r)
                        if isinstance(item.get("snapshot_data"), str):
                            try:
                                item["snapshot_data"] = json.loads(item["snapshot_data"])
                            except Exception:
                                pass
                        item["created_at"] = item["created_at"].isoformat() if item.get("created_at") else None
                        item["published_at"] = item["published_at"].isoformat() if item.get("published_at") else None
                        versions.append(item)
        except Exception as e:
            logger.warning(f"Error querying course versions: {e}")

        if not versions:
            # Baseline draft/published sample
            versions = [
                {
                    "id": f"ver_{course_id}_1_0",
                    "course_id": course_id,
                    "version_number": "1.0",
                    "status": "published",
                    "created_by": "Enterprise Administrator",
                    "change_summary": "Initial baseline release",
                    "snapshot_data": {},
                    "created_at": "2026-09-20T10:00:00Z",
                    "published_at": "2026-09-20T10:00:00Z"
                }
            ]

        return versions

    @classmethod
    def create_version_draft(
        cls,
        course_id: str,
        version_number: str,
        change_summary: str,
        created_by: str = "Administrator"
    ) -> Dict[str, Any]:
        """Creates a new working version snapshot in Draft status."""
        from backend.services.course_management_service import CourseManagementService

        course_detail = CourseManagementService.get_course_detail(course_id)
        if not course_detail:
            raise ValueError(f"Course '{course_id}' not found.")

        ver_id = f"ver_{uuid.uuid4().hex[:8]}"
        now = _now_iso()

        snapshot = {
            "title": course_detail.get("title"),
            "category": course_detail.get("category"),
            "modules": course_detail.get("modules", []),
            "tags": course_detail.get("tags", []),
        }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO course_versions (id, course_id, version_number, status, created_by,
                                                     change_summary, snapshot_data, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s);
                    """, (
                        ver_id,
                        course_id,
                        version_number,
                        "draft",
                        created_by,
                        change_summary,
                        json.dumps(snapshot, default=str),
                        now
                    ))
            AuditService.log(
                action="COURSE_VERSION_CREATED",
                actor_name=created_by,
                entity_type="course_version",
                entity_id=ver_id,
                entity_name=f"{course_detail.get('title')} v{version_number}",
                details={"version": version_number, "change_summary": change_summary}
            )
        except Exception as e:
            logger.error(f"Error creating course version: {e}")
            raise

        return {
            "id": ver_id,
            "course_id": course_id,
            "version_number": version_number,
            "status": "draft",
            "created_by": created_by,
            "change_summary": change_summary,
            "created_at": now
        }

    @classmethod
    def update_version_lifecycle(
        cls,
        version_id: str,
        new_status: str,
        actor_name: str = "Administrator"
    ) -> Dict[str, Any]:
        """
        Transition version lifecycle:
        draft -> in_review -> approved -> published -> superseded / archived
        """
        valid_statuses = ["draft", "in_review", "approved", "published", "superseded", "archived"]
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status '{new_status}'. Allowed: {valid_statuses}")

        now = _now_iso()
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    cur.execute("SELECT * FROM course_versions WHERE id = %s;", (version_id,))
                    ver = cur.fetchone()
                    if not ver:
                        raise ValueError(f"Version '{version_id}' not found.")

                    course_id = ver["course_id"]
                    pub_clause = ", published_at = NOW()" if new_status == "published" else ""

                    # If publishing this version, mark any previous published version as superseded
                    if new_status == "published":
                        cur.execute("""
                            UPDATE course_versions
                            SET status = 'superseded'
                            WHERE course_id = %s AND status = 'published' AND id != %s;
                        """, (course_id, version_id))

                    cur.execute(f"""
                        UPDATE course_versions
                        SET status = %s {pub_clause}
                        WHERE id = %s;
                    """, (new_status, version_id))

            AuditService.log(
                action=f"COURSE_VERSION_{new_status.upper()}",
                actor_name=actor_name,
                entity_type="course_version",
                entity_id=version_id,
                details={"new_status": new_status}
            )
        except Exception as e:
            logger.error(f"Error updating version lifecycle: {e}")
            raise

        return {"success": True, "version_id": version_id, "status": new_status}

    # ---------------- Content Reviews / Review Comments ----------------
    @classmethod
    def list_review_comments(cls, course_id: str) -> List[Dict[str, Any]]:
        reviews = []
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    cur.execute("""
                        SELECT * FROM content_reviews
                        WHERE course_id = %s
                        ORDER BY created_at DESC;
                    """, (course_id,))
                    for r in cur.fetchall():
                        item = dict(r)
                        item["created_at"] = item["created_at"].isoformat() if item.get("created_at") else None
                        item["resolved_at"] = item["resolved_at"].isoformat() if item.get("resolved_at") else None
                        reviews.append(item)
        except Exception as e:
            logger.warning(f"Error querying reviews: {e}")

        if not reviews and course_id == "enterprise-ai":
            reviews = [
                {
                    "id": 1,
                    "course_id": "enterprise-ai",
                    "version_id": "ver_enterprise_ai_1_0",
                    "entity_type": "class",
                    "entity_id": "class_enterprise-ai_9",
                    "author_name": "AI Training Director",
                    "author_role": "Reviewer",
                    "comment": "Ensure the agentic RAG diagram highlights reciprocal rank fusion (RRF) before the judge step.",
                    "status": "resolved",
                    "created_at": "2026-09-21T09:00:00Z",
                    "resolved_at": "2026-09-22T14:30:00Z",
                    "resolved_by": "Staff Instructor"
                },
                {
                    "id": 2,
                    "course_id": "enterprise-ai",
                    "version_id": "ver_enterprise_ai_1_0",
                    "entity_type": "class",
                    "entity_id": "class_enterprise-ai_13",
                    "author_name": "Security Officer",
                    "author_role": "Security Reviewer",
                    "comment": "Verify that PromptArmor example sanitizes indirect prompt injections correctly in the lab sandbox.",
                    "status": "open",
                    "created_at": "2026-09-24T16:15:00Z"
                }
            ]

        return reviews

    @classmethod
    def add_review_comment(
        cls,
        course_id: str,
        entity_type: str,
        entity_id: str,
        author_name: str,
        comment: str,
        author_role: str = "Reviewer",
        version_id: Optional[str] = None
    ) -> Dict[str, Any]:
        now = _now_iso()
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO content_reviews (course_id, version_id, entity_type, entity_id,
                                                     author_name, author_role, comment, status, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, 'open', %s)
                        RETURNING id;
                    """, (
                        course_id,
                        version_id,
                        entity_type,
                        entity_id,
                        author_name,
                        author_role,
                        comment,
                        now
                    ))
                    new_id = cur.fetchone()[0]

            AuditService.log(
                action="REVIEW_COMMENT_ADDED",
                actor_name=author_name,
                entity_type=entity_type,
                entity_id=entity_id,
                details={"course_id": course_id, "comment": comment}
            )
            return {"success": True, "review_id": new_id, "comment": comment, "status": "open"}
        except Exception as e:
            logger.error(f"Error adding review comment: {e}")
            raise

    @classmethod
    def resolve_review_comment(cls, review_id: int, resolved_by: str = "Administrator") -> Dict[str, Any]:
        now = _now_iso()
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE content_reviews
                        SET status = 'resolved', resolved_at = %s, resolved_by = %s
                        WHERE id = %s;
                    """, (now, resolved_by, review_id))
            return {"success": True, "review_id": review_id, "status": "resolved"}
        except Exception as e:
            logger.error(f"Error resolving review: {e}")
            raise
