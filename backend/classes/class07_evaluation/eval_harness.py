"""Class 7 - A small, framework-agnostic evaluation harness.

Concepts map 1:1 onto LangSmith / Opik:
  Dataset (examples with inputs + reference outputs) -> Target (the system under test)
  -> Evaluators (functions returning named scores) -> Experiment (results + aggregates)
  -> Comparison / regression gate between two experiments.
"""
from __future__ import annotations

import json
import re
import statistics
import time
from dataclasses import dataclass, field
from typing import Callable

from common import RUNS
from common.retrieval import tokenize

Evaluator = Callable[[dict, dict], dict[str, float]]   # (example, output) -> {metric: score}


@dataclass
class Experiment:
    name: str
    rows: list[dict] = field(default_factory=list)

    @property
    def summary(self) -> dict[str, float]:
        keys = sorted({k for r in self.rows for k in r["scores"]})
        out = {k: round(statistics.mean(r["scores"][k] for r in self.rows if k in r["scores"]), 3) for k in keys}
        lat = sorted(r["latency_ms"] for r in self.rows)
        out["p50_latency_ms"] = lat[len(lat) // 2]
        out["p95_latency_ms"] = lat[min(len(lat) - 1, int(0.95 * len(lat)))]
        return out

    def save(self) -> None:
        RUNS.mkdir(exist_ok=True)
        (RUNS / f"eval_{self.name}.json").write_text(json.dumps(
            {"name": self.name, "summary": self.summary, "rows": self.rows}, indent=1, default=str))


def run_experiment(name: str, dataset: list[dict], target: Callable[[dict], dict],
                   evaluators: list[Evaluator]) -> Experiment:
    exp = Experiment(name)
    for ex in dataset:
        t0 = time.perf_counter()
        try:
            out, err = target(ex), None
        except Exception as e:  # noqa: BLE001 - a crash is a scored failure, not a harness crash
            out, err = {}, f"{type(e).__name__}: {e}"
        latency = round((time.perf_counter() - t0) * 1000, 2)
        scores: dict[str, float] = {"no_error": 0.0 if err else 1.0}
        if not err:
            for ev in evaluators:
                scores.update(ev(ex, out))
        exp.rows.append({"input": ex, "output": out, "error": err, "scores": scores, "latency_ms": latency})
    exp.save()
    return exp


def compare(base: Experiment, cand: Experiment, tolerance: float = 0.02) -> list[str]:
    """Regression gate: list metrics where the candidate is worse than baseline beyond tolerance."""
    regressions = []
    for k, v in base.summary.items():
        if "latency" in k:
            continue
        c = cand.summary.get(k)
        if c is not None and c < v - tolerance:
            regressions.append(f"{k}: {v} -> {c}")
    return regressions


# ----------------------------------------------------------------------------- reusable evaluators
def contains_reference(ex: dict, out: dict) -> dict:
    ans = out.get("answer", "").lower()
    return {"correct": float(all(s.lower() in ans for s in ex["answer_contains"]))}


def retrieval_hit(ex: dict, out: dict) -> dict:
    return {"retrieval_hit": float(any(s.startswith(ex["relevant_doc"]) for s in out.get("source_ids", [])))}


def citation_valid(ex: dict, out: dict) -> dict:
    cited = set(re.findall(r"\[([\w\-]+#\d+)\]", out.get("answer", "")))
    ok = bool(cited) and cited <= set(out.get("source_ids", []))
    return {"citations_valid": float(ok)}


def groundedness(ex: dict, out: dict) -> dict:
    """Share of answer sentences whose content words mostly appear in the retrieved context.
    A cheap proxy; Class 8 replaces it with an LLM judge."""
    ctx = set(tokenize(out.get("context", "")))
    sents = [s for s in re.split(r"(?<=[.!?])\s+", re.sub(r"\[[^\]]+\]", "", out.get("answer", ""))) if len(s) > 10]
    if not sents:
        return {"grounded": 0.0}
    ok = sum(len(set(tokenize(s)) & ctx) / max(1, len(set(tokenize(s)))) >= 0.6 for s in sents)
    return {"grounded": ok / len(sents)}


def trajectory_match(expected_tools: list[str], forbidden: list[str] | None = None) -> Evaluator:
    """Agent evaluator: did it call the required tools in order, avoid forbidden ones, stay efficient?"""
    def ev(ex: dict, out: dict) -> dict:
        calls = [c for c in out.get("tool_calls", [])]
        it = iter(calls)
        in_order = all(any(t == c for c in it) for t in expected_tools)
        return {"required_tools_in_order": float(in_order),
                "no_forbidden_tools": float(not set(forbidden or []) & set(calls)),
                "step_efficiency": min(1.0, len(expected_tools) / max(1, len(calls)))}
    return ev


def as_table(exps: list[Experiment]) -> str:
    keys = list(dict.fromkeys(k for e in exps for k in e.summary))
    lines = [f"{'metric':<26}" + "".join(f"{e.name:>18}" for e in exps)]
    for k in keys:
        lines.append(f"{k:<26}" + "".join(f"{e.summary.get(k, '-'):>18}" for e in exps))
    return "\n".join(lines)

