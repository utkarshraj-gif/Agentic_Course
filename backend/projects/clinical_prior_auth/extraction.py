"""Clinical fact extraction: free-text note -> typed ClinicalFacts.

Pattern: "the LLM reads, code decides". The model (online) or rules (offline) turn a messy
clinical note into structured facts with evidence quotes; a deterministic criteria engine
then applies the policy. Every fact keeps the sentence it came from for the reviewer.
"""
from __future__ import annotations

import re

from pydantic import BaseModel, Field

from common.llm import get_llm


class ClinicalFacts(BaseModel):
    symptom_weeks: float | None = None
    conservative_therapy_weeks: float | None = None
    analgesic_trial: bool | None = None
    red_flags: list[str] = Field(default_factory=list)
    neuro_deficit: bool | None = None
    management_change_planned: bool | None = None
    type2_diabetes: bool | None = None
    hba1c: float | None = None
    hba1c_age_days: int | None = None
    metformin_months: float | None = None
    mtc_or_men2_history: bool | None = None
    stop_bang: int | None = None
    epworth: int | None = None
    chronic_opioids: bool | None = None
    mechanical_symptoms: bool | None = None
    mri_confirmed_tear: bool | None = None
    kl_grade: int | None = None
    evidence: dict[str, str] = Field(default_factory=dict)


RED_FLAGS = {"cauda equina": r"cauda equina|saddle anesthesia|urinary retention",
             "infection": r"fever|iv drug use",
             "cancer history": r"history of cancer",
             "fracture risk": r"osteoporosis|chronic steroids"}


def _clauses(note: str) -> list[str]:
    return [c.strip() for c in re.split(r"[.;]\s+|,\s+(?=no\b)", note) if c.strip()]


def _affirmed(note: str, pattern: str) -> tuple[bool, str]:
    """True if `pattern` occurs in a clause that is not negated ('no ...', 'without ...')."""
    for c in _clauses(note):
        if re.search(pattern, c, re.I):
            negated = re.search(r"\b(no|not|denies|without|negative for)\b[^.]*?(" + pattern + ")", c, re.I)
            if not negated:
                return True, c
    return False, ""


def _num(pattern: str, note: str, cast=float):
    m = re.search(pattern, note, re.I)
    return (cast(m.group(1)), m.group(0)) if m else (None, "")


def extract_rules(note: str) -> ClinicalFacts:
    f = ClinicalFacts()
    ev = f.evidence
    wk, ev["symptom_weeks"] = _num(r"for (\d+) weeks", note)
    mo, s = _num(r"for (\d+) months", note)
    f.symptom_weeks = wk if wk is not None else (round(mo * 4.3, 1) if mo else None)
    if mo and wk is None:
        ev["symptom_weeks"] = s
    pt, ev["conservative_therapy_weeks"] = _num(r"(\d+) weeks of physical therapy", note)
    if pt is None and re.search(r"no physical therapy", note, re.I):
        pt, ev["conservative_therapy_weeks"] = 0.0, "No physical therapy yet"
    f.conservative_therapy_weeks = pt
    f.analgesic_trial, ev["analgesic_trial"] = _affirmed(note, r"naproxen|ibuprofen|nsaid|analgesic")
    for name, pat in RED_FLAGS.items():
        hit, clause = _affirmed(note, pat)
        if hit:
            f.red_flags.append(name)
            ev[f"red_flag:{name}"] = clause
    f.neuro_deficit, ev["neuro_deficit"] = _affirmed(note, r"diminished|weakness|foot drop")
    f.management_change_planned, ev["management_change_planned"] = _affirmed(note, r"epidural|surgery|surgical")
    f.type2_diabetes, ev["type2_diabetes"] = _affirmed(note, r"type 2 diabetes|\bE11")
    f.hba1c, ev["hba1c"] = _num(r"HbA1c ([\d.]+)%", note)
    f.hba1c_age_days, _ = _num(r"measured (\d+) days ago", note, int)
    f.metformin_months, ev["metformin_months"] = _num(r"metformin[^.]*?for (\d+) months", note)
    f.mtc_or_men2_history, ev["mtc_or_men2_history"] = _affirmed(note, r"medullary thyroid|MEN2")
    f.stop_bang, ev["stop_bang"] = _num(r"STOP-BANG score (\d+)", note, int)
    f.epworth, _ = _num(r"Epworth (\d+)", note, int)
    f.chronic_opioids, ev["chronic_opioids"] = _affirmed(note, r"opioid|oxycodone|morphine")
    f.mechanical_symptoms, ev["mechanical_symptoms"] = _affirmed(note, r"locking|catching|giving way")
    f.mri_confirmed_tear, ev["mri_confirmed_tear"] = _affirmed(note, r"MRI shows[^.]*tear")
    f.kl_grade, ev["kl_grade"] = _num(r"Kellgren-Lawrence grade (\d)", note, int)
    f.evidence = {k: v for k, v in ev.items() if v}
    return f


EXTRACT_PROMPT = """Extract clinical facts from this prior-authorization note. Use null when a fact
is not stated. For every non-null fact put the verbatim supporting sentence in `evidence`.
Negations matter ("no fever" means fever is NOT a red flag).

Note:
\"\"\"{note}\"\"\""""


def extract(note: str) -> ClinicalFacts:
    return get_llm().structured(EXTRACT_PROMPT.format(note=note), ClinicalFacts,
                                fallback=lambda: extract_rules(note))
