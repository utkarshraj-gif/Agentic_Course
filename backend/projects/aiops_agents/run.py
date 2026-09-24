"""Run the AIOps multi-agent system over the synthetic alert storm.

Run:  python -m projects.aiops_agents.run              # auto-approve as the on-call (demo)
      python -m projects.aiops_agents.run --interactive
"""
from __future__ import annotations

import sys

from langgraph.types import Command

from common.llm import get_llm

from .supervisor import REG, build, initial_state

EXPECTED = {"payments-svc": "bad_deploy", "inventory-svc": "memory_leak", "batch-worker": "disk_growth"}


def main() -> None:
    interactive = "--interactive" in sys.argv
    print(f"LLM mode: {get_llm().mode}\n")
    app = build()
    cfg = {"configurable": {"thread_id": "alert-storm-2026-09-18"}}
    st = initial_state()
    print(f"{len(st['alerts'])} alerts received")
    out = app.invoke(st, cfg)
    while "__interrupt__" in out:
        req = out["__interrupt__"][0].value
        print(f"\n[PAUSE] APPROVAL [{req['severity']}] {req['incident']}: {req['plan']['action']} {req['plan']['args']}"
              f"\n   because: {req['hypothesis']}")
        if interactive:
            ans = input("approve? [y/N] > ").strip().lower() == "y"
            decision = {"approved": ans, "by": "oncall-you", "reason": "" if ans else "rejected"}
        else:
            decision = {"approved": True, "by": "oncall-demo"}
        out = app.invoke(Command(resume=decision), cfg)

    print(f"\ntriage: deduplicated {out['dropped']} · {len(out['done'])} incidents\n")
    correct = 0
    for d in out["done"]:
        inc, h, p, o = d["incident"], d["hypothesis"], d["plan"], d["outcome"]
        correct += EXPECTED.get(h["origin_service"]) == h["category"]
        print(f"{inc['id']} [{inc['severity']}] {inc['title']}")
        print(f"   root cause  : {h['origin_service']} · {h['category']} ({h['confidence']:.0%}) - {h['cause']}")
        print(f"   tools used  : {' -> '.join(h['tool_calls'])}")
        print(f"   remediation : {p['action']} via {p['runbook']} · approval by {d['approval'].get('by')}"
              f" · {o.get('status')} · verified={o.get('verified')}")
        print(f"   status      : {d['status_update']}")
        print(f"   postmortem  : {d['postmortem'].split('agentic-ai-course/')[-1]}\n")
    print(f"root-cause accuracy: {correct}/{len(out['done'])}")
    print(f"audit trail: {len(REG.audit)} tool calls, "
          f"{sum(1 for a in REG.audit if a['tool'] in ('rollback', 'rolling_restart', 'cleanup_disk'))} write actions")


if __name__ == "__main__":
    main()
