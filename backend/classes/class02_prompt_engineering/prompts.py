"""Class 2 - Prompts as versioned, testable artifacts.

A production prompt has named parts. Keeping them separate lets you A/B one part at a time
and diff prompt versions in code review like any other change.
"""
from __future__ import annotations

from string import Template

from pydantic import BaseModel, Field

from common.domain import CLAUSE_TYPES

PROMPT_VERSION = "clause-classifier/v3"

ROLE = "You are a senior commercial contracts analyst at an enterprise legal operations team."

TASK = """Classify ONE contract clause into exactly one clause type and rate its risk to US
(our role in the contract is given) against our standard positions."""

CONSTRAINTS = """- Choose clause_type only from: $types
- risk is 'high' if the clause departs from a standard market position against us, 'medium' if
  it is borderline, 'low' if it is standard or favourable.
- Quote the exact phrase that drove your rating in `evidence` (max 25 words, verbatim).
- If the text is not a legal clause, use clause_type 'other' and risk 'low'.
- Do not give legal advice to third parties; this is an internal triage."""

FEW_SHOT = [
    {"clause": "Supplier's total liability shall not exceed fees paid in the prior one (1) month.",
     "our_role": "customer",
     "output": {"clause_type": "limitation_of_liability", "risk": "high",
                "evidence": "shall not exceed fees paid in the prior one (1) month",
                "reasoning": "Cap far below a 12-month market standard, protects supplier only."}},
    {"clause": "Either party may terminate for material breach not cured within thirty (30) days.",
     "our_role": "customer",
     "output": {"clause_type": "termination", "risk": "low",
                "evidence": "Either party may terminate for material breach",
                "reasoning": "Mutual right with a standard 30-day cure period."}},
]

USER_TEMPLATE = Template("""Our role: $our_role
Section title: $title
Clause:
\"\"\"$clause\"\"\"""")


class ClauseAssessment(BaseModel):
    """The output contract. The model must return exactly this shape (validated with pydantic)."""
    clause_type: str = Field(description=f"one of {CLAUSE_TYPES}")
    risk: str = Field(pattern="^(low|medium|high)$")
    evidence: str = Field(max_length=300)
    reasoning: str = Field(max_length=400)


def build_messages(title: str, clause: str, our_role: str, few_shot: bool = True) -> list[dict]:
    system = "\n\n".join([ROLE, TASK, Template(CONSTRAINTS).substitute(types=", ".join(CLAUSE_TYPES))])
    msgs = [{"role": "system", "content": system}]
    if few_shot:
        import json
        for ex in FEW_SHOT:
            msgs.append({"role": "user", "content": USER_TEMPLATE.substitute(
                our_role=ex["our_role"], title="(example)", clause=ex["clause"])})
            msgs.append({"role": "assistant", "content": json.dumps(ex["output"])})
    msgs.append({"role": "user", "content": USER_TEMPLATE.substitute(our_role=our_role, title=title, clause=clause)})
    return msgs
