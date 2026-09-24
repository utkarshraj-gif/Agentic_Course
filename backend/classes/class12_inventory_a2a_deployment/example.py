"""Class 12 - The A2A protocol on the wire.

Starts the three Inventory Planner agents, then shows the raw JSON a client sends and receives:
Agent Card discovery, a message/send request, an input-required task, and the follow-up
message that resumes it. Also shows an auth failure when a bearer token is required.

Run:  python -m classes.class12_inventory_a2a_deployment.example
"""
from __future__ import annotations

import json
import uuid

import httpx

from projects.inventory_planner.run import start_agents


def show(title: str, obj: dict, limit: int = 900) -> None:
    text = json.dumps(obj, indent=1)
    print(f"\n--- {title} ---\n{text[:limit]}{' …' if len(text) > limit else ''}")


def rpc(url: str, data: dict, context_id: str | None = None, task_id: str | None = None, headers=None) -> dict:
    msg = {"role": "user", "kind": "message", "messageId": uuid.uuid4().hex, "parts": [{"kind": "data", "data": data}]}
    if context_id:
        msg.update(contextId=context_id, taskId=task_id)
    req = {"jsonrpc": "2.0", "id": 1, "method": "message/send", "params": {"message": msg}}
    return req, httpx.post(url + "/", json=req, headers=headers or {}, timeout=30).json()


if __name__ == "__main__":
    urls = start_agents({"forecaster": 8111, "supplier": 8112, "planner": 8113})
    show("1. Agent Card (GET /.well-known/agent-card.json)", httpx.get(urls["planner"] + "/.well-known/agent-card.json").json())

    req, res = rpc(urls["forecaster"], {"sku": "SKU-GLV-001", "horizon_weeks": 4})
    show("2. JSON-RPC request to the Forecaster", req)
    show("3. Task returned (state=completed, artifact=data part)", res["result"])

    _, res = rpc(urls["planner"], {})
    task = res["result"]
    print(f"\n--- 4. Planner task state: {task['status']['state']} · "
          f"{task['status']['message']['parts'][0]['text']} ---")

    req, res = rpc(urls["planner"], {"approval": {"approved": True, "by": "supply-chain-lead"}},
                   context_id=task["contextId"], task_id=task["id"])
    show("5. Follow-up message in the SAME contextId/taskId", req["params"]["message"], 400)
    pos = res["result"]["artifacts"][0]["parts"][0]["data"]["purchase_orders"]
    print(f"\n--- 6. Resumed task state: {res['result']['status']['state']} · {len(pos)} purchase orders ---")

    # auth: agents started with A2A_TOKEN reject calls without the bearer token
    from projects.inventory_planner.a2a import build_app
    from projects.inventory_planner.forecaster import CARD, handle
    from fastapi.testclient import TestClient
    secured = TestClient(build_app(CARD, handle, token="s3cret"))
    body = {"jsonrpc": "2.0", "id": 9, "method": "message/send",
            "params": {"message": {"role": "user", "messageId": "x", "parts": [{"kind": "data", "data": {"sku": "SKU-GLV-001"}}]}}}
    print("\n--- 7. Without token:", secured.post("/", json=body).json()["error"],
          "· with token:", secured.post("/", json=body, headers={"authorization": "Bearer s3cret"}).json()["result"]["status"]["state"])
