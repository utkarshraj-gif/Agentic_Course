"""REST API for contract review.

  POST /reviews                {contract_id, text?}  -> runs review (pauses if escalated)
  GET  /reviews/{id}           summary + clauses + report path
  POST /reviews/{id}/signoff   {approved_by, decision} -> resumes escalated reviews
  GET  /reviews/{id}/report    markdown report

Run:  uvicorn projects.legal_contract_review.api:app --port 8002
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from langgraph.types import Command
from pydantic import BaseModel

from .graph import build

app = FastAPI(title="Contract Review Agent", version="1.0.0")
graph = build()


class ReviewRequest(BaseModel):
    contract_id: str
    text: str | None = None      # markdown with '## N. Title' sections; omit to use the sample library


class Signoff(BaseModel):
    approved_by: str
    decision: str


def _cfg(cid: str) -> dict:
    return {"configurable": {"thread_id": f"api-{cid}"}}


def _view(cid: str) -> dict:
    snap = graph.get_state(_cfg(cid))
    if not snap.values:
        raise HTTPException(404, "unknown review")
    v = snap.values
    return {"contract_id": cid, "waiting_for": list(snap.next), "summary": v.get("summary"),
            "clauses": v.get("clauses"), "report_path": v.get("report_path")}


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/reviews")
def create(req: ReviewRequest) -> dict:
    state = {"contract": req.contract_id, "clauses": []}
    if req.text:
        state["text"] = req.text
    graph.invoke(state, _cfg(req.contract_id))
    return _view(req.contract_id)


@app.get("/reviews/{cid}")
def get(cid: str) -> dict:
    return _view(cid)


@app.post("/reviews/{cid}/signoff")
def signoff(cid: str, body: Signoff) -> dict:
    if "counsel_signoff" not in _view(cid)["waiting_for"]:
        raise HTTPException(409, "review is not awaiting sign-off")
    graph.invoke(Command(resume=body.model_dump()), _cfg(cid))
    return _view(cid)


@app.get("/reviews/{cid}/report", response_class=PlainTextResponse)
def get_report(cid: str) -> str:
    path = _view(cid)["report_path"]
    if not path:
        raise HTTPException(409, "report not ready (awaiting sign-off?)")
    return Path(path).read_text()
