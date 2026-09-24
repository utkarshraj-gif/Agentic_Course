"""Clinical Prior-Authorization Assistant - LangGraph workflow.

intake -> redact PHI -> retrieve policy -> extract facts -> assess criteria -> draft rationale
       -> guard output -> HUMAN REVIEW (interrupt; physician for any deny) -> decision letter -> audit

Design choices for a regulated workflow:
  * autonomy L2: the agent recommends, a licensed human decides (always)
  * the LLM never sees direct identifiers (redaction before any model call)
  * the decision logic is deterministic code over extracted facts; the LLM explains it
  * everything that happened is written to an append-only audit log
"""
from __future__ import annotations

import json
import time
from typing import TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from common import DATA, RUNS
from common.guardrails import check_citations, check_output, redact
from common.llm import get_llm
from common.retrieval import HybridRetriever, chunk_markdown, format_context, load_markdown_dir
from common.tracing import traced

from .criteria import assess
from .extraction import extract

_CHUNKS = [c for d, t in load_markdown_dir(DATA / "clinical" / "guidelines") for c in chunk_markdown(d, t, 700)]
RETRIEVER = HybridRetriever(_CHUNKS)
AUDIT = RUNS / "clinical_audit.jsonl"


class PAState(TypedDict, total=False):
    request: dict
    redacted_note: str
    phi_findings: list[str]
    policy_chunks: list[dict]
    facts: dict
    assessment: dict
    rationale: str
    guard: dict
    review: dict
    letter: str
    status: str


# ----------------------------------------------------------------------------- nodes
@traced("pa.redact", "guardrail")
def redact_phi(s: PAState) -> dict:
    p = s["request"]["patient"]
    r = redact(s["request"]["clinical_note"], names=[p["name"], *p["name"].split()])
    return {"redacted_note": r.text, "phi_findings": r.findings, "status": "redacted"}


@traced("pa.retrieve_policy", "retriever")
def retrieve_policy(s: PAState) -> dict:
    req = s["request"]
    res = RETRIEVER.search(f"{req['service']} criteria for approval documentation", k=4,
                           where={"policy_id": req["policy_id"]})
    return {"policy_chunks": [{"id": c.id, "section": c.meta["section"], "text": c.text} for c, _ in res]}


@traced("pa.extract", "llm")
def extract_facts(s: PAState) -> dict:
    return {"facts": extract(s["redacted_note"]).model_dump()}


@traced("pa.assess", "chain")
def assess_criteria(s: PAState) -> dict:
    from .extraction import ClinicalFacts
    a = assess(s["request"]["policy_id"], ClinicalFacts(**s["facts"]))
    return {"assessment": {"policy_id": a.policy_id, "recommendation": a.recommendation, "reason": a.reason,
                           "criteria": [c.__dict__ for c in a.criteria]}}


@traced("pa.rationale", "llm")
def draft_rationale(s: PAState) -> dict:
    a = s["assessment"]
    chunks = s["policy_chunks"]
    crit_section = next((c for c in chunks if "Criteria" in c["section"] or "Exclusion" in c["section"]
                         or "preferred" in c["section"]), chunks[0] if chunks else None)
    cite = f"[{crit_section['id']}]" if crit_section else ""

    def offline():
        lines = [f"Recommendation: {a['recommendation'].upper()} under {a['policy_id']} {cite}.", a["reason"]]
        for c in a["criteria"]:
            mark = {True: "met", False: "NOT met", None: "not documented"}[c["met"]]
            lines.append(f"- {c['name']}: {mark} ({c['detail']})")
        return "\n".join(lines)

    ctx = format_context([(type("C", (), {"id": c["id"], "text": c["text"],
                                          "meta": {"title": a["policy_id"], "section": c["section"]}})(), 0)
                          for c in chunks])
    prompt = (f"Write a concise reviewer rationale for this prior-authorization recommendation. "
              f"Cite policy chunks as [chunk-id]. Do not add clinical advice.\n\nPolicy:\n{ctx}\n\n"
              f"Assessment: {json.dumps(a)}")
    return {"rationale": get_llm().chat(prompt, fallback=offline)}


@traced("pa.output_guard", "guardrail")
def guard(s: PAState) -> dict:
    out = check_output(s["rationale"], "clinical")
    cit = check_citations(s["rationale"], {c["id"] for c in s["policy_chunks"]})
    return {"guard": {"allowed": out.allowed and cit.allowed, "findings": out.findings + cit.findings}}


def human_review(s: PAState) -> dict:
    """Pause for a licensed reviewer. Denials require a physician reviewer (policy note)."""
    a = s["assessment"]
    required = "physician" if a["recommendation"] == "deny" else "nurse_reviewer"
    decision = interrupt({"request_id": s["request"]["request_id"], "recommendation": a["recommendation"],
                          "required_reviewer": required, "rationale": s["rationale"], "guard": s["guard"]})
    return {"review": {**decision, "required_reviewer": required}, "status": "reviewed"}


@traced("pa.letter", "llm")
def letter(s: PAState) -> dict:
    d = s["review"]["decision"]
    templates = {
        "approve": "Your request for {svc} has been APPROVED under policy {pid}.",
        "pend": "We need more information to review {svc}. Please send: {missing}.",
        "deny": "Your request for {svc} was not approved under policy {pid} after physician review. Reason: {reason} "
                "You may appeal within 180 days.",
        "redirect": "An alternative service is recommended instead of {svc} under policy {pid}: {reason}",
    }
    missing = ", ".join(c["name"] for c in s["assessment"]["criteria"] if not c["met"]) or "supporting notes"
    text = templates[d].format(svc=s["request"]["service"], pid=s["assessment"]["policy_id"],
                               reason=s["assessment"]["reason"], missing=missing)
    return {"letter": text, "status": f"closed:{d}"}


def audit(s: PAState) -> dict:
    AUDIT.parent.mkdir(exist_ok=True)
    with AUDIT.open("a") as f:
        f.write(json.dumps({"ts": time.time(), "request_id": s["request"]["request_id"],
                            "policy_id": s["assessment"]["policy_id"],
                            "ai_recommendation": s["assessment"]["recommendation"],
                            "final_decision": s["review"]["decision"], "reviewer": s["review"].get("reviewer"),
                            "override": s["review"]["decision"] != s["assessment"]["recommendation"],
                            "phi_redacted": s["phi_findings"], "guard": s["guard"],
                            "model": get_llm().mode}) + "\n")
    return {}


def build(checkpointer=None):
    g = StateGraph(PAState)
    for name, fn in [("redact_phi", redact_phi), ("retrieve_policy", retrieve_policy),
                     ("extract_facts", extract_facts), ("assess_criteria", assess_criteria),
                     ("draft_rationale", draft_rationale), ("guard", guard), ("human_review", human_review),
                     ("letter", letter), ("audit", audit)]:
        g.add_node(name, fn)
    g.add_edge(START, "redact_phi")
    g.add_edge("redact_phi", "retrieve_policy")
    g.add_edge("retrieve_policy", "extract_facts")
    g.add_edge("extract_facts", "assess_criteria")
    g.add_edge("assess_criteria", "draft_rationale")
    g.add_edge("draft_rationale", "guard")
    g.add_edge("guard", "human_review")
    g.add_edge("human_review", "letter")
    g.add_edge("letter", "audit")
    g.add_edge("audit", END)
    return g.compile(checkpointer=checkpointer or MemorySaver())
