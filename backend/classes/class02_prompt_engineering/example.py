"""Class 2 - Prompt engineering for a legal clause-triage agent.

Compares three prompt strategies on 20 labelled clauses from three synthetic contracts:
  A. zero-shot, free text          (what most people start with)
  B. zero-shot + JSON schema       (structured output, validated)
  C. few-shot  + JSON schema       (examples anchor type names and risk calibration)

Offline, every strategy falls back to the same keyword baseline, so the scores are identical -
set OPENAI_API_KEY to see the real differences between A, B and C.

Run:  python -m classes.class02_prompt_engineering.example
"""
from __future__ import annotations

from collections import Counter

from common.domain import (classify_clause_heuristic, load_clause_labels,
                           load_contract_sections)
from common.llm import get_llm

from .prompts import PROMPT_VERSION, ClauseAssessment, build_messages

RISK_HINTS = ["three (3) months", "ninety (90)", "fifteen (15) days", "1.5%", "any and all claims",
              "Provider may terminate for convenience", "reasonable time", "twenty-four (24) months",
              "commercially reasonable", "no obligation to indemnify"]


def offline_assessment(title: str, text: str) -> ClauseAssessment:
    ctype = classify_clause_heuristic(title, text)
    hit = next((h for h in RISK_HINTS if h.lower() in text.lower()), None)
    risk = "high" if hit else "low"
    if ctype == "non_solicitation" and hit:
        risk = "medium"
    return ClauseAssessment(clause_type=ctype, risk=risk, evidence=hit or text[:80],
                            reasoning="offline keyword baseline")


def run(strategy: str) -> dict:
    llm = get_llm()
    labels = load_clause_labels()
    type_ok = risk_ok = 0
    errors = Counter()
    for lab in labels:
        sec = next(s for s in load_contract_sections(lab["contract"]) if s["section"] == lab["section"])
        role = sec["meta"].get("our_role", "customer")
        fb = lambda: offline_assessment(sec["section"], sec["text"])  # noqa: E731
        if strategy == "A_zero_shot_text":
            reply = llm.chat(build_messages(sec["section"], sec["text"], role, few_shot=False)
                             + [{"role": "user", "content": "Answer as: TYPE | RISK"}],
                             fallback=lambda: f"{fb().clause_type} | {fb().risk}")
            parts = [p.strip().lower() for p in reply.split("|")] + ["", ""]
            pred_type, pred_risk = parts[0], parts[1]
        else:
            out = llm.structured(build_messages(sec["section"], sec["text"], role,
                                                few_shot=strategy.startswith("C")),
                                 ClauseAssessment, fallback=fb)
            pred_type, pred_risk = out.clause_type, out.risk
        type_ok += pred_type == lab["clause_type"]
        risk_ok += pred_risk == lab["risk"]
        if pred_type != lab["clause_type"]:
            errors[f"type: {lab['clause_type']} -> {pred_type}"] += 1
        if pred_risk != lab["risk"]:
            errors[f"risk: {lab['risk']} -> {pred_risk}"] += 1
    n = len(labels)
    return {"strategy": strategy, "type_acc": type_ok / n, "risk_acc": risk_ok / n, "errors": errors}


if __name__ == "__main__":
    print(f"LLM mode: {get_llm().mode} · prompt {PROMPT_VERSION}\n")
    print(f"{'strategy':<24}{'type acc':>10}{'risk acc':>10}")
    for s in ["A_zero_shot_text", "B_zero_shot_json", "C_few_shot_json"]:
        r = run(s)
        print(f"{r['strategy']:<24}{r['type_acc']:>10.0%}{r['risk_acc']:>10.0%}")
        for e, c in r["errors"].most_common(3):
            print(f"{'':<6}miss x{c}: {e}")
    print("\nSample prompt (strategy C) - system message:\n")
    print(build_messages("3. Limitation of Liability", "…", "customer")[0]["content"])
