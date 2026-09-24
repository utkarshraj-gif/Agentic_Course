"""Class 8 - LLM-as-a-judge with an explicit rubric, plus a transparent offline judge.

Good judge design:
  * binary PASS/FAIL per criterion (easier to align with humans than 1-10 scales)
  * the rubric names concrete failure modes found in error analysis
  * judge sees exactly what the system saw (question + retrieved context), plus the answer
  * rationale BEFORE verdict; structured output; temperature 0
  * validated against human labels (agreement, Cohen's kappa, TPR/TNR) before it is trusted
"""
from __future__ import annotations

import re
from functools import lru_cache

from pydantic import BaseModel

from common import DATA
from common.guardrails import check_output
from common.llm import get_llm
from common.retrieval import chunk_markdown, load_markdown_dir

RUBRIC = """You are grading an answer from a contract-analysis assistant. Criteria (each PASS/FAIL):
1. grounded     - every factual claim (numbers, parties, durations) is supported by the CONTEXT
2. correct_doc  - facts come from the document the question is about, not another contract
3. cited        - cites at least one [chunk-id], and only ids present in CONTEXT
4. complete     - answers the actual question asked (incl. yes/no + the specific point)
5. policy       - no legal advice to act, no guarantees ("you will win", "definitely protected")
Overall verdict is PASS only if all five pass. Write the rationale first, then the verdict."""


class Judgement(BaseModel):
    rationale: str
    grounded: bool
    correct_doc: bool
    cited: bool
    complete: bool
    policy: bool
    verdict: str  # PASS | FAIL


@lru_cache
def chunk_text() -> dict[str, str]:
    docs = load_markdown_dir(DATA / "legal" / "contracts") + [("playbook", (DATA / "legal" / "playbook.md").read_text())]
    return {c.id: c.text for d, t in docs for c in chunk_markdown(d, t)}


NUM = re.compile(r"\b\d+(?:\.\d+)?%?|\b(?:one|two|three|six|twelve|fifteen|thirty|sixty|ninety|twenty-four)\b", re.I)


def offline_judge(question: str, context_ids: list[str], answer: str) -> Judgement:
    ctx = {i: chunk_text()[i] for i in context_ids}
    cited = re.findall(r"\[([\w\-]+#\d+)\]", answer)
    cited_ok = bool(cited) and all(c in ctx for c in cited)
    cited_text = " ".join(ctx.get(c, "") for c in cited).lower()
    nums = {n.lower() for n in NUM.findall(re.sub(r"\[[^\]]+\]", "", answer))}
    unsupported = [n for n in nums if n not in cited_text]
    grounded = cited_ok and not unsupported
    policy = check_output(answer, "legal").allowed and not re.search(r"\b(definitely|guarantee)", answer, re.I)
    # correct_doc: the question names a counterparty -> citations must be from that contract
    target = next((d for k, d in {"acme": "acme-saas-msa", "globex": "globex-services",
                                  "northwind": "northwind-nda"}.items() if k in question.lower()), None)
    correct_doc = not target or all(c.startswith(target) or c.startswith("playbook") for c in cited)
    complete = len(answer.split()) >= 4
    ok = all([grounded, correct_doc, cited_ok, complete, policy])
    why = []
    if not cited_ok:
        why.append("missing or unknown citation")
    if unsupported:
        why.append(f"values not in cited context: {unsupported}")
    if not policy:
        why.append("policy language (advice/guarantee)")
    return Judgement(rationale="; ".join(why) or "all checks passed", grounded=grounded, correct_doc=correct_doc,
                     cited=cited_ok, complete=complete, policy=policy, verdict="PASS" if ok else "FAIL")


def judge(question: str, context_ids: list[str], answer: str) -> Judgement:
    ctx = "\n\n".join(f"[{i}]\n{chunk_text()[i]}" for i in context_ids)
    msgs = [{"role": "system", "content": RUBRIC},
            {"role": "user", "content": f"QUESTION: {question}\n\nCONTEXT:\n{ctx}\n\nANSWER:\n{answer}"}]
    return get_llm().structured(msgs, Judgement, fallback=lambda: offline_judge(question, context_ids, answer))
