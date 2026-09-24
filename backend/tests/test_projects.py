import re

from fastapi.testclient import TestClient
from langgraph.types import Command

from common.domain import load_clause_labels, load_pa_requests, list_contracts


# ------------------------------------------------------------------ clinical
def test_prior_auth_recommendations_and_phi():
    from projects.clinical_prior_auth.run import process
    from projects.clinical_prior_auth.graph import build
    app = build()
    for req in load_pa_requests():
        out = process(app, req)
        assert out["assessment"]["recommendation"] == req["expected_decision"], req["request_id"]
        assert req["patient"]["name"] not in out["redacted_note"]
        assert req["patient"]["mrn"] not in out["redacted_note"]


def test_prior_auth_api_requires_physician_for_denial():
    from projects.clinical_prior_auth.api import app
    c = TestClient(app)
    req = next(r for r in load_pa_requests() if r["expected_decision"] == "deny")
    assert c.post("/prior-auth", json=req).json()["recommendation"] == "deny"
    assert c.post(f"/prior-auth/{req['request_id']}/review", json={"decision": "deny", "reviewer": "nurse"}).status_code == 403
    assert c.post(f"/prior-auth/{req['request_id']}/review",
                  json={"decision": "deny", "reviewer": "physician-1"}).json()["status"] == "closed:deny"


# ------------------------------------------------------------------ legal
def test_contract_review_accuracy_and_escalation():
    from projects.legal_contract_review.run import review
    from projects.legal_contract_review.graph import build
    app = build()
    labels = {(l["contract"], l["section"]): l for l in load_clause_labels()}
    ok = n = 0
    for c in list_contracts():
        out = review(app, c)
        if c == "acme-saas-msa":
            assert out["summary"]["escalate"] and out["summary"]["rating"] == "red"
        for cl in out["clauses"]:
            n += 1
            ok += cl["risk"] == labels[(c, cl["section"])]["risk"]
    assert ok / n >= 0.95


def test_contract_api_sanitises_ids():
    from projects.legal_contract_review.api import app
    c = TestClient(app)
    text = "counterparty: X\n\n# T\n\n## 1. Governing Law\n\nThis Agreement is governed by the laws of New York."
    v = c.post("/reviews", json={"contract_id": "../../evil", "text": text}).json()
    p = v["report_path"].replace("\\", "/")
    assert re.search(r"legal_reports/[\w\-_.]+\.md$", p) and ".." not in p.split("legal_reports/")[1]


# ------------------------------------------------------------------ aiops
def test_aiops_root_causes_and_approvals():
    from projects.aiops_agents.supervisor import build, initial_state
    app = build()
    cfg = {"configurable": {"thread_id": "test-storm"}}
    out = app.invoke(initial_state(), cfg)
    assert out["__interrupt__"][0].value["plan"]["action"] == "rollback"
    out = app.invoke(Command(resume={"approved": False, "by": "ic", "reason": "forward fix"}), cfg)
    assert out["dropped"] == ["AL-9007"]
    got = {d["hypothesis"]["origin_service"]: d for d in out["done"]}
    assert got["payments-svc"]["hypothesis"]["category"] == "bad_deploy"
    assert got["payments-svc"]["outcome"]["status"] == "not_executed"
    assert got["inventory-svc"]["hypothesis"]["category"] == "memory_leak"
    assert got["batch-worker"]["plan"]["action"] == "cleanup_disk"


def test_disk_cleanup_path_allow_list():
    from projects.aiops_agents.tools import make_registry
    reg = make_registry(approver=lambda t, a: True)
    r = reg.call("cleanup_disk", {"service": "batch-worker", "path": "/etc", "older_than_days": 7,
                                  "idempotency_key": "k1"})
    assert not r.ok and "allow-list" in r.error


# ------------------------------------------------------------------ inventory / A2A
def test_forecaster_backtest_quality():
    from projects.inventory_planner.forecaster import forecast
    f = forecast("SKU-GLV-001")
    assert f["backtest_mape"] < 0.15 and len(f["weekly_forecast"]) == 8


def test_planner_over_a2a_input_required_then_completed():
    from projects.inventory_planner.a2a import A2AClient, artifact_data
    from projects.inventory_planner.run import start_agents
    urls = start_agents({"forecaster": 8121, "supplier": 8122, "planner": 8123})
    c = A2AClient()
    assert c.discover(urls["planner"]).skills[0].id == "plan_replenishment"
    t = c.send(urls["planner"], {})
    assert t["status"]["state"] == "input-required"
    plan = artifact_data(t)["approval_request"]["plan"]
    assert plan["total_usd"] <= plan["budget_usd"]
    t = c.send(urls["planner"], {"approval": {"approved": True, "by": "lead"}}, t["contextId"], t["id"])
    assert t["status"]["state"] == "completed" and artifact_data(t)["purchase_orders"]
