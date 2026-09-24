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
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(ddl)
    logger.info("NeonDB tables bootstrapped")
