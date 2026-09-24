"""Class 11 - Turn raw spans into an operations view: latency by stage, error and guardrail
rates, and a tree view of the most recent trace.

Run:  python -m classes.class11_observability_guardrails.trace_report
"""
from __future__ import annotations

import json
import statistics
from collections import defaultdict

from common.tracing import load_traces


def pct(values: list[float], p: float) -> float:
    v = sorted(values)
    return v[min(len(v) - 1, int(p * (len(v) - 1)))]


def main() -> None:
    spans = [s for s in load_traces() if s["meta"].get("app") == "clinical-qa" or s["parent_id"]]
    roots = [s for s in spans if s["name"] == "clinical_assistant"]
    if not roots:
        print("no traces yet - run guarded_pipeline.py first")
        return
    root_ids = {r["trace_id"] for r in roots}
    spans = [s for s in spans if s["trace_id"] in root_ids]

    by_name = defaultdict(list)
    for s in spans:
        by_name[s["name"]].append(s["latency_ms"])
    print(f"{len(roots)} requests · {len(spans)} spans\n")
    print(f"{'stage':<20}{'count':>6}{'p50 ms':>9}{'p95 ms':>9}")
    for name, lat in by_name.items():
        print(f"{name:<20}{len(lat):>6}{statistics.median(lat):>9.2f}{pct(lat, .95):>9.2f}")

    statuses = defaultdict(int)
    for r in roots:
        try:
            statuses[json.loads(r["outputs"])["status"]] += 1
        except (TypeError, ValueError, KeyError):
            statuses["unknown"] += 1
    print("\noutcomes:", dict(statuses), f"· block+review rate "
          f"{(statuses['blocked'] + statuses['human_review']) / len(roots):.0%}")

    last = roots[-1]["trace_id"]
    tree = [s for s in spans if s["trace_id"] == last]
    print(f"\nlatest trace {last}:")
    for s in sorted(tree, key=lambda s: s["start"]):
        indent = "  " if s["parent_id"] else ""
        print(f"  {indent}{s['name']:<20} {s['kind']:<10} {s['latency_ms']:>7.2f} ms  {str(s['outputs'])[:70]}")


if __name__ == "__main__":
    main()
