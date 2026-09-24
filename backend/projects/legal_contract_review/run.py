"""Review all synthetic contracts, evaluate against labelled clauses, write reports.

Run:  python -m projects.legal_contract_review.run
"""
from __future__ import annotations

from langgraph.types import Command

from common.domain import list_contracts, load_clause_labels
from common.llm import get_llm

from .graph import build


def review(app, contract: str, counsel: str = "senior-counsel-demo") -> dict:
    cfg = {"configurable": {"thread_id": f"review-{contract}"}}
    out = app.invoke({"contract": contract, "clauses": []}, cfg)
    while "__interrupt__" in out:
        out = app.invoke(Command(resume={"approved_by": counsel, "decision": "negotiate redlines"}), cfg)
    return out


def main() -> None:
    print(f"LLM mode: {get_llm().mode}\n")
    app = build()
    labels = {(l["contract"], l["section"]): l for l in load_clause_labels()}
    type_ok = risk_ok = n = 0
    for contract in list_contracts():
        out = review(app, contract)
        sm = out["summary"]
        print(f"{contract:<18} rating={sm['rating']:<6} score={sm['risk_score']:<3} high={sm['high']} "
              f"medium={sm['medium']} escalate={sm['escalate']}  -> {out['report_path'].split('agentic-ai-course/')[-1]}")
        for c in out["clauses"]:
            lab = labels.get((contract, c["section"]))
            if lab:
                n += 1
                type_ok += c["clause_type"] == lab["clause_type"]
                risk_ok += c["risk"] == lab["risk"]
    print(f"\nclause type accuracy {type_ok}/{n} · risk accuracy {risk_ok}/{n}")
    print("\n--- excerpt: runs/legal_reports/acme-saas-msa.md ---")
    from common import RUNS
    print("\n".join((RUNS / "legal_reports" / "acme-saas-msa.md").read_text().splitlines()[:22]))


if __name__ == "__main__":
    main()
