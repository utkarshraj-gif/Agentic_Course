"""Class 8 - Error analysis, then an LLM judge aligned to human labels.

Step 1  Open coding   : read each failing trace, write a free-text note (done: human_note).
Step 2  Axial coding  : group notes into a failure taxonomy and count -> what to fix first.
Step 3  Judge         : automate the taxonomy as a rubric-based judge.
Step 4  Alignment     : measure judge vs human (accuracy, Cohen's kappa, TPR, TNR) and read
                        every disagreement before trusting the judge at scale.

Run:  python -m classes.class08_error_analysis_judge.example
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from common.llm import get_llm

from .judge import judge

SAMPLES = json.loads((Path(__file__).parent / "samples.json").read_text())

# axial coding: map free-text notes to failure categories (+ severity for prioritisation)
TAXONOMY = {
    "wrong_document": (["wrong document", "globex contract"], 3),
    "hallucinated_value": (["invented", "not in context"], 3),
    "missing_citation": (["no citation", "citation to missing", "not retrieved"], 2),
    "policy_violation": (["legal advice", "overconfident"], 3),
    "incomplete": (["incomplete", "did not answer"], 2),
    "contradiction": (["reversed", "contradicts", "wrong verdict"], 3),
}


def code_note(note: str) -> list[str]:
    return [cat for cat, (kws, _) in TAXONOMY.items() if any(k in note.lower() for k in kws)] or ["other"]


def cohen_kappa(a: list[str], b: list[str]) -> float:
    labels = sorted(set(a) | set(b))
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n
    pe = sum((a.count(l) / n) * (b.count(l) / n) for l in labels)
    return (po - pe) / (1 - pe) if pe < 1 else 1.0


def main() -> None:
    print(f"LLM mode: {get_llm().mode}\n")
    fails = [s for s in SAMPLES if s["human"] == "fail"]
    print(f"== Error analysis: {len(fails)}/{len(SAMPLES)} traces failed human review ==")
    counts = Counter(cat for s in fails for cat in code_note(s["human_note"]))
    print(f"{'failure mode':<22}{'count':>6}{'severity':>10}{'priority':>10}")
    for cat, n in sorted(counts.items(), key=lambda kv: -kv[1] * TAXONOMY.get(kv[0], ([], 1))[1]):
        sev = TAXONOMY.get(cat, ([], 1))[1]
        print(f"{cat:<22}{n:>6}{sev:>10}{n * sev:>10}")

    print("\n== Judge vs human labels ==")
    human, pred, disagreements = [], [], []
    for s in SAMPLES:
        j = judge(s["question"], s["context_ids"], s["answer"])
        h = s["human"].upper()
        human.append(h)
        pred.append(j.verdict)
        if h != j.verdict:
            disagreements.append((s, j))
    tp = sum(h == "FAIL" and p == "FAIL" for h, p in zip(human, pred))
    tn = sum(h == "PASS" and p == "PASS" for h, p in zip(human, pred))
    n_fail, n_pass = human.count("FAIL"), human.count("PASS")
    print(f"accuracy {sum(h == p for h, p in zip(human, pred)) / len(human):.0%} · "
          f"Cohen's kappa {cohen_kappa(human, pred):.2f} · "
          f"TPR (catches failures) {tp / n_fail:.0%} · TNR (passes good answers) {tn / n_pass:.0%}")
    print("\nconfusion       judge PASS  judge FAIL")
    print(f"human PASS      {tn:>10}  {n_pass - tn:>10}")
    print(f"human FAIL      {n_fail - tp:>10}  {tp:>10}")
    print("\nDisagreements (read these - they tell you how to fix the rubric):")
    for s, j in disagreements:
        print(f"  {s['id']} human={s['human'].upper()} judge={j.verdict} · note: {s['human_note']} · judge: {j.rationale}")


if __name__ == "__main__":
    main()
