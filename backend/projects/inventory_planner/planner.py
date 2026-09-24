"""Inventory Planner agent - orchestrates the Forecaster and Supplier agents over A2A.

LangGraph workflow (checkpointed by A2A contextId):
  load positions -> forecast (A2A) -> supplier quotes (A2A) -> size orders per supplier option
  (lead-time-aware safety stock, order-up-to, MOQ) -> budget allocation -> approval
  (interrupt -> A2A "input-required") -> publish purchase orders + planner note

Serve:  uvicorn projects.inventory_planner.planner:app --port 8103
"""
from __future__ import annotations

import math
import os
from typing import TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from common.domain import load_inventory_json
from common.llm import get_llm

from .a2a import A2AClient, AgentCard, Skill, artifact_data, build_app

Z = {0.90: 1.282, 0.95: 1.645, 0.98: 2.054, 0.99: 2.326}


def urls() -> dict:
    return {"forecaster": os.getenv("FORECASTER_URL", "http://localhost:8101"),
            "supplier": os.getenv("SUPPLIER_URL", "http://localhost:8102")}


def client() -> A2AClient:
    return A2AClient(token=os.getenv("A2A_TOKEN"))


class PlanState(TypedDict, total=False):
    inventory: dict
    policy: dict
    peers: dict
    forecasts: dict
    lines: list[dict]
    plan: dict
    approval: dict
    purchase_orders: list[dict]
    note: str


def load(s: PlanState) -> dict:
    c = client()
    peers = {k: c.discover(u).model_dump(include={"name", "url", "skills"}) for k, u in urls().items()}
    return {"inventory": load_inventory_json("inventory"), "policy": load_inventory_json("policy"), "peers": peers}


def forecast(s: PlanState) -> dict:
    task = client().send(urls()["forecaster"], {"skus": list(s["inventory"]), "horizon_weeks": 8})
    return {"forecasts": artifact_data(task)["forecasts"]}


def size_orders(s: PlanState) -> dict:
    """For every supplier option, size the order with THAT option's lead time (safety stock grows
    with sqrt(lead time)), apply its MOQ, and keep the cheapest reliability-adjusted total.
    The supplier agent ranks by unit economics; the planner re-ranks by total cost of the plan."""
    pol, z = s["policy"], Z[s["policy"]["service_level"]]
    quotes = artifact_data(client().send(urls()["supplier"], {"items": [
        {"sku": k, "qty": sum(f["weekly_forecast"][:4])} for k, f in s["forecasts"].items()]}))["quotes"]
    lines = []
    for sku, inv in s["inventory"].items():
        f = s["forecasts"][sku]
        position = inv["on_hand"] + inv["on_order"]
        weekly = f["weekly_forecast"][0] or 1
        best = None
        for o in quotes[sku]["options"]:
            P = o["lead_time_weeks"] + pol["review_period_weeks"]
            demand_p = sum(f["weekly_forecast"][:P])
            ss = z * f["sigma_weekly"] * math.sqrt(P)
            need = max(0.0, demand_p + ss - position)
            units = max(math.ceil(need), o["moq_units"]) if need > 0 else 0
            score = units * o["effective_unit_cost"]
            cand = {"supplier": o, "lead_time_weeks": o["lead_time_weeks"], "demand_over_protection": round(demand_p),
                    "safety_stock": round(ss), "reorder_point": round(demand_p + ss), "need_units": math.ceil(need),
                    "order_units": units, "cost_usd": round(units * o["unit_price"], 2), "_score": score}
            if best is None or (score, o["lead_time_weeks"]) < (best["_score"], best["lead_time_weeks"]):
                best = cand
        best.pop("_score")
        if best["order_units"] == 0:
            best["supplier"] = None
        lines.append({"sku": sku, "name": inv["name"], "position": position,
                      "weeks_of_cover": round(position / weekly, 1), "backtest_mape": f["backtest_mape"], **best})
    return {"lines": lines}


