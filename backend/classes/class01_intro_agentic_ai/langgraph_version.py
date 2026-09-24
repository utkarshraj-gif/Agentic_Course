"""Class 1 - The same ReAct agent expressed as a LangGraph state machine.

    START -> reason --(tool?)--> act -> reason ... --(final)--> END

Why a graph? The loop becomes explicit, inspectable state. You get checkpoints,
interrupts for human approval, streaming and retries for free - all used later in the course.

Run:  python -m classes.class01_intro_agentic_ai.langgraph_version
"""
from __future__ import annotations

import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph

from common.llm import get_llm

from .example import QUESTION, SYSTEM, offline_planner, registry


class AgentState(TypedDict):
    question: str
    observations: Annotated[list[dict], operator.add]   # reducer: append, never overwrite
    pending: dict | None
    answer: str | None
    steps: int


def reason(state: AgentState) -> dict:
    llm = get_llm()
    msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": state["question"]}]
    msgs += [{"role": "user", "content": f"Observation from {o['tool']}: {o['output']}"}
             for o in state["observations"]]
    action = llm.next_action(msgs, registry.schemas(), fallback=offline_planner(state["observations"]))
    if "final" in action:
        return {"answer": action["final"], "pending": None, "steps": state["steps"] + 1}
    return {"pending": action, "steps": state["steps"] + 1}


def act(state: AgentState) -> dict:
    a = state["pending"]
    res = registry.call(a["tool"], a["args"])
    return {"observations": [{"tool": a["tool"], "output": res.output if res.ok else {"error": res.error}}],
            "pending": None}


def route(state: AgentState) -> str:
    if state["answer"] or state["steps"] >= 6:
        return END
    return "act"


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("reason", reason)
    g.add_node("act", act)
    g.add_edge(START, "reason")
    g.add_conditional_edges("reason", route, {"act": "act", END: END})
    g.add_edge("act", "reason")
    return g.compile()


if __name__ == "__main__":
    app = build_graph()
    print(app.get_graph().draw_mermaid())          # the diagram in the README is generated from this
    for event in app.stream({"question": QUESTION, "observations": [], "pending": None,
                             "answer": None, "steps": 0}, stream_mode="updates"):
        for node, update in event.items():
            print(f"[{node}] {update}")
