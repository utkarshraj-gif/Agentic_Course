"""AIOps service: Alertmanager-style webhook in, approvals via REST (or a ChatOps bot).

  POST /alerts                     {alerts:[...]} -> triage + investigate; pauses on approvals
  GET  /runs/{run_id}              incidents processed, pending approval
  POST /runs/{run_id}/approval     {approved, by, reason?} -> resume

Run:  uvicorn projects.aiops_agents.api:app --port 8003
"""
from __future__ import annotations

import uuid

from fastapi import FastAPI, HTTPException
from langgraph.types import Command
from pydantic import BaseModel

from common.domain import load_telemetry

from .supervisor import build

app = FastAPI(title="AIOps Agents", version="1.0.0")
graph = build()


class AlertBatch(BaseModel):
    alerts: list[dict] | None = None     # omit to replay the synthetic alert storm


class Approval(BaseModel):
    approved: bool
    by: str
    reason: str = ""


def _cfg(rid: str) -> dict:
    return {"configurable": {"thread_id": rid}}


def _view(rid: str) -> dict:
    snap = graph.get_state(_cfg(rid))
    if not snap.values:
        raise HTTPException(404, "unknown run")
    pending = [t.interrupts[0].value for t in snap.tasks if t.interrupts]
    v = snap.values
    return {"run_id": rid, "pending_approval": pending[0] if pending else None,
            "queued": [i["id"] for i in v.get("queue", [])],
            "done": [{"incident": d["incident"]["id"], "cause": d["hypothesis"]["cause"],
                      "action": d["plan"]["action"], "outcome": d["outcome"]} for d in v.get("done", [])]}


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/alerts")
def alerts(batch: AlertBatch) -> dict:
    rid = f"run-{uuid.uuid4().hex[:8]}"
    graph.invoke({"alerts": batch.alerts or load_telemetry()["alerts"], "queue": [], "done": []}, _cfg(rid))
    return _view(rid)


@app.get("/runs/{rid}")
def run(rid: str) -> dict:
    return _view(rid)


@app.post("/runs/{rid}/approval")
def approve(rid: str, body: Approval) -> dict:
    if not _view(rid)["pending_approval"]:
        raise HTTPException(409, "nothing awaiting approval")
    graph.invoke(Command(resume=body.model_dump()), _cfg(rid))
    return _view(rid)
