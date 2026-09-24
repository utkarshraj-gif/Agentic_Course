"""Legal Contract Review Agent - LangGraph map-reduce over clauses.

  ingest -> screen (prompt-injection in the document) -> fan-out: review_clause x N (parallel, Send)
         -> aggregate (score + escalation rules) -> [counsel sign-off interrupt if escalated] -> report

Each review_clause: classify (LLM structured / heuristic) -> retrieve playbook position (RAG)
-> apply playbook rules (code) -> explain + redline (LLM / template), all with evidence quotes.
"""
from __future__ import annotations

import operator
import re
from typing import Annotated, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send, interrupt
from pydantic import BaseModel

from common import DATA, RUNS
from common.domain import CLAUSE_TYPES, classify_clause_heuristic, load_contract_sections, parse_contract
from common.guardrails import screen_input
from common.llm import get_llm
from common.retrieval import HybridRetriever, chunk_markdown
from common.tracing import traced

from .playbook_rules import REDLINES, assess_clause

PLAYBOOK = HybridRetriever(chunk_markdown("playbook", (DATA / "legal" / "playbook.md").read_text(),
                                          extra_meta={"doc_type": "playbook"}))
REPORTS = RUNS / "legal_reports"
RISK_POINTS = {"low": 0, "medium": 3, "high": 10}


class ClauseType(BaseModel):
    clause_type: str
    evidence: str


class ReviewState(TypedDict, total=False):
    contract: str
    text: str
    meta: dict
    sections: list[dict]
    screen: dict
    clauses: Annotated[list[dict], operator.add]
    summary: dict
    signoff: dict
    report_path: str


# ----------------------------------------------------------------------------- nodes
def ingest(s: ReviewState) -> dict:
    secs = parse_contract(s["contract"], s["text"]) if s.get("text") else load_contract_sections(s["contract"])
    return {"sections": secs, "meta": secs[0]["meta"] if secs else {}}


@traced("legal.screen", "guardrail")
def screen(s: ReviewState) -> dict:
    """Contracts are untrusted input: flag embedded instructions aimed at the AI reviewer."""
    hits = [f for sec in s["sections"] for f in screen_input(sec["text"]).findings]
    return {"screen": {"clean": not hits, "findings": hits}}


def fan_out(s: ReviewState) -> list[Send]:
    return [Send("review_clause", {"section": sec, "role": s["meta"].get("our_role", "customer")})
            for sec in s["sections"]]


@traced("legal.review_clause", "chain")
def review_clause(p: dict) -> dict:
    sec, llm = p["section"], get_llm()
    ct = llm.structured(
        f"Classify this contract clause as one of {CLAUSE_TYPES}. Quote evidence.\n\n"
        f"Title: {sec['section']}\n{sec['text']}", ClauseType,
        fallback=lambda: ClauseType(clause_type=classify_clause_heuristic(sec["section"], sec["text"]),
                                    evidence=sec["text"][:120])).clause_type
    position = PLAYBOOK.search(ct.replace("_", " ") + " standard position red flag", k=1)
    pb = position[0][0] if position else None
    risk, finding, escalate = assess_clause(ct, sec["text"])
    explanation = llm.chat(
        f"In two sentences, explain to a lawyer why this clause is {risk} risk for us ({p['role']}), "
        f"citing the playbook [{pb.id if pb else ''}].\nClause: {sec['text']}\nPlaybook: {pb.text if pb else ''}\n"
        f"Finding: {finding}",
        fallback=lambda: f"{finding.capitalize()}. Playbook: {pb.text.split('.')[0] if pb else 'n/a'}. "
                         f"[{pb.id if pb else 'n/a'}]")
    return {"clauses": [{"section": sec["section"], "clause_type": ct, "risk": risk, "finding": finding,
                         "escalate": escalate, "playbook_ref": pb.id if pb else None,
                         "explanation": explanation, "evidence": _evidence(sec["text"], finding),
                         "redline": REDLINES.get(ct) if risk != "low" else None}]}


def _evidence(text: str, finding: str) -> str:
    """Pick the clause sentence that contains the numbers/phrases the finding relies on."""
    nums = re.findall(r"\d+(?:\.\d+)?", finding)
    for sent in re.split(r"(?<=\.)\s+", text):
        if any(n in sent for n in nums) or any(w in sent.lower() for w in finding.lower().split()[:3]):
            return sent.strip()
    return text.split(".")[0]


def aggregate(s: ReviewState) -> dict:
    cl = sorted(s["clauses"], key=lambda c: c["section"])
    score = sum(RISK_POINTS[c["risk"]] for c in cl)
    highs = [c for c in cl if c["risk"] == "high"]
    reasons = [f"{c['section']}: {c['finding']}" for c in cl if c["escalate"]]
    if len(highs) >= 3:
        reasons.append(f"{len(highs)} high-risk clauses")
    if not s["screen"]["clean"]:
        reasons.append("possible prompt injection embedded in contract text")
    return {"summary": {"risk_score": score, "rating": "red" if score >= 30 else "amber" if score >= 10 else "green",
                        "high": len(highs), "medium": sum(c["risk"] == "medium" for c in cl),
                        "escalate": bool(reasons), "escalation_reasons": reasons}}


def counsel_signoff(s: ReviewState) -> dict:
    if not s["summary"]["escalate"]:
        return {"signoff": {"required": False}}
    d = interrupt({"contract": s["contract"], "summary": s["summary"]})
    return {"signoff": {"required": True, **d}}


def report(s: ReviewState) -> dict:
    REPORTS.mkdir(parents=True, exist_ok=True)
    m, sm = s["meta"], s["summary"]
    lines = [f"# Contract review: {m.get('counterparty', s['contract'])}", "",
             f"*{m.get('contract_type', '')} · our role: {m.get('our_role')} · synthetic, not legal advice*", "",
             f"**Rating: {sm['rating'].upper()}** · score {sm['risk_score']} · high {sm['high']} · medium {sm['medium']}",
             ""]
    if sm["escalate"]:
        lines += ["**Escalated to senior counsel:** " + "; ".join(sm["escalation_reasons"]),
                  f"Sign-off: {s['signoff']}", ""]
    lines += ["| Section | Type | Risk | Finding |", "|---|---|---|---|"]
    for c in sorted(s["clauses"], key=lambda c: c["section"]):
        lines.append(f"| {c['section']} | {c['clause_type']} | {c['risk']} | {c['finding']} |")
    for c in sorted(s["clauses"], key=lambda c: c["section"]):
        if c["redline"]:
            lines += ["", f"## {c['section']} — {c['risk']}", f"> {c['evidence']}", "",
                      c["explanation"], "", f"**Proposed redline:** {c['redline']}"]
    path = REPORTS / f"{re.sub(r'[^A-Za-z0-9_-]', '_', s['contract'])}.md"   # never trust ids in paths
    path.write_text("\n".join(lines) + "\n")
    return {"report_path": str(path)}


def build(checkpointer=None):
    g = StateGraph(ReviewState)
    for name, fn in [("ingest", ingest), ("screen", screen), ("review_clause", review_clause),
                     ("aggregate", aggregate), ("counsel_signoff", counsel_signoff), ("report", report)]:
        g.add_node(name, fn)
    g.add_edge(START, "ingest")
    g.add_edge("ingest", "screen")
    g.add_conditional_edges("screen", fan_out, ["review_clause"])
    g.add_edge("review_clause", "aggregate")
    g.add_edge("aggregate", "counsel_signoff")
    g.add_edge("counsel_signoff", "report")
    g.add_edge("report", END)
    return g.compile(checkpointer=checkpointer or MemorySaver())
