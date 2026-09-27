# backend/db/database.py
# NeonDB PostgreSQL connection and table bootstrap
# Replace DATABASE_URL env var to switch databases

import os
import logging
from contextlib import contextmanager
from typing import Generator

import psycopg2
import psycopg2.extras
from psycopg2.pool import SimpleConnectionPool

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_TJmqz6NBn5rP@ep-morning-frost-b50j0xjq-pooler.c-7.us-east-2.aws.neon.tech/Agentic%20Ai%20?sslmode=require&channel_binding=require"
)

_pool: SimpleConnectionPool | None = None


def get_pool() -> SimpleConnectionPool:
    global _pool
    if _pool is None:
        _pool = SimpleConnectionPool(minconn=1, maxconn=5, dsn=DATABASE_URL)
        logger.info("NeonDB connection pool created")
    return _pool


@contextmanager
def get_conn() -> Generator[psycopg2.extensions.connection, None, None]:
    pool = get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def init_db() -> None:
    """
    Create all required tables if they don't exist.
    Safe to call on every startup — uses IF NOT EXISTS.
    """
    ddl = """
    CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        email       TEXT NOT NULL UNIQUE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
        user_id     TEXT NOT NULL,
        class_id    INTEGER NOT NULL,
        completed   BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMPTZ,
        PRIMARY KEY (user_id, class_id)
    );

    CREATE TABLE IF NOT EXISTS quiz_results (
        user_id     TEXT NOT NULL,
        class_id    INTEGER NOT NULL,
        score       INTEGER NOT NULL,
        total       INTEGER NOT NULL,
        taken_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, class_id)
    );

    CREATE TABLE IF NOT EXISTS lab_progress (
        user_id     TEXT NOT NULL,
        lab_id      TEXT NOT NULL,
        completed   BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMPTZ,
        PRIMARY KEY (user_id, lab_id)
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
        user_id     TEXT NOT NULL,
        class_id    INTEGER NOT NULL,
        class_title TEXT,
        added_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, class_id)
    );

    CREATE TABLE IF NOT EXISTS project_progress (
        user_id     TEXT NOT NULL,
        slug        TEXT NOT NULL,
        started     BOOLEAN DEFAULT FALSE,
        started_at  TIMESTAMPTZ,
        PRIMARY KEY (user_id, slug)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL,
        type        TEXT NOT NULL,
        label       TEXT NOT NULL,
        class_id    INTEGER,
        logged_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS last_visited (
        user_id      TEXT PRIMARY KEY,
        class_id     INTEGER NOT NULL,
        class_title  TEXT NOT NULL,
        visited_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS courses (
        id                  TEXT PRIMARY KEY,
        slug                TEXT UNIQUE NOT NULL,
        title               TEXT NOT NULL,
        short_title         TEXT,
        category            TEXT NOT NULL DEFAULT 'Engineering',
        level               TEXT NOT NULL DEFAULT 'Intermediate',
        icon                TEXT DEFAULT '🤖',
        banner_image        TEXT,
        short_description   TEXT,
        description         TEXT NOT NULL,
        estimated_duration  TEXT DEFAULT '4 Weeks',
        estimated_hours     INTEGER DEFAULT 20,
        status              TEXT NOT NULL DEFAULT 'draft',
        tags                JSONB DEFAULT '[]'::jsonb,
        created_by          TEXT DEFAULT 'System Administrator',
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW(),
        published_at        TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS course_modules (
        id                  TEXT PRIMARY KEY,
        course_id           TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        module_number       INTEGER NOT NULL,
        title               TEXT NOT NULL,
        description         TEXT,
        tools               JSONB DEFAULT '[]'::jsonb,
        position            INTEGER NOT NULL DEFAULT 1,
        created_at          TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS course_classes (
        id                  TEXT PRIMARY KEY,
        course_id           TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        module_id           TEXT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
        class_number        INTEGER NOT NULL,
        slug                TEXT,
        title               TEXT NOT NULL,
        short_title         TEXT,
        description         TEXT,
        duration            TEXT DEFAULT '60 min',
        position            INTEGER NOT NULL DEFAULT 1,
        lesson_content      TEXT,
        topics              JSONB DEFAULT '[]'::jsonb,
        learning_objectives JSONB DEFAULT '[]'::jsonb,
        diagrams            JSONB DEFAULT '[]'::jsonb,
        code_examples       JSONB DEFAULT '[]'::jsonb,
        quiz                JSONB DEFAULT '[]'::jsonb,
        skills              JSONB DEFAULT '[]'::jsonb,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS course_enrollments (
        id                  SERIAL PRIMARY KEY,
        user_id             TEXT NOT NULL,
        course_id           TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        cohort              TEXT DEFAULT 'Enterprise Cohort',
        enrolled_at         TIMESTAMPTZ DEFAULT NOW(),
        status              TEXT DEFAULT 'active',
        UNIQUE (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS course_versions (
        id                  TEXT PRIMARY KEY,
        course_id           TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        version_number      TEXT NOT NULL,
        status              TEXT NOT NULL DEFAULT 'draft',
        created_by          TEXT DEFAULT 'System Administrator',
        change_summary      TEXT,
        snapshot_data       JSONB DEFAULT '{}'::jsonb,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        published_at        TIMESTAMPTZ,
        UNIQUE (course_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS content_reviews (
        id                  SERIAL PRIMARY KEY,
        course_id           TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        version_id          TEXT,
        entity_type         TEXT NOT NULL,
        entity_id           TEXT NOT NULL,
        author_name         TEXT NOT NULL,
        author_role         TEXT DEFAULT 'Reviewer',
        comment             TEXT NOT NULL,
        status              TEXT DEFAULT 'open',
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        resolved_at         TIMESTAMPTZ,
        resolved_by         TEXT
    );

    CREATE TABLE IF NOT EXISTS cohorts (
        id                  TEXT PRIMARY KEY,
        name                TEXT NOT NULL,
        description         TEXT,
        start_date          DATE,
        end_date            DATE,
        status              TEXT DEFAULT 'active',
        created_by          TEXT DEFAULT 'Enterprise Admin',
        created_at          TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cohort_members (
        id                  SERIAL PRIMARY KEY,
        cohort_id           TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
        user_id             TEXT NOT NULL,
        joined_at           TIMESTAMPTZ DEFAULT NOW(),
        status              TEXT DEFAULT 'active',
        UNIQUE (cohort_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS cohort_courses (
        id                  SERIAL PRIMARY KEY,
        cohort_id           TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
        course_id           TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        course_version_id   TEXT,
        start_date          DATE,
        deadline            DATE,
        assigned_at         TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (cohort_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS course_learning_rules (
        id                  SERIAL PRIMARY KEY,
        course_id           TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        rule_type           TEXT NOT NULL,
        target_entity_type  TEXT NOT NULL,
        target_entity_id    TEXT NOT NULL,
        config              JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_active           BOOLEAN DEFAULT TRUE,
        created_at          TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id                  SERIAL PRIMARY KEY,
        action              TEXT NOT NULL,
        actor_name          TEXT NOT NULL,
        actor_email         TEXT,
        actor_role          TEXT DEFAULT 'Admin',
        entity_type         TEXT NOT NULL,
        entity_id           TEXT NOT NULL,
        entity_name         TEXT,
        details             JSONB DEFAULT '{}'::jsonb,
        timestamp           TIMESTAMPTZ DEFAULT NOW()
    );
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(ddl)
    logger.info("NeonDB tables bootstrapped")
