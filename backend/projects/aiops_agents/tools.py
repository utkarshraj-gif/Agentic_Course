"""Operations tools shared by the AIOps agents (read tools + gated actions).

Reads come from the synthetic telemetry snapshot; actions are simulated but go through the
same registry (validation, risk level, approval, idempotency, audit) you would use for real
Kubernetes / CI-CD / cloud APIs.
"""
from __future__ import annotations

import statistics
from typing import Literal

from common.domain import load_telemetry
from common.tools import ToolRegistry, tool

THRESHOLDS = {"memory_pct": 85, "disk_used_pct": 90}
EXECUTED: dict[str, dict] = {}


def topology() -> dict:
    return load_telemetry()["topology"]


def dependencies(service: str) -> list[str]:
    return topology()[service]["depends_on"]


@tool()
def metric_summary(service: str) -> dict:
    """All metrics for a service: baseline, current, change ratio, change-point index, anomaly flag."""
    tel = load_telemetry()
    out = {}
    for name, s in tel["metrics"][service].items():
        base = statistics.mean(s[:4]) or 1e-9
        ratio = round(s[-1] / base, 2)
        diffs = [abs(s[i] - s[i - 1]) for i in range(1, len(s))]
        cp = max(range(len(diffs)), key=diffs.__getitem__) + 1
        rising = all(s[i] >= s[i - 1] for i in range(1, len(s)))
        anomalous = (name in THRESHOLDS and s[-1] > THRESHOLDS[name]) or \
                    (name not in THRESHOLDS and name != "db_pool_max" and (ratio > 2.5 or ratio < 0.4))
        out[name] = {"baseline": round(base, 2), "current": s[-1], "ratio": ratio,
                     "changed_at": tel["timestamps"][cp], "steady_rise": rising, "anomalous": anomalous}
    return {"service": service, "metrics": out}


@tool()
def search_logs(service: str, level: Literal["ERROR", "WARN"] = "ERROR", limit: int = 3) -> dict:
    """Deduplicated log signatures (digits masked) with counts for a service and level."""
    import re
    counts: dict[str, int] = {}
    for l in load_telemetry()["logs"]:
        if l["service"] == service and l["level"] == level:
            sig = re.sub(r"\d+(\.\d+)?", "N", l["msg"])
            counts[sig] = counts.get(sig, 0) + 1
    top = sorted(counts.items(), key=lambda kv: -kv[1])[:limit]
    return {"service": service, "level": level, "signatures": [{"pattern": p, "count": c} for p, c in top]}


@tool()
def recent_deploys(service: str) -> dict:
    """Deployments of a service (newest first) with version, time and change summary."""
    ds = sorted((d for d in load_telemetry()["deploys"] if d["service"] == service), key=lambda d: d["ts"], reverse=True)
    return {"service": service, "deploys": ds}


@tool(risk="write")
def rollback(service: str, to_version: str, idempotency_key: str) -> dict:
    """Roll back a service to a previous version through the CD pipeline."""
    return _execute(idempotency_key, {"action": "rollback", "service": service, "to_version": to_version})


@tool(risk="write")
def rolling_restart(service: str, idempotency_key: str) -> dict:
    """Restart a service's instances one at a time (no downtime)."""
    return _execute(idempotency_key, {"action": "rolling_restart", "service": service})


@tool(risk="write")
def cleanup_disk(service: str, path: str, older_than_days: int, idempotency_key: str) -> dict:
    """Compress/delete rotated logs older than N days under an allow-listed path."""
    if not path.startswith("/var/log/"):
        raise PermissionError("path not in allow-list (/var/log/*)")
    return _execute(idempotency_key, {"action": "cleanup_disk", "service": service, "path": path,
                                      "older_than_days": older_than_days})


def _execute(key: str, action: dict) -> dict:
    if key in EXECUTED:
        return {**EXECUTED[key], "duplicate": True}
    EXECUTED[key] = {**action, "status": "succeeded"}
    return EXECUTED[key]


def make_registry(approver) -> ToolRegistry:
    return ToolRegistry(approver=approver).register(metric_summary, search_logs, recent_deploys,
                                                    rollback, rolling_restart, cleanup_disk)
