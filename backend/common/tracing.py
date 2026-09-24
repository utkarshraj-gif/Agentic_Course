"""Minimal tracing (Class 11) that mirrors how LangSmith / Opik / OpenTelemetry model a run:
a trace is a tree of spans, each with inputs, outputs, timing, and metadata.

Everything is written to runs/traces.jsonl so the eval + error-analysis classes (7, 8) can
read real traces. If LANGSMITH_API_KEY or OPIK_API_KEY is set, `traced` also wraps the
function with that vendor's decorator so the same run shows up in their UI.
"""
from __future__ import annotations

import contextvars
import functools
import json
import os
import time
import uuid
from pathlib import Path

TRACE_FILE = Path(os.getenv("TRACE_FILE", Path(__file__).resolve().parents[1] / "runs" / "traces.jsonl"))
_current = contextvars.ContextVar("span", default=None)


def _short(v, n=600):
    s = v if isinstance(v, str) else json.dumps(v, default=str)
    return s if len(s) <= n else s[:n] + "…"


class Span:
    def __init__(self, name: str, kind: str = "chain", **meta):
        self.id = uuid.uuid4().hex[:12]
        parent = _current.get()
        self.parent_id = parent.id if parent else None
        self.trace_id = parent.trace_id if parent else self.id
        self.name, self.kind, self.meta = name, kind, meta
        self.inputs = self.outputs = self.error = None

    def __enter__(self):
        self._tok = _current.set(self)
        self.start = time.time()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.end = time.time()
        if exc:
            self.error = f"{exc_type.__name__}: {exc}"
        _current.reset(self._tok)
        TRACE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with TRACE_FILE.open("a") as f:
            f.write(json.dumps({
                "trace_id": self.trace_id, "span_id": self.id, "parent_id": self.parent_id,
                "name": self.name, "kind": self.kind, "start": self.start,
                "latency_ms": round((self.end - self.start) * 1000, 2),
                "inputs": _short(self.inputs), "outputs": _short(self.outputs),
                "error": self.error, "meta": self.meta}, default=str) + "\n")
        return False


def traced(name: str | None = None, kind: str = "chain"):
    """Decorator that records a span for every call."""
    def deco(fn):
        span_name = name or fn.__name__

        @functools.wraps(fn)
        def inner(*args, **kwargs):
            with Span(span_name, kind) as sp:
                sp.inputs = {"args": [a for a in args if isinstance(a, (str, int, float, dict, list))],
                             "kwargs": kwargs}
                out = fn(*args, **kwargs)
                sp.outputs = out
                return out

        wrapped = inner
        if os.getenv("LANGSMITH_API_KEY"):
            from langsmith import traceable
            wrapped = traceable(name=span_name, run_type=kind if kind in {"llm", "tool", "retriever", "chain"} else "chain")(inner)
        elif os.getenv("OPIK_API_KEY"):
            from opik import track
            wrapped = track(name=span_name)(inner)
        return wrapped
    return deco


def load_traces(path: Path = TRACE_FILE) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
