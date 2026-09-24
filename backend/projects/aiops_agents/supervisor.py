"""AIOps supervisor: orchestrates the specialist agents as a LangGraph state machine.

  triage -> next_incident -> investigate -> plan_remediation -> approval? -> execute -> verify
         -> communicate -> next_incident ... -> END

The supervisor owns control flow and policy (loop, approvals, budgets); the agents own
expertise. Everything is checkpointed per run so an approval can arrive later.
"""
from __future__ import annotations

import json
import operator
from typing import Annotated, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from common import RUNS
from common.domain import load_telemetry
from common.tracing import traced

from .agents import (ActionPlan, CommsAgent, Hypothesis, Incident, InvestigatorAgent, RemediationAgent,
                     TriageAgent)
from .tools import make_registry

OUT = RUNS / "aiops"
REG = make_registry(approver=lambda t, a: True)      # approval is enforced by the graph interrupt


class OpsState(TypedDict, total=False):
    alerts: list[dict]
    queue: list[dict]
    dropped: list[str]
    current: dict | None
    hypothesis: dict
    plan: dict
    approval: dict
    outcome: dict
    done: Annotated[list[dict], operator.add]


@traced("aiops.triage", "agent")
def triage(s: OpsState) -> dict:
    incidents, dropped = TriageAgent().run(s["alerts"])
    return {"queue": [i.model_dump() for i in incidents], "dropped": dropped}


def next_incident(s: OpsState) -> dict:
    q = list(s["queue"])
    return {"current": q.pop(0) if q else None, "queue": q}


@traced("aiops.investigate", "agent")
def investigate(s: OpsState) -> dict:
    agent = InvestigatorAgent(REG)
    h = agent.run(Incident(**s["current"]))
    return {"hypothesis": {**h.model_dump(), "tool_calls": agent.calls}}


@traced("aiops.plan", "agent")
def plan_remediation(s: OpsState) -> dict:
    h = Hypothesis(**{k: v for k, v in s["hypothesis"].items() if k != "tool_calls"})
    return {"plan": RemediationAgent().run(Incident(**s["current"]), h).model_dump()}


def approval(s: OpsState) -> dict:
    p = s["plan"]
    if not p["requires_approval"]:
        return {"approval": {"approved": True, "by": "change-policy:auto"}}
    d = interrupt({"incident": s["current"]["id"], "severity": s["current"]["severity"],
                   "hypothesis": s["hypothesis"]["cause"], "plan": p})
    return {"approval": d}


@traced("aiops.execute", "tool")
def execute(s: OpsState) -> dict:
    p, a = s["plan"], s["approval"]
    if p["action"] == "escalate" or not a.get("approved"):
        return {"outcome": {"status": "not_executed", "reason": a.get("reason", "escalated to human")}}
    r = REG.call(p["action"], p["args"], actor=a.get("by", "unknown"))
    return {"outcome": r.output if r.ok else {"status": "failed", "error": r.error}}


def verify(s: OpsState) -> dict:
    """Simulated post-action check: in production, poll the same metrics until they recover or time out."""
    ok = s["outcome"].get("status") == "succeeded"
    return {"outcome": {**s["outcome"], "verified": ok,
                        "check": "error rate / memory / disk back within SLO" if ok else "not verified"}}


@traced("aiops.communicate", "agent")
def communicate(s: OpsState) -> dict:
    inc = Incident(**s["current"])
    h = Hypothesis(**{k: v for k, v in s["hypothesis"].items() if k != "tool_calls"})
    p = ActionPlan(**s["plan"])
    comms = CommsAgent()
    OUT.mkdir(parents=True, exist_ok=True)
    pm = comms.postmortem(inc, h, p, s["outcome"], s["approval"].get("by"))
    (OUT / f"{inc.id}-postmortem.md").write_text(pm)
    return {"done": [{"incident": inc.model_dump(), "hypothesis": s["hypothesis"], "plan": s["plan"],
                      "approval": s["approval"], "outcome": s["outcome"],
                      "status_update": comms.status_update(inc, h, p, s["outcome"]),
                      "postmortem": str(OUT / f"{inc.id}-postmortem.md")}]}


def build(checkpointer=None):
    g = StateGraph(OpsState)
    for name, fn in [("triage", triage), ("next_incident", next_incident), ("investigate", investigate),
                     ("plan_remediation", plan_remediation), ("approval", approval), ("execute", execute),
                     ("verify", verify), ("communicate", communicate)]:
        g.add_node(name, fn)
    g.add_edge(START, "triage")
    g.add_edge("triage", "next_incident")
    g.add_conditional_edges("next_incident", lambda s: "investigate" if s["current"] else END)
    g.add_edge("investigate", "plan_remediation")
    g.add_edge("plan_remediation", "approval")
    g.add_edge("approval", "execute")
    g.add_edge("execute", "verify")
    g.add_edge("verify", "communicate")
    g.add_edge("communicate", "next_incident")
    return g.compile(checkpointer=checkpointer or MemorySaver())


def initial_state() -> OpsState:
    return {"alerts": load_telemetry()["alerts"], "queue": [], "done": []}


if __name__ == "__main__":
    print(json.dumps(build().get_graph().draw_mermaid()))
