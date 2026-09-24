import json

from common import DATA


def test_class04_self_query_filter_best():
    from classes.class04_rag_design.example import (BM25Index, HybridRetriever, evaluate, load_corpus,
                                                    self_query_filter)
    chunks = load_corpus()
    gold = json.loads((DATA / "legal" / "questions_golden.json").read_text())
    h = HybridRetriever(chunks)
    filtered = evaluate(lambda q, k: h.search(q, k, where=self_query_filter(q)), gold)
    sparse = evaluate(lambda q, k: BM25Index(chunks).search(q, k), gold)
    assert filtered["mrr"] > sparse["mrr"] and filtered["recall@3"] == 1.0


def test_class05_agent_finds_bad_deploy_with_approval():
    from langgraph.types import Command
    from classes.class05_tool_engineering.example import build
    app = build()
    cfg = {"configurable": {"thread_id": "t"}}
    out = app.invoke({"incident": "checkout 5xx", "steps": [], "pending": None, "answer": None}, cfg)
    assert "__interrupt__" in out and out["__interrupt__"][0].value["tool"] == "rollback_deployment"
    out = app.invoke(Command(resume="approve"), cfg)
    assert "v2.14.0" in out["answer"]


def test_class08_judge_alignment():
    from classes.class08_error_analysis_judge.example import SAMPLES, cohen_kappa
    from classes.class08_error_analysis_judge.judge import judge
    human = [s["human"].upper() for s in SAMPLES]
    pred = [judge(s["question"], s["context_ids"], s["answer"]).verdict for s in SAMPLES]
    assert cohen_kappa(human, pred) > 0.6


def test_class09_agentic_rag_routes():
    from classes.class09_agentic_rag_finetuning.agentic_rag import ask, build
    app = build()
    assert "consult" in ask(app, "What dose of semaglutide should I take?")["answer"]
    out = ask(app, "What a1c is needed before starting ozempic?")
    assert "7.0%" in out["answer"] and any(l.startswith("rewrite") for l in out["log"])


def test_class11_guardrail_outcomes():
    from classes.class11_observability_guardrails.guarded_pipeline import CASES, handle
    statuses = [handle(q, simulate_bad_output=b).status for _, q, b in CASES]
    assert statuses == ["allowed", "allowed", "blocked", "blocked", "human_review"]
