"""Class 7 - Evaluate (1) the clinical RAG assistant and (2) the AIOps tool-using agent.

Part 1 - RAG experiment: baseline (dense, k=1) vs candidate (hybrid + rerank, k=3) on the
         10-question clinical golden set. Metrics: retrieval_hit, correct, citations_valid,
         grounded, no_error, latency. A regression gate compares the two.
Part 2 - Agent trajectory eval: did the Class 5 agent use the required tools in order, avoid
         forbidden writes, and do it efficiently?

Run:  python -m classes.class07_evaluation.example
"""
from __future__ import annotations

from common import DATA
from common.domain import load_clinical_golden
from common.llm import get_llm
from common.retrieval import (HybridRetriever, VectorIndex, chunk_markdown, extractive_answer,
                              format_context, load_markdown_dir)

from classes.class03_embeddings_rag.example import GROUNDED_PROMPT

from .eval_harness import (as_table, citation_valid, compare, contains_reference, groundedness,
                           retrieval_hit, run_experiment, trajectory_match)

CHUNKS = [c for d, t in load_markdown_dir(DATA / "clinical" / "guidelines") for c in chunk_markdown(d, t, 700)]


def rag_target(retriever, k: int):
    def target(ex: dict) -> dict:
        results = retriever(ex["q"], k)
        ctx = format_context(results)
        ans = get_llm().chat(GROUNDED_PROMPT.format(context=ctx, question=ex["q"]),
                             fallback=lambda: extractive_answer(ex["q"], results, n=2))
        return {"answer": ans, "context": ctx, "source_ids": [c.id for c, _ in results]}
    return target


def part1() -> None:
    dense, hybrid = VectorIndex(CHUNKS), HybridRetriever(CHUNKS)
    gold = load_clinical_golden()
    evaluators = [retrieval_hit, contains_reference, citation_valid, groundedness]
    base = run_experiment("baseline_dense_k1", gold, rag_target(lambda q, k: dense.search(q, k), 1), evaluators)
    cand = run_experiment("hybrid_rerank_k3", gold, rag_target(lambda q, k: hybrid.search(q, k), 3), evaluators)
    print(as_table([base, cand]))
    regs = compare(base, cand)
    print("\nregression gate:", "PASS" if not regs else f"FAIL {regs}")
    fails = [r for r in cand.rows if r["scores"].get("correct", 0) < 1]
    print(f"\n{len(fails)} incorrect answers in candidate - these feed Class 8 error analysis:")
    for r in fails[:3]:
        print(f"  Q: {r['input']['q']}\n     A: {r['output']['answer'][:160]}…")


def part2() -> None:
    from classes.class05_tool_engineering.example import build
    from langgraph.types import Command

    def agent_target(ex: dict) -> dict:
        app = build()
        cfg = {"configurable": {"thread_id": ex["id"]}}
        res = app.invoke({"incident": ex["incident"], "steps": [], "pending": None, "answer": None}, cfg)
        while "__interrupt__" in res:
            res = app.invoke(Command(resume="approve"), cfg)
        return {"answer": res["answer"], "tool_calls": [s["tool"] for s in res["steps"]]}

    def root_cause(ex, out):
        return {"root_cause_found": float(all(w in out["answer"].lower() for w in ex["must_mention"]))}

    dataset = [{"id": "INC-4471", "incident": "checkout-api 5xx error rate above 5% since 10:30 UTC",
                "must_mention": ["v2.14.0", "pool"]}]
    exp = run_experiment("aiops_agent_trajectory", dataset, agent_target,
                         [trajectory_match(["get_metric", "search_logs", "get_recent_deploys"],
                                           forbidden=["run_anything"]), root_cause])
    print(as_table([exp]))
    print("tool path:", " -> ".join(exp.rows[0]["output"]["tool_calls"]))


if __name__ == "__main__":
    print(f"LLM mode: {get_llm().mode}\n\n== Part 1: RAG experiments ==")
    part1()
    print("\n== Part 2: agent trajectory evaluation ==")
    part2()
    print("\nResults saved to runs/eval_*.json")
