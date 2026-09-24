"""Class 5 - AIOps tools designed for LLMs.

Design rules applied to every tool below:
  1. One job per tool, named as a verb_noun the model can guess (get_metric, search_logs).
  2. Typed, constrained arguments (Literal enums) - the schema *is* the documentation.
  3. Docstrings say WHEN to use the tool and what it returns, with units.
  4. Outputs are small, pre-summarised JSON - never dump 10k log lines into the context.
  5. Errors are actionable text ("valid metrics are ...") so the model can self-correct.
  6. Side effects are marked (risk="write") and gated behind human approval.
  7. Idempotency keys on writes, so a retried call never restarts a service twice.

Compare with the anti-pattern at the bottom (`run_anything`).
"""
from __future__ import annotations

import statistics
from typing import Literal

from common.domain import load_telemetry
from common.tools import tool

Service = Literal["checkout-api", "payments-svc", "inventory-svc", "postgres-payments",
                  "redis-cache", "batch-worker"]

_EXECUTED: dict[str, dict] = {}   # idempotency store


@tool()
def get_metric(service: Service, metric: str) -> dict:
    """Get a summary of one metric for a service over the last hour (5-minute points).
    Use first when an alert fires, to see when and how much a signal changed.
    Returns baseline (first half mean), current (last point), change_ratio and the series."""
    m = load_telemetry()["metrics"][service]
    if metric not in m:
        raise ValueError(f"unknown metric '{metric}' for {service}; valid metrics: {sorted(m)}")
    s = m[metric]
    base = statistics.mean(s[: len(s) // 2])
    return {"service": service, "metric": metric, "baseline": round(base, 2), "current": s[-1],
            "change_ratio": round(s[-1] / base, 2) if base else None,
            "changed_at": _change_point(s), "series": s}


@tool()
def search_logs(service: Service, level: Literal["ERROR", "WARN", "INFO"] = "ERROR",
                contains: str = "", limit: int = 5) -> dict:
    """Search recent logs for a service by level and optional substring. Returns the count and
    up to `limit` distinct messages (deduplicated) - use to find the error signature."""
    logs = [l for l in load_telemetry()["logs"]
            if l["service"] == service and l["level"] == level and contains.lower() in l["msg"].lower()]
    distinct = list(dict.fromkeys(l["msg"] for l in logs))
    return {"service": service, "level": level, "count": len(logs), "samples": distinct[:limit]}


@tool()
def get_recent_deploys(service: Service, hours: int = 24) -> dict:
    """List deployments for a service in the last `hours`, newest first, with the change summary.
    Use to test the hypothesis 'a recent change caused this'."""
    ds = [d for d in load_telemetry()["deploys"] if d["service"] == service]
    return {"service": service, "deploys": sorted(ds, key=lambda d: d["ts"], reverse=True)}


@tool(risk="write")
def rollback_deployment(service: Service, to_version: str, reason: str, idempotency_key: str) -> dict:
    """Roll a service back to a previous version via the deploy pipeline. SIDE EFFECT - requires
    human approval. Only use after evidence links a specific deploy to the incident."""
    if idempotency_key in _EXECUTED:
        return {**_EXECUTED[idempotency_key], "note": "duplicate request ignored (idempotent)"}
    result = {"service": service, "rolled_back_to": to_version, "status": "submitted", "reason": reason}
    _EXECUTED[idempotency_key] = result
    return result


def _change_point(s: list[float]) -> int | None:
    """Index of the largest step change (simple, explainable change-point detection)."""
    diffs = [abs(s[i] - s[i - 1]) for i in range(1, len(s))]
    i = max(range(len(diffs)), key=diffs.__getitem__)
    return i + 1 if diffs[i] > 0.25 * (abs(statistics.mean(s)) or 1) else None


OPS_TOOLS = [get_metric, search_logs, get_recent_deploys, rollback_deployment]


# ----------------------------------------------------------------------------- anti-pattern
def run_anything(command: str) -> str:
    """Runs any shell or SQL command.   <- untyped, unbounded, unauditable, un-gateable.
    Never give an agent a tool like this in production."""
    raise NotImplementedError
