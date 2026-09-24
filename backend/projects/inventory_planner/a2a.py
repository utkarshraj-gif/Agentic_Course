"""A minimal, spec-shaped implementation of the Agent2Agent (A2A) protocol.

A2A lets independently built agents (different teams, frameworks, vendors) collaborate:
  * discovery : each agent publishes an Agent Card at /.well-known/agent-card.json
                (name, description, url, skills, input/output modes, auth)
  * messaging : JSON-RPC 2.0 over HTTP - method "message/send" carries a Message made of Parts
                (text | data | file); the reply is a Task with a status and Artifacts
  * lifecycle : task states submitted -> working -> completed | failed | input-required ...
                "input-required" is how an agent asks its caller (or a human) for more input;
                the caller answers by sending another message with the same contextId/taskId.

This module keeps only what the course needs (no streaming / push notifications). For
production use the official SDK (`pip install a2a-sdk`) - the wire format is the same idea.
"""
from __future__ import annotations

import uuid
from typing import Callable

import httpx
from fastapi import FastAPI, Request
from pydantic import BaseModel, Field


class Skill(BaseModel):
    id: str
    name: str
    description: str
    tags: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)


class AgentCard(BaseModel):
    name: str
    description: str
    url: str
    version: str = "1.0.0"
    protocolVersion: str = "0.3.0"
    capabilities: dict = Field(default_factory=lambda: {"streaming": False, "pushNotifications": False})
    defaultInputModes: list[str] = Field(default_factory=lambda: ["application/json", "text/plain"])
    defaultOutputModes: list[str] = Field(default_factory=lambda: ["application/json"])
    skills: list[Skill]
    securitySchemes: dict = Field(default_factory=lambda: {"bearer": {"type": "http", "scheme": "bearer"}})


# handler(data, context_id, task_id) -> (state, result_data, message_text)
Handler = Callable[[dict, str, str | None], tuple[str, dict, str]]


def _task(task_id: str, context_id: str, state: str, data: dict, text: str) -> dict:
    return {"kind": "task", "id": task_id, "contextId": context_id,
            "status": {"state": state, "message": {"role": "agent", "kind": "message", "messageId": uuid.uuid4().hex,
                                                   "parts": [{"kind": "text", "text": text}]}},
            "artifacts": [{"artifactId": uuid.uuid4().hex, "name": "result", "parts": [{"kind": "data", "data": data}]}]}


def build_app(card: AgentCard, handler: Handler, token: str | None = None) -> FastAPI:
    app = FastAPI(title=card.name)

    @app.get("/.well-known/agent-card.json")
    @app.get("/.well-known/agent.json")          # older path, kept for compatibility
    def get_card() -> dict:
        return card.model_dump()

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    @app.post("/")
    async def rpc(req: Request) -> dict:
        body = await req.json()
        rid = body.get("id")
        if token and req.headers.get("authorization") != f"Bearer {token}":
            return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32001, "message": "unauthorized"}}
        if body.get("method") != "message/send":
            return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": "method not found"}}
        msg = body["params"]["message"]
        data = next((p["data"] for p in msg["parts"] if p.get("kind") == "data"), {})
        text = next((p["text"] for p in msg["parts"] if p.get("kind") == "text"), "")
        if text and not data:
            data = {"text": text}
        ctx = msg.get("contextId") or uuid.uuid4().hex
        tid = msg.get("taskId")
        try:
            state, result, note = handler(data, ctx, tid)
        except Exception as e:  # noqa: BLE001 - surface as a failed task, not a 500
            state, result, note = "failed", {"error": f"{type(e).__name__}: {e}"}, "task failed"
        return {"jsonrpc": "2.0", "id": rid, "result": _task(tid or uuid.uuid4().hex, ctx, state, result, note)}

    return app


class A2AClient:
    """Discover agents by URL and send them messages."""

    def __init__(self, token: str | None = None, transport: httpx.BaseTransport | None = None, timeout: float = 30):
        headers = {"authorization": f"Bearer {token}"} if token else {}
        self.http = httpx.Client(headers=headers, timeout=timeout, transport=transport)

    def discover(self, base_url: str) -> AgentCard:
        return AgentCard(**self.http.get(f"{base_url.rstrip('/')}/.well-known/agent-card.json").json())

    def send(self, base_url: str, data: dict, context_id: str | None = None, task_id: str | None = None) -> dict:
        msg = {"role": "user", "kind": "message", "messageId": uuid.uuid4().hex,
               "parts": [{"kind": "data", "data": data}]}
        if context_id:
            msg["contextId"] = context_id
        if task_id:
            msg["taskId"] = task_id
        r = self.http.post(base_url.rstrip("/") + "/", json={"jsonrpc": "2.0", "id": uuid.uuid4().hex,
                                                             "method": "message/send", "params": {"message": msg}})
        body = r.json()
        if "error" in body:
            raise RuntimeError(f"A2A error from {base_url}: {body['error']}")
        return body["result"]


def artifact_data(task: dict) -> dict:
    return task["artifacts"][0]["parts"][0]["data"]
