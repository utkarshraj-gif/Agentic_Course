"""Run the prior-auth assistant on all synthetic requests.

The simulated reviewer accepts the AI recommendation (so we can measure recommendation
accuracy against expected decisions); use --interactive to make the decisions yourself.

Run:  python -m projects.clinical_prior_auth.run [--interactive] [--show PA-1001]
"""
from __future__ import annotations

import sys

from langgraph.types import Command

from common.domain import load_pa_requests
from common.llm import get_llm

from .graph import build


def process(app, req: dict, interactive: bool = False) -> dict:
    cfg = {"configurable": {"thread_id": req["request_id"]}}
    out = app.invoke({"request": req}, cfg)
    while "__interrupt__" in out:
        ask = out["__interrupt__"][0].value
        if interactive:
            print(f"\n{ask['request_id']} · AI recommends {ask['recommendation'].upper()} "
                  f"(needs {ask['required_reviewer']})\n{ask['rationale']}")
            d = input("decision [approve/pend/deny/redirect, enter = accept] > ").strip() or ask["recommendation"]
        else:
            d = ask["recommendation"]
        out = app.invoke(Command(resume={"decision": d, "reviewer": ask["required_reviewer"] + "-demo"}), cfg)
    return out


def main() -> None:
    interactive = "--interactive" in sys.argv
    show = sys.argv[sys.argv.index("--show") + 1] if "--show" in sys.argv else "PA-1001"
    app = build()
    print(f"LLM mode: {get_llm().mode}\n")
    print(f"{'request':<9}{'service':<42}{'AI rec':<10}{'expected':<10}{'PHI redacted':<22}guard")
    correct = 0
    results = {}
    for req in load_pa_requests():
        out = process(app, req, interactive)
        results[req["request_id"]] = out
        rec = out["assessment"]["recommendation"]
        correct += rec == req["expected_decision"]
        print(f"{req['request_id']:<9}{req['service'][:40]:<42}{rec:<10}{req['expected_decision']:<10}"
              f"{','.join(out['phi_findings']):<22}{'ok' if out['guard']['allowed'] else out['guard']['findings']}")
    print(f"\nrecommendation accuracy: {correct}/{len(results)}")
    o = results[show]
    print(f"\n--- {show} detail ---\nredacted note: {o['redacted_note'][:160]}…")
    print("facts:", {k: v for k, v in o["facts"].items() if v not in (None, [], {}) and k != "evidence"})
    print(f"rationale:\n{o['rationale']}\nletter: {o['letter']}\nstatus: {o['status']}")
    print("\naudit log -> runs/clinical_audit.jsonl")


if __name__ == "__main__":
    main()