def allocate_budget(s: PlanState) -> dict:
    """Fund the most urgent SKUs (lowest weeks of cover) first; defer what the budget can't cover."""
    budget, spent = s["policy"]["budget_usd"], 0.0
    for l in sorted(s["lines"], key=lambda l: l["weeks_of_cover"]):
        if l["order_units"] == 0:
            l["status"] = "no order (above reorder point)"
        elif spent + l["cost_usd"] <= budget:
            spent += l["cost_usd"]
            l["status"] = "order"
        else:
            l["status"] = "deferred (budget)"
    total = round(spent, 2)
    thr = s["policy"]["approval_threshold_usd"]
    return {"plan": {"total_usd": total, "budget_usd": budget, "requires_approval": total > thr,
                     "approval_threshold_usd": thr, "lines": s["lines"]}}


def approval(s: PlanState) -> dict:
    if not s["plan"]["requires_approval"]:
        return {"approval": {"approved": True, "by": "policy:auto (below threshold)"}}
    return {"approval": interrupt({"reason": f"total ${s['plan']['total_usd']:,.0f} exceeds "
                                             f"${s['plan']['approval_threshold_usd']:,.0f} approval threshold",
                                   "plan": s["plan"]})}


def publish(s: PlanState) -> dict:
    if not s["approval"].get("approved"):
        return {"purchase_orders": [], "note": f"Plan rejected by {s['approval'].get('by')}: "
                                               f"{s['approval'].get('reason', '')}"}
    pos = [{"po": f"PO-{i:04d}", "sku": l["sku"], "supplier_id": l["supplier"]["supplier_id"],
            "units": l["order_units"], "unit_price": l["supplier"]["unit_price"], "total_usd": l["cost_usd"],
            "eta_weeks": l["lead_time_weeks"]}
           for i, l in enumerate((l for l in s["plan"]["lines"] if l["status"] == "order"), 1001)]
    deferred = [l["sku"] for l in s["plan"]["lines"] if l["status"].startswith("deferred")]

    def offline():
        return (f"Raised {len(pos)} POs for ${sum(p['total_usd'] for p in pos):,.0f} "
                f"(approved by {s['approval'].get('by')}). Most urgent: "
                f"{min(s['plan']['lines'], key=lambda l: l['weeks_of_cover'])['sku']}. "
                f"Deferred for budget: {deferred or 'none'}.")
    note = get_llm().chat(f"Write a 3-sentence planner note for the supply chain lead: {pos} deferred={deferred}",
                          fallback=offline)
    return {"purchase_orders": pos, "note": note}


def build(checkpointer=None):
    g = StateGraph(PlanState)
    for n, fn in [("load", load), ("forecast", forecast), ("size_orders", size_orders),
                  ("allocate_budget", allocate_budget), ("approval", approval), ("publish", publish)]:
        g.add_node(n, fn)
    g.add_edge(START, "load")
    g.add_edge("load", "forecast")
    g.add_edge("forecast", "size_orders")
    g.add_edge("size_orders", "allocate_budget")
    g.add_edge("allocate_budget", "approval")
    g.add_edge("approval", "publish")
    g.add_edge("publish", END)
    return g.compile(checkpointer=checkpointer or MemorySaver())


GRAPH = build()


def handle(data: dict, ctx: str, tid: str | None):
    """A2A adapter: new context -> start plan; message with {'approval': ...} -> resume."""
    cfg = {"configurable": {"thread_id": ctx}}
    if "approval" in data:
        out = GRAPH.invoke(Command(resume=data["approval"]), cfg)
    else:
        out = GRAPH.invoke({}, cfg)
    if "__interrupt__" in out:
        req = out["__interrupt__"][0].value
        return "input-required", {"approval_request": req}, f"Approval needed: {req['reason']}"
    return "completed", {"plan": out["plan"], "purchase_orders": out["purchase_orders"], "note": out["note"],
                         "peers": out["peers"]}, out["note"]


CARD = AgentCard(
    name="Inventory Planner", url=os.getenv("PLANNER_URL", "http://localhost:8103"),
    description="Plans replenishment for medical supplies by coordinating forecasting and supplier agents.",
    skills=[Skill(id="plan_replenishment", name="Plan replenishment", tags=["planning", "supply-chain"],
                  description="Start with {} ; if input-required, reply in the same context with "
                              "{approval: {approved, by, reason}}. Output purchase orders + note.")])
app = build_app(CARD, handle, token=os.getenv("A2A_TOKEN"))
