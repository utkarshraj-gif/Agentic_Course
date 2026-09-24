"""Class 7 - Running the same evaluation on LangSmith and Opik.

Both platforms give you hosted datasets, experiment comparison UIs, trace-linked results and
human annotation queues. The concepts are identical to eval_harness.py.

LangSmith:  pip install langsmith   export LANGSMITH_API_KEY=... LANGSMITH_TRACING=true
Opik:       pip install opik        export OPIK_API_KEY=...  (or `opik configure` for self-hosted)

Run:  python -m classes.class07_evaluation.vendor_integrations langsmith|opik
"""
from __future__ import annotations

import os
import sys

from common.domain import load_clinical_golden

from .example import CHUNKS, rag_target
from common.retrieval import HybridRetriever


def target_fn():
    hybrid = HybridRetriever(CHUNKS)
    return rag_target(lambda q, k: hybrid.search(q, k), 3)


def run_langsmith() -> None:
    from langsmith import Client, evaluate

    client = Client()
    name = "clinical-policy-qa"
    if not client.has_dataset(dataset_name=name):
        ds = client.create_dataset(name, description="Synthetic clinical policy golden set")
        client.create_examples(dataset_id=ds.id,
                               inputs=[{"q": g["q"]} for g in load_clinical_golden()],
                               outputs=[{"answer_contains": g["answer_contains"],
                                         "relevant_doc": g["relevant_doc"]} for g in load_clinical_golden()])
    t = target_fn()

    def correct(outputs: dict, reference_outputs: dict) -> bool:
        return all(s.lower() in outputs["answer"].lower() for s in reference_outputs["answer_contains"])

    def retrieval_hit(outputs: dict, reference_outputs: dict) -> bool:
        return any(s.startswith(reference_outputs["relevant_doc"]) for s in outputs["source_ids"])

    evaluate(lambda inputs: t({"q": inputs["q"]}), data=name,
             evaluators=[correct, retrieval_hit], experiment_prefix="hybrid-k3")


def run_opik() -> None:
    import opik
    from opik.evaluation import evaluate
    from opik.evaluation.metrics import Contains, base_metric, score_result

    client = opik.Opik()
    ds = client.get_or_create_dataset("clinical-policy-qa")
    ds.insert([{"q": g["q"], "reference": g["answer_contains"][0], "relevant_doc": g["relevant_doc"]}
               for g in load_clinical_golden()])
    t = target_fn()

    class RetrievalHit(base_metric.BaseMetric):
        def score(self, source_ids, relevant_doc, **_):
            return score_result.ScoreResult(name="retrieval_hit",
                                            value=float(any(s.startswith(relevant_doc) for s in source_ids)))

    def task(item: dict) -> dict:
        out = t({"q": item["q"]})
        return {"output": out["answer"], "source_ids": out["source_ids"], "reference": item["reference"],
                "relevant_doc": item["relevant_doc"]}

    evaluate(dataset=ds, task=task, scoring_metrics=[Contains(case_sensitive=False), RetrievalHit()],
             experiment_name="hybrid-k3")


if __name__ == "__main__":
    which = (sys.argv[1:] or ["langsmith"])[0]
    need = {"langsmith": "LANGSMITH_API_KEY", "opik": "OPIK_API_KEY"}[which]
    if not os.getenv(need):
        print(f"Set {need} to push this experiment to {which}. The offline harness is in example.py.")
        sys.exit(0)
    run_langsmith() if which == "langsmith" else run_opik()
