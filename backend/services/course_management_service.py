# backend/services/course_management_service.py
# Unified Course Management Service for Velloe Learns
# Handles dynamic courses, modules, classes, quizzes, diagrams, and publishing

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import markdown
import psycopg2.extras

from backend.config import BASE_DIR, BACKEND_DIR
from backend.db.database import get_conn
from backend.models.course import CodeFile, TechStackItem
from backend.services.course_service import (
    WEEKS_CONFIG,
    CLASS_DIRECTORIES,
    CLASS_META,
    CAPSTONES_CONFIG,
    _parse_markdown_doc,
    _read_code_files,
    _resolve_dir
)

logger = logging.getLogger(__name__)

COURSES_FILE = BACKEND_DIR / "data" / "courses_store.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CourseManagementService:
    @classmethod
    def _read_local_fallback(cls) -> Dict[str, Any]:
        if COURSES_FILE.exists():
            try:
                return json.loads(COURSES_FILE.read_text(encoding="utf-8"))
            except Exception as e:
                logger.error(f"Error reading local courses store: {e}")
        return {"courses": {}, "modules": {}, "classes": {}, "enrollments": {}}

    @classmethod
    def _write_local_fallback(cls, data: Dict[str, Any]) -> None:
        try:
            COURSES_FILE.parent.mkdir(parents=True, exist_ok=True)
            COURSES_FILE.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        except Exception as e:
            logger.error(f"Error writing local courses store: {e}")

    @classmethod
    def seed_reference_course(cls) -> None:
        """
        Seeds the canonical Enterprise Agentic AI course from the static curriculum
        if it does not already exist in NeonDB or the local store.
        """
        ref_id = "enterprise-ai"
        ref_slug = "enterprise-ai"

        # Check if already seeded in DB
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    cur.execute("SELECT id FROM courses WHERE id = %s OR slug = %s", (ref_id, ref_slug))
                    if cur.fetchone():
                        logger.info("Canonical course 'enterprise-ai' already seeded in database.")
                        return
        except Exception as e:
            logger.warning(f"Could not check DB for seed (using fallback): {e}")
            store = cls._read_local_fallback()
            if ref_id in store["courses"]:
                logger.info("Canonical course 'enterprise-ai' already present in fallback.")
                return

        logger.info("Seeding canonical Enterprise Agentic AI course into Course Management...")

        course_data = {
            "id": ref_id,
            "slug": ref_slug,
            "title": "Enterprise AI Agent Course",
            "short_title": "Enterprise AI",
            "category": "Production AI",
            "level": "Advanced",
            "icon": "🤖",
            "banner_image": "/Agentic_Banner.png",
            "short_description": "Master production-grade Agentic AI engineering — LangGraph, DSPy, RAG, multi-agent systems, and enterprise AIOps.",
            "description": "Master production-grade Agentic AI engineering — LangGraph, DSPy, RAG, multi-agent systems, and enterprise AIOps. Build robust, observable, and resilient multi-agent architectures ready for enterprise workloads.",
            "estimated_duration": "7 Weeks",
            "estimated_hours": 35,
            "status": "published",
            "tags": ["LangGraph", "DSPy", "RAG", "Multi-Agent Systems", "AIOps", "PromptArmor", "NeMo Guardrails"],
            "created_by": "Velloe Staff Instructor",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "published_at": _now_iso(),
        }

        modules_data = []
        classes_data = []

        for w_idx, week in enumerate(WEEKS_CONFIG, start=1):
            mod_id = f"mod_{ref_id}_{week['n']}"
            modules_data.append({
                "id": mod_id,
                "course_id": ref_id,
                "module_number": week["n"],
                "title": week["title"],
                "description": week["summary"],
                "tools": week["tools"],
                "position": w_idx,
                "created_at": _now_iso(),
            })

            for c_pos, class_num in enumerate(week["classes"], start=1):
                class_id = f"class_{ref_id}_{class_num}"
                meta = CLASS_META.get(class_num, {})
                sub_dir = CLASS_DIRECTORIES.get(class_num, "")

                # Load README markdown content
                lesson_md = f"# Class {class_num}: {meta.get('short', f'Class {class_num}')}\n\n"
                if sub_dir:
                    resolved = _resolve_dir(sub_dir)
                    readme = resolved / "README.md"
                    if readme.exists():
                        try:
                            lesson_md = readme.read_text(encoding="utf-8")
                        except Exception:
                            pass

                # Read code files
                code_files = []
                if sub_dir:
                    resolved = _resolve_dir(sub_dir)
                    for f in _read_code_files(resolved):
                        code_files.append({"name": f.name, "lang": f.lang, "code": f.code, "runnable": True})

                classes_data.append({
                    "id": class_id,
                    "course_id": ref_id,
                    "module_id": mod_id,
                    "class_number": class_num,
                    "slug": f"class-{class_num}",
                    "title": f"Class {class_num}: {meta.get('short', '')}",
                    "short_title": meta.get("short", f"Class {class_num}"),
                    "description": f"Domain: {meta.get('domain', 'Enterprise AI')}. Tools: {', '.join(meta.get('tools', []))}",
                    "duration": "60 min",
                    "position": c_pos,
                    "lesson_content": lesson_md,
                    "topics": meta.get("tools", []),
                    "learning_objectives": [
                        f"Understand architectural principles of {meta.get('short', '')}",
                        f"Implement enterprise workflows using {', '.join(meta.get('tools', []))}",
                        "Evaluate safety and performance in production"
                    ],
                    "diagrams": [],
                    "code_examples": code_files,
                    "quiz": [],
                    "skills": meta.get("tools", []),
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                })

        # Save to DB
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO courses (id, slug, title, short_title, category, level, icon, banner_image,
                                             short_description, description, estimated_duration, estimated_hours,
                                             status, tags, created_by, created_at, updated_at, published_at)
                        VALUES (%(id)s, %(slug)s, %(title)s, %(short_title)s, %(category)s, %(level)s, %(icon)s,
                                %(banner_image)s, %(short_description)s, %(description)s, %(estimated_duration)s,
                                %(estimated_hours)s, %(status)s, %(tags)s::jsonb, %(created_by)s,
                                %(created_at)s, %(updated_at)s, %(published_at)s)
                        ON CONFLICT (id) DO NOTHING;
                    """, {
                        **course_data,
                        "tags": json.dumps(course_data["tags"])
                    })

                    for m in modules_data:
                        cur.execute("""
                            INSERT INTO course_modules (id, course_id, module_number, title, description, tools, position, created_at)
                            VALUES (%(id)s, %(course_id)s, %(module_number)s, %(title)s, %(description)s, %(tools)s::jsonb, %(position)s, %(created_at)s)
                            ON CONFLICT (id) DO NOTHING;
                        """, {**m, "tools": json.dumps(m["tools"])})

                    for c in classes_data:
                        cur.execute("""
                            INSERT INTO course_classes (id, course_id, module_id, class_number, slug, title, short_title,
                                                       description, duration, position, lesson_content, topics,
                                                       learning_objectives, diagrams, code_examples, quiz, skills,
                                                       created_at, updated_at)
                            VALUES (%(id)s, %(course_id)s, %(module_id)s, %(class_number)s, %(slug)s, %(title)s, %(short_title)s,
                                    %(description)s, %(duration)s, %(position)s, %(lesson_content)s, %(topics)s::jsonb,
                                    %(learning_objectives)s::jsonb, %(diagrams)s::jsonb, %(code_examples)s::jsonb,
                                    %(quiz)s::jsonb, %(skills)s::jsonb, %(created_at)s, %(updated_at)s)
                            ON CONFLICT (id) DO NOTHING;
                        """, {
                            **c,
                            "topics": json.dumps(c["topics"]),
                            "learning_objectives": json.dumps(c["learning_objectives"]),
                            "diagrams": json.dumps(c["diagrams"]),
                            "code_examples": json.dumps(c["code_examples"]),
                            "quiz": json.dumps(c["quiz"]),
                            "skills": json.dumps(c["skills"]),
                        })
            logger.info("Successfully seeded canonical course into NeonDB!")
        except Exception as e:
            logger.warning(f"Could not write seed to NeonDB (using local fallback store): {e}")

        # Sync local fallback store as well
        store = cls._read_local_fallback()
        store["courses"][ref_id] = course_data
        for m in modules_data:
            store["modules"][m["id"]] = m
        for c in classes_data:
            store["classes"][c["id"]] = c
        cls._write_local_fallback(store)

    @classmethod
    def list_courses(cls, include_drafts: bool = True) -> List[Dict[str, Any]]:
        cls.seed_reference_course()
        courses = []
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    query = """
                        SELECT c.*,
                               COUNT(DISTINCT m.id) as modules_count,
                               COUNT(DISTINCT cl.id) as classes_count,
                               COUNT(DISTINCT en.user_id) as enrolled_count
                        FROM courses c
                        LEFT JOIN course_modules m ON m.course_id = c.id
                        LEFT JOIN course_classes cl ON cl.course_id = c.id
                        LEFT JOIN course_enrollments en ON en.course_id = c.id
                    """
                    if not include_drafts:
                        query += " WHERE c.status = 'published'"
                    query += " GROUP BY c.id ORDER BY c.created_at DESC"
                    cur.execute(query)
                    rows = cur.fetchall()
                    for r in rows:
                        item = dict(r)
                        item["modules_count"] = item.get("modules_count") or 0
                        item["classes_count"] = item.get("classes_count") or 0
                        item["enrolled_count"] = item.get("enrolled_count") or 0
                        if isinstance(item.get("tags"), str):
                            try:
                                item["tags"] = json.loads(item["tags"])
                            except Exception:
                                pass
                        courses.append(item)
                    return courses
        except Exception as e:
            logger.warning(f"Database query error in list_courses (using fallback): {e}")

        # Fallback store
        store = cls._read_local_fallback()
        for c_id, c in store.get("courses", {}).items():
            if not include_drafts and c.get("status") != "published":
                continue
            mod_count = sum(1 for m in store.get("modules", {}).values() if m.get("course_id") == c_id)
            cls_count = sum(1 for cl in store.get("classes", {}).values() if cl.get("course_id") == c_id)
            enrolled_count = sum(1 for en in store.get("enrollments", {}).values() if en.get("course_id") == c_id)
            courses.append({
                **c,
                "modules_count": mod_count,
                "classes_count": cls_count,
                "enrolled_count": enrolled_count
            })
        return courses

    @classmethod
    def get_course_detail(cls, course_id_or_slug: str) -> Optional[Dict[str, Any]]:
        cls.seed_reference_course()
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    cur.execute("SELECT * FROM courses WHERE id = %s OR slug = %s", (course_id_or_slug, course_id_or_slug))
                    row = cur.fetchone()
                    if not row:
                        return None
                    course = dict(row)
                    if isinstance(course.get("tags"), str):
                        try:
                            course["tags"] = json.loads(course["tags"])
                        except Exception:
                            pass

                    # Fetch modules
                    cur.execute("SELECT * FROM course_modules WHERE course_id = %s ORDER BY position ASC, module_number ASC", (course["id"],))
                    modules = [dict(m) for m in cur.fetchall()]
                    for m in modules:
                        if isinstance(m.get("tools"), str):
                            try:
                                m["tools"] = json.loads(m["tools"])
                            except Exception:
                                pass

                    # Fetch classes
                    cur.execute("SELECT * FROM course_classes WHERE course_id = %s ORDER BY position ASC, class_number ASC", (course["id"],))
                    classes = [dict(cl) for cl in cur.fetchall()]
                    for cl in classes:
                        for field in ["topics", "learning_objectives", "diagrams", "code_examples", "quiz", "skills"]:
                            if isinstance(cl.get(field), str):
                                try:
                                    cl[field] = json.loads(cl[field])
                                except Exception:
                                    pass

                    # Attach classes into modules
                    for m in modules:
                        m["classes"] = [cl for cl in classes if cl["module_id"] == m["id"]]

                    course["modules"] = modules
                    return course
        except Exception as e:
            logger.warning(f"Database query error in get_course_detail (using fallback): {e}")

        # Fallback
        store = cls._read_local_fallback()
        found_c = None
        for c in store.get("courses", {}).values():
            if c.get("id") == course_id_or_slug or c.get("slug") == course_id_or_slug:
                found_c = dict(c)
                break
        if not found_c:
            return None

        c_id = found_c["id"]
        mods = [dict(m) for m in store.get("modules", {}).values() if m.get("course_id") == c_id]
        mods.sort(key=lambda x: (x.get("position", 1), x.get("module_number", 1)))
        clss = [dict(cl) for cl in store.get("classes", {}).values() if cl.get("course_id") == c_id]
        clss.sort(key=lambda x: (x.get("position", 1), x.get("class_number", 1)))

        for m in mods:
            m["classes"] = [cl for cl in clss if cl.get("module_id") == m["id"]]
        found_c["modules"] = mods
        return found_c

    @classmethod
    def create_course(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        title = data.get("title", "").strip()
        if not title:
            raise ValueError("Course title is required.")

        slug = data.get("slug", "").strip()
        if not slug:
            slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')

        # Check slug uniqueness
        existing = cls.get_course_detail(slug)
        if existing:
            slug = f"{slug}-{uuid.uuid4().hex[:4]}"

        course_id = f"course_{uuid.uuid4().hex[:8]}"
        now = _now_iso()

        course = {
            "id": course_id,
            "slug": slug,
            "title": title,
            "short_title": data.get("short_title", title[:25]),
            "category": data.get("category", "Engineering"),
            "level": data.get("level", "Intermediate"),
            "icon": data.get("icon", "🤖"),
            "banner_image": data.get("banner_image", "/course-enterprise-ai-banner.jpg"),
            "short_description": data.get("short_description", ""),
            "description": data.get("description", title),
            "estimated_duration": data.get("estimated_duration", "4 Weeks"),
            "estimated_hours": int(data.get("estimated_hours", 20)),
            "status": "draft",
            "tags": data.get("tags", []),
            "created_by": data.get("created_by", "Administrator"),
            "created_at": now,
            "updated_at": now,
            "published_at": None,
        }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO courses (id, slug, title, short_title, category, level, icon, banner_image,
                                             short_description, description, estimated_duration, estimated_hours,
                                             status, tags, created_by, created_at, updated_at, published_at)
                        VALUES (%(id)s, %(slug)s, %(title)s, %(short_title)s, %(category)s, %(level)s, %(icon)s,
                                %(banner_image)s, %(short_description)s, %(description)s, %(estimated_duration)s,
                                %(estimated_hours)s, %(status)s, %(tags)s::jsonb, %(created_by)s,
                                %(created_at)s, %(updated_at)s, %(published_at)s)
                    """, {**course, "tags": json.dumps(course["tags"])})
        except Exception as e:
            logger.warning(f"NeonDB insert course error: {e}")

        # Local fallback store
        store = cls._read_local_fallback()
        store["courses"][course_id] = course
        cls._write_local_fallback(store)

        course["modules"] = []
        return course

    @classmethod
    def update_course(cls, course_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        course = cls.get_course_detail(course_id)
        if not course:
            raise ValueError(f"Course '{course_id}' not found.")

        allowed_fields = [
            "title", "short_title", "slug", "category", "level", "icon", "banner_image",
            "short_description", "description", "estimated_duration", "estimated_hours",
            "tags", "status"
        ]
        updates = {}
        for f in allowed_fields:
            if f in data:
                updates[f] = data[f]
        updates["updated_at"] = _now_iso()

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    set_clauses = []
                    params = {"id": course_id}
                    for k, v in updates.items():
                        if k == "tags":
                            set_clauses.append("tags = %(tags)s::jsonb")
                            params["tags"] = json.dumps(v)
                        else:
                            set_clauses.append(f"{k} = %({k})s")
                            params[k] = v
                    query = f"UPDATE courses SET {', '.join(set_clauses)} WHERE id = %(id)s"
                    cur.execute(query, params)
        except Exception as e:
            logger.warning(f"NeonDB update course error: {e}")

        # Update fallback store
        store = cls._read_local_fallback()
        if course_id in store["courses"]:
            store["courses"][course_id].update(updates)
            cls._write_local_fallback(store)

        return cls.get_course_detail(course_id)

    @classmethod
    def duplicate_course(cls, course_id: str) -> Dict[str, Any]:
        original = cls.get_course_detail(course_id)
        if not original:
            raise ValueError(f"Course '{course_id}' not found.")

        new_title = f"{original['title']} - Copy"
        new_slug = f"{original['slug']}-copy-{uuid.uuid4().hex[:4]}"
        new_id = f"course_{uuid.uuid4().hex[:8]}"
        now = _now_iso()

        new_course = {
            **original,
            "id": new_id,
            "title": new_title,
            "short_title": f"{original.get('short_title', '')[:20]} Copy",
            "slug": new_slug,
            "status": "draft",
            "created_at": now,
            "updated_at": now,
            "published_at": None,
        }

        # Create new course record
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO courses (id, slug, title, short_title, category, level, icon, banner_image,
                                             short_description, description, estimated_duration, estimated_hours,
                                             status, tags, created_by, created_at, updated_at, published_at)
                        VALUES (%(id)s, %(slug)s, %(title)s, %(short_title)s, %(category)s, %(level)s, %(icon)s,
                                %(banner_image)s, %(short_description)s, %(description)s, %(estimated_duration)s,
                                %(estimated_hours)s, %(status)s, %(tags)s::jsonb, %(created_by)s,
                                %(created_at)s, %(updated_at)s, %(published_at)s)
                    """, {**new_course, "tags": json.dumps(new_course.get("tags", []))})

                    # Duplicate modules and classes
                    for mod in original.get("modules", []):
                        new_mod_id = f"mod_{uuid.uuid4().hex[:8]}"
                        cur.execute("""
                            INSERT INTO course_modules (id, course_id, module_number, title, description, tools, position, created_at)
                            VALUES (%(id)s, %(course_id)s, %(module_number)s, %(title)s, %(description)s, %(tools)s::jsonb, %(position)s, %(created_at)s)
                        """, {
                            "id": new_mod_id,
                            "course_id": new_id,
                            "module_number": mod.get("module_number", 1),
                            "title": mod.get("title", ""),
                            "description": mod.get("description", ""),
                            "tools": json.dumps(mod.get("tools", [])),
                            "position": mod.get("position", 1),
                            "created_at": now,
                        })

                        for cl in mod.get("classes", []):
                            new_class_id = f"class_{uuid.uuid4().hex[:8]}"
                            cur.execute("""
                                INSERT INTO course_classes (id, course_id, module_id, class_number, slug, title, short_title,
                                                           description, duration, position, lesson_content, topics,
                                                           learning_objectives, diagrams, code_examples, quiz, skills,
                                                           created_at, updated_at)
                                VALUES (%(id)s, %(course_id)s, %(module_id)s, %(class_number)s, %(slug)s, %(title)s, %(short_title)s,
                                        %(description)s, %(duration)s, %(position)s, %(lesson_content)s, %(topics)s::jsonb,
                                        %(learning_objectives)s::jsonb, %(diagrams)s::jsonb, %(code_examples)s::jsonb,
                                        %(quiz)s::jsonb, %(skills)s::jsonb, %(created_at)s, %(updated_at)s)
                            """, {
                                "id": new_class_id,
                                "course_id": new_id,
                                "module_id": new_mod_id,
                                "class_number": cl.get("class_number", 1),
                                "slug": cl.get("slug", ""),
                                "title": cl.get("title", ""),
                                "short_title": cl.get("short_title", ""),
                                "description": cl.get("description", ""),
                                "duration": cl.get("duration", "60 min"),
                                "position": cl.get("position", 1),
                                "lesson_content": cl.get("lesson_content", ""),
                                "topics": json.dumps(cl.get("topics", [])),
                                "learning_objectives": json.dumps(cl.get("learning_objectives", [])),
                                "diagrams": json.dumps(cl.get("diagrams", [])),
                                "code_examples": json.dumps(cl.get("code_examples", [])),
                                "quiz": json.dumps(cl.get("quiz", [])),
                                "skills": json.dumps(cl.get("skills", [])),
                                "created_at": now,
                                "updated_at": now,
                            })
        except Exception as e:
            logger.warning(f"NeonDB duplicate course error: {e}")

        # Update fallback store
        store = cls._read_local_fallback()
        store["courses"][new_id] = new_course
        cls._write_local_fallback(store)

        return cls.get_course_detail(new_id)

    @classmethod
    def validate_course(cls, course_id: str) -> Dict[str, Any]:
        course = cls.get_course_detail(course_id)
        if not course:
            return {"valid": False, "errors": ["Course not found."]}

        errors = []
        if not course.get("title", "").strip():
            errors.append("Course title is required.")
        if not course.get("slug", "").strip():
            errors.append("Course URL slug is required.")
        if not course.get("description", "").strip():
            errors.append("Course description is required.")

        modules = course.get("modules", [])
        if not modules:
            errors.append("Course must contain at least one week/module.")
        else:
            for m in modules:
                classes = m.get("classes", [])
                if not classes:
                    errors.append(f"Module '{m.get('title', 'Untitled')}' has no classes.")
                for cl in classes:
                    if not cl.get("title", "").strip():
                        errors.append(f"A class in module '{m.get('title')}' is missing a title.")
                    # Validate quiz if questions exist
                    for q_idx, q in enumerate(cl.get("quiz", []), start=1):
                        if not q.get("question", "").strip():
                            errors.append(f"Class '{cl.get('title')}' has a quiz question with empty prompt.")
                        if not q.get("options") or len(q.get("options")) < 2:
                            errors.append(f"Class '{cl.get('title')}' quiz question {q_idx} needs at least 2 options.")
                        if q.get("correctIndex") is None or q.get("correctIndex") >= len(q.get("options", [])):
                            errors.append(f"Class '{cl.get('title')}' quiz question {q_idx} has no valid correct answer selected.")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": []
        }

    @classmethod
    def publish_course(cls, course_id: str) -> Dict[str, Any]:
        val = cls.validate_course(course_id)
        if not val["valid"]:
            return {
                "success": False,
                "message": "Cannot publish course due to validation issues.",
                "errors": val["errors"]
            }

        now = _now_iso()
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE courses SET status = 'published', published_at = %s, updated_at = %s
                        WHERE id = %s
                    """, (now, now, course_id))
        except Exception as e:
            logger.warning(f"NeonDB publish error: {e}")

        store = cls._read_local_fallback()
        if course_id in store["courses"]:
            store["courses"][course_id]["status"] = "published"
            store["courses"][course_id]["published_at"] = now
            cls._write_local_fallback(store)

        return {
            "success": True,
            "message": "Course published successfully! Learners can now view and enroll in this course.",
            "course": cls.get_course_detail(course_id)
        }

    @classmethod
    def unpublish_course(cls, course_id: str) -> Dict[str, Any]:
        now = _now_iso()
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE courses SET status = 'draft', updated_at = %s
                        WHERE id = %s
                    """, (now, course_id))
        except Exception as e:
            logger.warning(f"NeonDB unpublish error: {e}")

        store = cls._read_local_fallback()
        if course_id in store["courses"]:
            store["courses"][course_id]["status"] = "draft"
            cls._write_local_fallback(store)

        return {
            "success": True,
            "message": "Course moved to draft status.",
            "course": cls.get_course_detail(course_id)
        }

    @classmethod
    def archive_course(cls, course_id: str) -> Dict[str, Any]:
        now = _now_iso()
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE courses SET status = 'archived', updated_at = %s
                        WHERE id = %s
                    """, (now, course_id))
        except Exception as e:
            logger.warning(f"NeonDB archive error: {e}")

        store = cls._read_local_fallback()
        if course_id in store["courses"]:
            store["courses"][course_id]["status"] = "archived"
            cls._write_local_fallback(store)

        return {"success": True, "message": "Course archived."}

    @classmethod
    def delete_course(cls, course_id: str) -> Dict[str, Any]:
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM courses WHERE id = %s", (course_id,))
        except Exception as e:
            logger.warning(f"NeonDB delete error: {e}")

        store = cls._read_local_fallback()
        if course_id in store["courses"]:
            del store["courses"][course_id]
            # Remove related modules and classes
            store["modules"] = {k: v for k, v in store["modules"].items() if v.get("course_id") != course_id}
            store["classes"] = {k: v for k, v in store["classes"].items() if v.get("course_id") != course_id}
            cls._write_local_fallback(store)

        return {"success": True, "message": "Course deleted."}

    @classmethod
    def add_module(cls, course_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        course = cls.get_course_detail(course_id)
        if not course:
            raise ValueError(f"Course '{course_id}' not found.")

        mod_num = data.get("module_number")
        if mod_num is None:
            mod_num = len(course.get("modules", [])) + 1
        pos = data.get("position")
        if pos is None:
            pos = mod_num

        mod_id = data.get("id") or f"mod_{uuid.uuid4().hex[:8]}"
        title = data.get("title", f"Week {mod_num}").strip()
        desc = data.get("description", "")
        tools = data.get("tools", [])

        now = _now_iso()
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO course_modules (id, course_id, module_number, title, description, tools, position, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                    """, (mod_id, course_id, mod_num, title, desc, json.dumps(tools), pos, now))
        except Exception as e:
            logger.warning(f"NeonDB add_module error: {e}")

        store = cls._read_local_fallback()
        store["modules"][mod_id] = {
            "id": mod_id,
            "course_id": course_id,
            "module_number": mod_num,
            "title": title,
            "description": desc,
            "tools": tools,
            "position": pos,
            "created_at": now,
        }
        cls._write_local_fallback(store)

        return cls.get_course_detail(course_id)

    @classmethod
    def update_module(cls, module_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        title = data.get("title")
        desc = data.get("description")
        tools = data.get("tools")

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE course_modules
                        SET title = COALESCE(%s, title),
                            description = COALESCE(%s, description),
                            tools = COALESCE(%s::jsonb, tools)
                        WHERE id = %s
                    """, (title, desc, json.dumps(tools) if tools is not None else None, module_id))
        except Exception as e:
            logger.warning(f"NeonDB update_module error: {e}")

        store = cls._read_local_fallback()
        if module_id in store["modules"]:
            if title is not None:
                store["modules"][module_id]["title"] = title
            if desc is not None:
                store["modules"][module_id]["description"] = desc
            if tools is not None:
                store["modules"][module_id]["tools"] = tools
            cls._write_local_fallback(store)

        return {"success": True, "message": "Module updated."}

    @classmethod
    def delete_module(cls, module_id: str) -> Dict[str, Any]:
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM course_modules WHERE id = %s", (module_id,))
        except Exception as e:
            logger.warning(f"NeonDB delete_module error: {e}")

        store = cls._read_local_fallback()
        if module_id in store["modules"]:
            del store["modules"][module_id]
            store["classes"] = {k: v for k, v in store["classes"].items() if v.get("module_id") != module_id}
            cls._write_local_fallback(store)

        return {"success": True, "message": "Module deleted."}

    # ---------------- Class Management ----------------
    @classmethod
    def add_class(cls, module_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        # Find course_id
        course_id = data.get("course_id")
        if not course_id:
            store = cls._read_local_fallback()
            mod = store.get("modules", {}).get(module_id)
            if mod:
                course_id = mod.get("course_id")
            else:
                try:
                    with get_conn() as conn:
                        with conn.cursor() as cur:
                            cur.execute("SELECT course_id FROM course_modules WHERE id = %s", (module_id,))
                            row = cur.fetchone()
                            if row:
                                course_id = row[0]
                except Exception:
                    pass

        if not course_id:
            raise ValueError(f"Module '{module_id}' not found.")

        course = cls.get_course_detail(course_id)
        all_classes = [cl for m in course.get("modules", []) for cl in m.get("classes", [])]
        class_num = len(all_classes) + 1

        class_id = f"class_{uuid.uuid4().hex[:8]}"
        title = data.get("title", f"Class {class_num}").strip()
        slug = data.get("slug") or re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        desc = data.get("description", "")
        duration = data.get("duration", "60 min")
        lesson_content = data.get("lesson_content", f"# {title}\n\nWrite your lesson content in Markdown...")
        topics = data.get("topics", [])
        objectives = data.get("learning_objectives", [])
        diagrams = data.get("diagrams", [])
        code_examples = data.get("code_examples", [])
        quiz = data.get("quiz", [])
        skills = data.get("skills", [])
        now = _now_iso()

        new_class = {
            "id": class_id,
            "course_id": course_id,
            "module_id": module_id,
            "class_number": class_num,
            "slug": slug,
            "title": title,
            "short_title": data.get("short_title", title[:25]),
            "description": desc,
            "duration": duration,
            "position": len([cl for cl in all_classes if cl.get("module_id") == module_id]) + 1,
            "lesson_content": lesson_content,
            "topics": topics,
            "learning_objectives": objectives,
            "diagrams": diagrams,
            "code_examples": code_examples,
            "quiz": quiz,
            "skills": skills,
            "created_at": now,
            "updated_at": now,
        }

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO course_classes (id, course_id, module_id, class_number, slug, title, short_title,
                                                   description, duration, position, lesson_content, topics,
                                                   learning_objectives, diagrams, code_examples, quiz, skills,
                                                   created_at, updated_at)
                        VALUES (%(id)s, %(course_id)s, %(module_id)s, %(class_number)s, %(slug)s, %(title)s, %(short_title)s,
                                %(description)s, %(duration)s, %(position)s, %(lesson_content)s, %(topics)s::jsonb,
                                %(learning_objectives)s::jsonb, %(diagrams)s::jsonb, %(code_examples)s::jsonb,
                                %(quiz)s::jsonb, %(skills)s::jsonb, %(created_at)s, %(updated_at)s)
                    """, {
                        **new_class,
                        "topics": json.dumps(topics),
                        "learning_objectives": json.dumps(objectives),
                        "diagrams": json.dumps(diagrams),
                        "code_examples": json.dumps(code_examples),
                        "quiz": json.dumps(quiz),
                        "skills": json.dumps(skills),
                    })
        except Exception as e:
            logger.warning(f"NeonDB add_class error: {e}")

        store = cls._read_local_fallback()
        store["classes"][class_id] = new_class
        cls._write_local_fallback(store)

        return cls.get_course_detail(course_id)

    @classmethod
    def update_class(cls, class_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        allowed_fields = [
            "title", "short_title", "slug", "description", "duration", "lesson_content",
            "topics", "learning_objectives", "diagrams", "code_examples", "quiz", "skills"
        ]
        updates = {}
        for f in allowed_fields:
            if f in data:
                updates[f] = data[f]
        updates["updated_at"] = _now_iso()

        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    set_clauses = []
                    params = {"id": class_id}
                    for k, v in updates.items():
                        if k in ["topics", "learning_objectives", "diagrams", "code_examples", "quiz", "skills"]:
                            set_clauses.append(f"{k} = %({k})s::jsonb")
                            params[k] = json.dumps(v)
                        else:
                            set_clauses.append(f"{k} = %({k})s")
                            params[k] = v
                    cur.execute(f"UPDATE course_classes SET {', '.join(set_clauses)} WHERE id = %(id)s", params)
        except Exception as e:
            logger.warning(f"NeonDB update_class error: {e}")

        store = cls._read_local_fallback()
        if class_id in store["classes"]:
            store["classes"][class_id].update(updates)
            cls._write_local_fallback(store)

        return {"success": True, "message": "Class updated successfully.", "class_id": class_id}

    @classmethod
    def delete_class(cls, class_id: str) -> Dict[str, Any]:
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM course_classes WHERE id = %s", (class_id,))
        except Exception as e:
            logger.warning(f"NeonDB delete_class error: {e}")

        store = cls._read_local_fallback()
        if class_id in store["classes"]:
            del store["classes"][class_id]
            cls._write_local_fallback(store)

        return {"success": True, "message": "Class deleted."}

    # ---------------- Learner Curriculum & Lesson Serving ----------------
    @classmethod
    def get_dynamic_class_detail(cls, class_id_or_num: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a class and parses its lesson_content into full ClassDetail format:
        html, diagrams, toc, files, etc.
        Works for both dynamic string IDs and numeric IDs!
        """
        # Look in DB first
        target_class = None
        try:
            with get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    # Try matching by id, slug, or class_number
                    if str(class_id_or_num).isdigit():
                        cur.execute("""
                            SELECT * FROM course_classes
                            WHERE class_number = %s OR id = %s
                            LIMIT 1
                        """, (int(class_id_or_num), str(class_id_or_num)))
                    else:
                        cur.execute("""
                            SELECT * FROM course_classes
                            WHERE id = %s OR slug = %s
                            LIMIT 1
                        """, (str(class_id_or_num), str(class_id_or_num)))
                    row = cur.fetchone()
                    if row:
                        target_class = dict(row)
        except Exception as e:
            logger.warning(f"NeonDB get_dynamic_class_detail error: {e}")

        if not target_class:
            store = cls._read_local_fallback()
            for cl in store.get("classes", {}).values():
                if str(cl.get("id")) == str(class_id_or_num) or str(cl.get("slug")) == str(class_id_or_num) or (str(class_id_or_num).isdigit() and cl.get("class_number") == int(class_id_or_num)):
                    target_class = dict(cl)
                    break

        if not target_class:
            return None

        # Parse lesson content
        markdown_text = target_class.get("lesson_content") or f"# {target_class.get('title')}\n\nNo content available yet."
        html, extracted_diagrams, toc = _parse_markdown_doc(markdown_text)

        # Merge diagrams if custom diagrams were provided
        stored_diagrams = target_class.get("diagrams") or []
        if isinstance(stored_diagrams, str):
            try:
                stored_diagrams = json.loads(stored_diagrams)
            except Exception:
                stored_diagrams = []

        all_diagrams = extracted_diagrams if extracted_diagrams else stored_diagrams

        # Code files
        code_examples = target_class.get("code_examples") or []
        if isinstance(code_examples, str):
            try:
                code_examples = json.loads(code_examples)
            except Exception:
                code_examples = []
        code_files = [
            {"name": c.get("name", "script.py"), "lang": c.get("lang", "python"), "code": c.get("code", "")}
            for c in code_examples
        ]

        class_num = target_class.get("class_number", 1)

        return {
            "id": class_num,
            "title": target_class.get("title", ""),
            "short": target_class.get("short_title") or target_class.get("title", ""),
            "week": 1,
            "meta": {
                "course_id": target_class.get("course_id"),
                "duration": target_class.get("duration", "60 min"),
                "topics": target_class.get("topics", []),
                "quiz": target_class.get("quiz", []),
            },
            "html": html,
            "diagrams": all_diagrams,
            "toc": toc,
            "files": code_files,
            "folder": f"classes/dynamic_{target_class.get('id')}"
        }

    @classmethod
    def get_course_curriculum_overview(cls, course_id_or_slug: str) -> Optional[Dict[str, Any]]:
        course = cls.get_course_detail(course_id_or_slug)
        if not course:
            return None

        weeks = []
        classes_summary = {}
        all_tools = set()

        for mod in course.get("modules", []):
            mod_classes = mod.get("classes", [])
            class_ids = [c["class_number"] for c in mod_classes]
            tools = mod.get("tools") or []
            all_tools.update(tools)

            weeks.append({
                "n": mod.get("module_number", 1),
                "title": mod.get("title", f"Week {mod.get('module_number', 1)}"),
                "classes": class_ids,
                "summary": mod.get("description", ""),
                "tools": tools,
            })

            for cl in mod_classes:
                c_num = cl["class_number"]
                classes_summary[str(c_num)] = {
                    "id": c_num,
                    "title": cl.get("title", f"Class {c_num}"),
                    "short": cl.get("short_title", cl.get("title", "")),
                    "description": cl.get("description", ""),
                    "week": mod.get("module_number", 1),
                    "folder": f"dynamic_{cl.get('id')}"
                }

        return {
            "course": {
                "id": course["id"],
                "slug": course["slug"],
                "title": course["title"],
                "category": course.get("category", "Production AI"),
                "description": course.get("description", ""),
                "bannerImage": course.get("banner_image", "/course-enterprise-ai-banner.jpg"),
                "icon": course.get("icon", "🤖"),
                "status": course.get("status", "draft"),
            },
            "weeks": weeks,
            "classes": classes_summary,
            "capstones": CAPSTONES_CONFIG if course.get("slug") == "enterprise-ai" else [],
            "tools": sorted(list(all_tools))
        }
