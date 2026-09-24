"""REST API for the prior-auth assistant (FastAPI).

  POST /prior-auth                 submit a request -> runs until human review
  GET  /prior-auth/{id}            current state (recommendation, rationale, status)
  POST /prior-auth/{id}/review     reviewer decision -> resumes the graph -> letter + audit

Production swaps MemorySaver for a durable checkpointer (Postgres/Redis) so a review can
happen hours later on another replica.

Run:  uvicorn projects.clinical_prior_auth.api:app --port 8001
"""
from __future__ import annotations

from typing import Literal

from fastapi import FastAPI, HTTPException
from langgraph.types import Command
from pydantic import BaseModel

from .graph import build

app = FastAPI(title="Clinical Prior-Auth Assistant", version="1.0.0")
graph = build()


class Review(BaseModel):
    decision: Literal["approve", "pend", "deny", "redirect"]
    reviewer: str


def _cfg(rid: str) -> dict:
    return {"configurable": {"thread_id": rid}}


def _view(rid: str) -> dict:
    snap = graph.get_state(_cfg(rid))
    if not snap.values:
        raise HTTPException(404, f"unknown request {rid}")
    v = snap.values
    return {"request_id": rid, "status": v.get("status"), "waiting_for": list(snap.next),
            "recommendation": v.get("assessment", {}).get("recommendation"),
            "criteria": v.get("assessment", {}).get("criteria"), "rationale": v.get("rationale"),
            "guard": v.get("guard"), "letter": v.get("letter")}


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/prior-auth")
def submit(request: dict) -> dict:
    rid = request.get("request_id")
    if not rid:
        raise HTTPException(422, "request_id required")
    graph.invoke({"request": request}, _cfg(rid))
    return _view(rid)


@app.get("/prior-auth/{rid}")
def get(rid: str) -> dict:
    return _view(rid)


@app.post("/prior-auth/{rid}/review")
def review(rid: str, body: Review) -> dict:
    view = _view(rid)
    if "human_review" not in view["waiting_for"]:
        raise HTTPException(409, "request is not awaiting review")
    if body.decision == "deny" and not body.reviewer.startswith("physician"):
        raise HTTPException(403, "denials must be issued by a physician reviewer")
    graph.invoke(Command(resume=body.model_dump()), _cfg(rid))
    return _view(rid)
