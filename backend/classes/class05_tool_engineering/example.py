"""Class 5 - A tool-using AIOps agent in LangGraph with a human-approval interrupt.

Incident: "checkout-api 5xx errors are up". The agent investigates with read-only tools,
recovers from a bad argument, finds the culprit deploy, and proposes a rollback. The rollback
is a write tool, so the graph PAUSES (interrupt) until a human approves, then resumes.

Run:  python -m classes.class05_tool_engineering.example            # approve interactively
      python -m classes.class05_tool_engineering.example --approve  # auto-approve (CI)
"""
from __future__ import annotations

import json
import operator
import sys
from typing import Annotated, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from common.llm import get_llm
from common.tools import ToolRegistry

from .ops_tools import OPS_TOOLS

registry = ToolRegistry(approver=lambda t, a: True).register(*OPS_TOOLS)  # approval handled by graph

SYSTEM = """You are an SRE investigation agent. Find the root cause of the incident using the tools.
Prefer read-only tools. Propose a write action only with evidence, and explain it in one line.
Finish with: ROOT CAUSE, EVIDENCE, ACTION TAKEN."""


class State(TypedDict):
    incident: str
    steps: Annotated[list[dict], operator.add]
    pending: dict | None
    answer: str | None


# ----------------------------------------------------------------------------- offline policy
def offline_policy(steps: list[dict]) -> dict:
    """Deterministic stand-in for the model, including one realistic mistake + recovery."""
    done = [(s["tool"], s.get("ok", True)) for s in steps]
    plan = [
        ("get_metric", {"service": "checkout-api", "metric": "error_rate_pct"}),
        ("get_metric", {"service": "payments-svc", "metric": "errors"}),          # wrong name
        ("get_metric", {"service": "payments-svc", "metric": "error_rate_pct"}),  # recovered
        ("search_logs", {"service": "payments-svc", "level": "ERROR"}),
        ("get_recent_deploys", {"service": "payments-svc"}),
        ("rollback_deployment", {"service": "payments-svc", "to_version": "v2.13.4",
                                 "reason": "v2.14.0 cut DB pool 50->5; pool exhausted",
                                 "idempotency_key": "INC-4471-rollback-1"}),
    ]
    if len(done) < len(plan):
        name, args = plan[len(done)]
        return {"tool": name, "args": args}
    return {"final": ("ROOT CAUSE: payments-svc v2.14.0 reduced the DB connection pool from 50 to 5. "
                      "EVIDENCE: payments 5xx 0.2%->18% at the deploy time; HikariPool 'connection not "
                      "available' errors; checkout errors are downstream. ACTION TAKEN: rollback to "
                      "v2.13.4 submitted after human approval.")}


# ----------------------------------------------------------------------------- nodes
def agent(state: State) -> dict:
    msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": state["incident"]}]
    msgs += [{"role": "user", "content": f"{s['tool']}({s['args']}) -> {json.dumps(s['result'])[:800]}"}
             for s in state["steps"]]
    action = get_llm().next_action(msgs, registry.schemas(), fallback=lambda: offline_policy(state["steps"]))
    if "final" in action:
        return {"answer": action["final"], "pending": None}
    return {"pending": action}


def approval(state: State) -> dict:
    """Pause the graph for side-effecting tools. `interrupt` persists state in the checkpointer."""
    a = state["pending"]
    tool = registry.tools[a["tool"]]
    if not tool.requires_approval:
        return {}
    decision = interrupt({"tool": a["tool"], "args": a["args"], "risk": tool.risk})
    if decision != "approve":
        return {"steps": [{"tool": a["tool"], "args": a["args"], "ok": False,
                           "result": {"error": f"rejected by human: {decision}"}}], "pending": None}
    return {}


def tools(state: State) -> dict:
    a = state["pending"]
    if a is None:  # rejected in approval
        return {}
    r = registry.call(a["tool"], a["args"])
    return {"steps": [{"tool": a["tool"], "args": a["args"], "ok": r.ok,
                       "result": r.output if r.ok else {"error": r.error}}], "pending": None}


def build(checkpointer=None):
    g = StateGraph(State)
    g.add_node("agent", agent)
    g.add_node("approval", approval)
    g.add_node("tools", tools)
    g.add_edge(START, "agent")
    g.add_conditional_edges("agent", lambda s: END if s["answer"] or len(s["steps"]) > 10 else "approval")
    g.add_edge("approval", "tools")
    g.add_edge("tools", "agent")
    return g.compile(checkpointer=checkpointer or MemorySaver())


def main(auto_approve: bool) -> None:
    print("Tool schema the model sees (get_metric):")
    print(json.dumps(registry.tools["get_metric"].schema, indent=1)[:600], "…\n")
    app = build()
    cfg = {"configurable": {"thread_id": "INC-4471"}}
    state = {"incident": "INC-4471: checkout-api 5xx error rate above 5% since 10:30 UTC",
             "steps": [], "pending": None, "answer": None}
    result = app.invoke(state, cfg)
    while "__interrupt__" in result:
        req = result["__interrupt__"][0].value
        print(f"\n⏸  APPROVAL NEEDED: {req['tool']} {req['args']}  (risk={req['risk']})")
        decision = "approve" if auto_approve else (input("approve / reject reason > ").strip() or "approve")
        result = app.invoke(Command(resume=decision), cfg)
    for i, s in enumerate(result["steps"], 1):
        res = s["result"]
        brief = res.get("error") or {k: v for k, v in res.items() if k != "series"}
        print(f"{i}. {s['tool']}({s['args']})\n   -> {json.dumps(brief)[:220]}")
    print("\n" + result["answer"])


if __name__ == "__main__":
    main(auto_approve="--approve" in sys.argv or not sys.stdin.isatty())
