"""Class 9 - Agentic RAG for clinical policy questions (LangGraph).

Plain RAG retrieves once and hopes. Agentic RAG lets the system reason about retrieval:

  route -> plan (decompose multi-part questions) -> retrieve -> grade documents
        -> (weak evidence? rewrite query and retry, max 2) -> generate -> check grounding
        -> (ungrounded? escalate) -> answer | escalate to human

This combines ideas from Self-RAG, Corrective RAG (CRAG) and query decomposition.

Run:  python -m classes.class09_agentic_rag_finetuning.agentic_rag
"""
from __future__ import annotations

import operator
import re
from typing import Annotated, Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from common import DATA
from common.guardrails import check_citations
from common.llm import get_llm
from common.retrieval import (Chunk, HybridRetriever, chunk_markdown, extractive_answer,
                              format_context, load_markdown_dir, tokenize)
from common.tracing import traced

RETRIEVER = HybridRetriever([c for d, t in load_markdown_dir(DATA / "clinical" / "guidelines")
                             for c in chunk_markdown(d, t, 700)])

# brand names and colloquialisms -> policy vocabulary (an LLM does this online)
SYNONYMS = {"a1c": "HbA1c", "sleep test": "home sleep apnea testing", "back mri": "MRI lumbar spine",
            "knee scope": "knee arthroscopy meniscectomy", "ozempic": "semaglutide",
            "mounjaro": "tirzepatide", "pt": "physical therapy"}
STOP = {"what", "is", "the", "a", "an", "for", "of", "to", "and", "or", "in", "on", "which", "when", "how",
        "does", "do", "be", "with", "any", "should", "must", "before", "long", "used", "needed", "starting"}


def content(q: str) -> set[str]:
    return {t for t in tokenize(q) if len(t) > 1} - STOP


OUT_OF_SCOPE = ["dose", "dosage", "should i take", "diagnose", "weather", "stock price"]


class RAGState(TypedDict):
    question: str
    route: str
    sub_questions: list[str]
    queries: list[str]
    attempts: int
    docs: list[tuple[Chunk, float]]
    relevant: list[tuple[Chunk, float]]
    answer: str
    grounded: bool
    log: Annotated[list[str], operator.add]


# ----------------------------------------------------------------------------- nodes
@traced("route")
def route(s: RAGState) -> dict:
    q = s["question"].lower()
    r = "refuse" if any(w in q for w in OUT_OF_SCOPE) else "policy_qa"
    r = get_llm().chat(f"Classify as policy_qa or refuse (clinical advice / off-topic): {s['question']}",
                       fallback=lambda: r).strip().lower()
    return {"route": "refuse" if "refuse" in r else "policy_qa", "log": [f"route={r}"]}


def plan(s: RAGState) -> dict:
    q = s["question"]
    m = re.match(r"(?i)compare (.+?) for (.+?) and (.+?)[?.]?$", q)
    subs = [f"{m.group(1)} for {m.group(2)}", f"{m.group(1)} for {m.group(3)}"] if m else [q]
    return {"sub_questions": subs, "queries": subs, "log": [f"plan: {subs}"]}


def retrieve(s: RAGState) -> dict:
    docs, seen = [], set()
    for q in s["queries"]:
        for c, sc in RETRIEVER.search(q, k=3):
            if c.id not in seen:
                seen.add(c.id)
                docs.append((c, sc))
    return {"docs": docs, "attempts": s["attempts"] + 1,
            "log": [f"retrieve#{s['attempts'] + 1}: {[c.id for c, _ in docs]}"]}


def grade(s: RAGState) -> dict:
    """Keep only chunks that are relevant to at least one sub-question (LLM yes/no, offline overlap)."""
    keep = []
    for c, sc in s["docs"]:
        def offline():  # share of the query's content words found in the chunk
            ctoks = set(tokenize(c.text))
            best = max(len(content(q) & ctoks) / max(1, len(content(q))) for q in s["queries"])
            return "yes" if best >= 0.25 else "no"
        v = get_llm().chat(f"Is this passage relevant to any of {s['queries']}? yes/no\n\n{c.text}", fallback=offline)
        if v.strip().lower().startswith("y"):
            keep.append((c, sc))
    return {"relevant": keep, "log": [f"grade: kept {len(keep)}/{len(s['docs'])}"]}


