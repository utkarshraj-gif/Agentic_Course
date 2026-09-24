# backend/services/storage_service.py
# NeonDB PostgreSQL persistence service for VELLOE Learns

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import psycopg2.extras

from backend.db.database import get_conn

logger = logging.getLogger(__name__)


class StorageService:

    @staticmethod
    def sync_user(user_id: str, name: str, email: str) -> Dict[str, Any]:
        """Upsert user on login."""
        sql = """
        INSERT INTO users (id, name, email)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                email = EXCLUDED.email
        RETURNING id, name, email, created_at;
        """
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, (user_id, name, email))
                row = cur.fetchone()
                return dict(row) if row else {"id": user_id, "name": name, "email": email}

    @staticmethod
    def get_user_progress(user_id: str) -> Dict[str, Any]:
        """Fetch all progress data for a user in a single structured response."""
        result: Dict[str, Any] = {
            "completed_lessons": [],
            "quizzes": {},
            "labs": [],
            "projects": [],
            "last_visited": None,
            "recent_activity": []
        }

        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # 1. Completed lessons
                cur.execute(
                    "SELECT class_id FROM lesson_progress WHERE user_id = %s AND completed = TRUE ORDER BY class_id ASC;",
                    (user_id,)
                )
                result["completed_lessons"] = [row["class_id"] for row in cur.fetchall()]

                # 2. Quiz results
                cur.execute(
                    "SELECT class_id, score, total, taken_at FROM quiz_results WHERE user_id = %s;",
                    (user_id,)
                )
                for row in cur.fetchall():
                    result["quizzes"][str(row["class_id"])] = {
                        "score": row["score"],
                        "total": row["total"],
                        "completedAt": row["taken_at"].isoformat() if row["taken_at"] else None
                    }

                # 3. Lab progress
                cur.execute(
                    "SELECT lab_id FROM lab_progress WHERE user_id = %s AND completed = TRUE;",
                    (user_id,)
                )
                result["labs"] = [row["lab_id"] for row in cur.fetchall()]

                # 4. Projects
                cur.execute(
                    "SELECT slug FROM project_progress WHERE user_id = %s AND started = TRUE;",
                    (user_id,)
                )
                result["projects"] = [row["slug"] for row in cur.fetchall()]

                # 5. Last visited
                cur.execute(
                    "SELECT class_id, class_title, visited_at FROM last_visited WHERE user_id = %s;",
                    (user_id,)
                )
                lv = cur.fetchone()
                if lv:
                    result["last_visited"] = {
                        "classId": lv["class_id"],
                        "classTitle": lv["class_title"],
                        "timestamp": lv["visited_at"].isoformat() if lv["visited_at"] else None
                    }

                # 6. Recent activity
                cur.execute(
                    """
                    SELECT type, label, class_id, logged_at 
                    FROM activity_log 
                    WHERE user_id = %s 
                    ORDER BY logged_at DESC 
                    LIMIT 25;
                    """,
                    (user_id,)
                )
                result["recent_activity"] = [
                    {
                        "type": row["type"],
                        "label": row["label"],
                        "classId": row["class_id"],
                        "timestamp": row["logged_at"].isoformat() if row["logged_at"] else None
                    }
                    for row in cur.fetchall()
                ]

        return result

    @staticmethod
    def mark_lesson(user_id: str, class_id: int, completed: bool = True, class_title: Optional[str] = None) -> None:
        now = datetime.now(timezone.utc)
        sql = """
        INSERT INTO lesson_progress (user_id, class_id, completed, completed_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, class_id) DO UPDATE
            SET completed = EXCLUDED.completed,
                completed_at = EXCLUDED.completed_at;
        """
        activity_sql = """
        INSERT INTO activity_log (user_id, type, label, class_id, logged_at)
        VALUES (%s, %s, %s, %s, %s);
        """
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (user_id, class_id, completed, now if completed else None))
                if completed and class_title:
                    cur.execute(activity_sql, (user_id, "lesson_complete", f"Completed: {class_title}", class_id, now))

    @staticmethod
    def save_quiz(user_id: str, class_id: int, score: int, total: int, class_title: Optional[str] = None) -> None:
        now = datetime.now(timezone.utc)
        sql = """
        INSERT INTO quiz_results (user_id, class_id, score, total, taken_at)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (user_id, class_id) DO UPDATE
            SET score = EXCLUDED.score,
                total = EXCLUDED.total,
                taken_at = EXCLUDED.taken_at;
        """
        activity_sql = """
        INSERT INTO activity_log (user_id, type, label, class_id, logged_at)
        VALUES (%s, %s, %s, %s, %s);
        """
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (user_id, class_id, score, total, now))
                label = f"Knowledge Check: {class_title or f'Class {class_id}'} — {score}/{total}"
                cur.execute(activity_sql, (user_id, "quiz_complete", label, class_id, now))

    @staticmethod
    def set_last_visited(user_id: str, class_id: int, class_title: str) -> None:
        now = datetime.now(timezone.utc)
        sql = """
        INSERT INTO last_visited (user_id, class_id, class_title, visited_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE
            SET class_id = EXCLUDED.class_id,
                class_title = EXCLUDED.class_title,
                visited_at = EXCLUDED.visited_at;
        """
        activity_sql = """
        INSERT INTO activity_log (user_id, type, label, class_id, logged_at)
        VALUES (%s, %s, %s, %s, %s);
        """
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (user_id, class_id, class_title, now))
                cur.execute(activity_sql, (user_id, "lesson_start", f"Opened: {class_title}", class_id, now))

    @staticmethod
    def mark_project_started(user_id: str, slug: str, title: str) -> None:
        now = datetime.now(timezone.utc)
        sql = """
        INSERT INTO project_progress (user_id, slug, started, started_at)
        VALUES (%s, %s, TRUE, %s)
        ON CONFLICT (user_id, slug) DO UPDATE
            SET started = TRUE,
                started_at = EXCLUDED.started_at;
        """
        activity_sql = """
        INSERT INTO activity_log (user_id, type, label, logged_at)
        VALUES (%s, %s, %s, %s);
        """
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (user_id, slug, now))
                cur.execute(activity_sql, (user_id, "project_start", f"Started project: {title}", now))

    @staticmethod
    def get_bookmarks(user_id: str) -> List[Dict[str, Any]]:
        sql = """
        SELECT class_id, class_title, added_at 
        FROM bookmarks 
        WHERE user_id = %s 
        ORDER BY added_at DESC;
        """
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, (user_id,))
                rows = cur.fetchall()
                return [
                    {
                        "classId": row["class_id"],
                        "classTitle": row["class_title"],
                        "addedAt": row["added_at"].isoformat() if row["added_at"] else None
                    }
                    for row in rows
                ]

    @staticmethod
    def add_bookmark(user_id: str, class_id: int, class_title: str) -> None:
        now = datetime.now(timezone.utc)
        sql = """
        INSERT INTO bookmarks (user_id, class_id, class_title, added_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, class_id) DO UPDATE
            SET class_title = EXCLUDED.class_title,
                added_at = EXCLUDED.added_at;
        """
        activity_sql = """
        INSERT INTO activity_log (user_id, type, label, class_id, logged_at)
        VALUES (%s, %s, %s, %s, %s);
        """
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (user_id, class_id, class_title, now))
                cur.execute(activity_sql, (user_id, "bookmark", f"Bookmarked: {class_title}", class_id, now))

    @staticmethod
    def remove_bookmark(user_id: str, class_id: int) -> None:
        sql = "DELETE FROM bookmarks WHERE user_id = %s AND class_id = %s;"
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (user_id, class_id))