def rewrite(s: RAGState) -> dict:
    def offline():
        out = []
        for q in s["queries"]:
            ql = q.lower()
            for k, v in SYNONYMS.items():
                q = re.sub(rf"(?i)\b{re.escape(k)}\b", v, q)
            out.append(q)
        return "\n".join(out)
    new = get_llm().chat("Rewrite each query for a medical-policy search engine using formal terms, one per line:\n"
                         + "\n".join(s["queries"]), fallback=offline).splitlines()
    return {"queries": [q for q in new if q.strip()], "log": [f"rewrite: {new}"]}


def generate(s: RAGState) -> dict:
    ctx = format_context(s["relevant"])
    subs = s["sub_questions"]
    prompt = (f"Answer using ONLY the context; cite [chunk-id] after each sentence. Sub-questions: {subs}\n\n"
              f"{ctx}\n\nQuestion: {s['question']}")

    def fb():  # offline: best supporting sentence per sub-question, no duplicates
        parts, used = [], set()
        for q in (s["queries"] if len(s["queries"]) == len(subs) else subs):
            cands = extractive_answer(q, s["relevant"], n=3)
            for piece in re.findall(r"[^\]]+?\[[^\]]+\]", cands):
                if piece.strip() not in used:
                    used.add(piece.strip())
                    parts.append(piece.strip())
                    break
        return " ".join(parts)
    return {"answer": get_llm().chat(prompt, fallback=fb), "log": ["generate"]}


def check(s: RAGState) -> dict:
    g = check_citations(s["answer"], {c.id for c, _ in s["relevant"]})
    return {"grounded": g.allowed, "log": [f"grounding: {'ok' if g.allowed else g.findings}"]}


def refuse(s: RAGState) -> dict:
    return {"answer": "I can only answer questions about coverage policy criteria. For clinical or dosing "
                      "decisions, please consult the treating clinician.", "grounded": True, "log": ["refused"]}


def escalate(s: RAGState) -> dict:
    return {"answer": "Not enough policy evidence to answer confidently - routed to a human reviewer.",
            "log": ["escalated"]}


# ----------------------------------------------------------------------------- edges
def after_grade(s: RAGState) -> Literal["generate", "rewrite", "escalate"]:
    if len(s["relevant"]) >= len(s["sub_questions"]):
        return "generate"
    return "rewrite" if s["attempts"] < 2 else ("generate" if s["relevant"] else "escalate")


def build():
    g = StateGraph(RAGState)
    for name, fn in [("route", route), ("plan", plan), ("retrieve", retrieve), ("grade", grade),
                     ("rewrite", rewrite), ("generate", generate), ("check", check),
                     ("refuse", refuse), ("escalate", escalate)]:
        g.add_node(name, fn)
    g.add_edge(START, "route")
    g.add_conditional_edges("route", lambda s: "refuse" if s["route"] == "refuse" else "plan")
    g.add_edge("plan", "retrieve")
    g.add_edge("retrieve", "grade")
    g.add_conditional_edges("grade", after_grade)
    g.add_edge("rewrite", "retrieve")
    g.add_edge("generate", "check")
    g.add_conditional_edges("check", lambda s: END if s["grounded"] else "escalate")
    g.add_edge("refuse", END)
    g.add_edge("escalate", END)
    return g.compile()


def ask(app, q: str) -> dict:
    return app.invoke({"question": q, "route": "", "sub_questions": [], "queries": [], "attempts": 0,
                       "docs": [], "relevant": [], "answer": "", "grounded": False, "log": []})


if __name__ == "__main__":
    app = build()
    for q in ["What a1c is needed before starting ozempic?",
              "Compare the conservative therapy requirement for lumbar MRI and knee arthroscopy.",
              "What dose of semaglutide should I take?"]:
        out = ask(app, q)
        print(f"\nQ: {q}")
        for line in out["log"]:
            print(f"   · {line}")
        print(f"A: {out['answer']}")
