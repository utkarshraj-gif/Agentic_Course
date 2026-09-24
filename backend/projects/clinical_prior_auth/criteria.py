"""Deterministic, auditable policy criteria (one function per synthetic medical policy).

Each criterion returns met = True / False / None (None = not documented -> pend, never deny).
The recommendation logic encodes the policies' own reviewer notes:
  * any exclusion met                    -> deny  (physician reviewer must confirm)
  * a "use another service" rule met     -> redirect
  * all required criteria met            -> approve
  * something missing / too early        -> pend (request information)
"""
from __future__ import annotations

from dataclasses import dataclass

from .extraction import ClinicalFacts


@dataclass
class Criterion:
    name: str
    met: bool | None
    detail: str


@dataclass
class Assessment:
    policy_id: str
    criteria: list[Criterion]
    recommendation: str        # approve | pend | deny | redirect
    reason: str


def _c(name, cond, detail):
    return Criterion(name, None if cond is None else bool(cond), detail)


def mri_lumbar(f: ClinicalFacts) -> Assessment:
    crit = [_c("red-flag pathway (urgent imaging)", bool(f.red_flags), ", ".join(f.red_flags) or "none documented")]
    if f.red_flags:
        return Assessment("MP-RAD-014", crit, "approve", "Red-flag pathway: imaging indicated.")
    crit += [
        _c("symptoms >= 6 weeks", None if f.symptom_weeks is None else f.symptom_weeks >= 6, f"{f.symptom_weeks} weeks"),
        _c("conservative therapy >= 6 weeks", None if f.conservative_therapy_weeks is None
           else f.conservative_therapy_weeks >= 6, f"{f.conservative_therapy_weeks} weeks PT"),
        _c("analgesic / NSAID trial", f.analgesic_trial, "documented" if f.analgesic_trial else "not documented"),
        _c("result will change management", f.management_change_planned,
           "intervention planned" if f.management_change_planned else "none stated"),
    ]
    if all(c.met for c in crit[1:]):
        return Assessment("MP-RAD-014", crit, "approve", "All non-red-flag criteria met.")
    return Assessment("MP-RAD-014", crit, "pend",
                      "Conservative therapy / duration not yet met; request information (policy: pend, do not deny).")


def glp1(f: ClinicalFacts) -> Assessment:
    crit = [
        _c("no MTC / MEN2 history (exclusion)", None if f.mtc_or_men2_history is None else not f.mtc_or_men2_history,
           "history present" if f.mtc_or_men2_history else "none documented"),
        _c("type 2 diabetes diagnosis", f.type2_diabetes, "E11.x documented" if f.type2_diabetes else "missing"),
        _c("HbA1c >= 7.0% within 90 days", None if f.hba1c is None else f.hba1c >= 7.0 and (f.hba1c_age_days or 0) <= 90,
           f"{f.hba1c}% ({f.hba1c_age_days} days ago)"),
        _c("metformin trial >= 3 months", None if f.metformin_months is None else f.metformin_months >= 3,
           f"{f.metformin_months} months"),
    ]
    if f.mtc_or_men2_history:
        return Assessment("MP-RX-221", crit, "deny", "Exclusion: personal or family history of MTC/MEN2.")
    if all(c.met for c in crit):
        return Assessment("MP-RX-221", crit, "approve", "Initial 12-month approval criteria met.")
    return Assessment("MP-RX-221", crit, "pend", "Missing documentation for one or more criteria.")


def hsat(f: ClinicalFacts) -> Assessment:
    crit = [
        _c("high pretest probability (STOP-BANG >= 3 or ESS > 10)",
           None if f.stop_bang is None and f.epworth is None else (f.stop_bang or 0) >= 3 or (f.epworth or 0) > 10,
           f"STOP-BANG {f.stop_bang}, Epworth {f.epworth}"),
        _c("no in-lab indication (e.g. chronic opioids)", None if f.chronic_opioids is None else not f.chronic_opioids,
           "chronic opioid use" if f.chronic_opioids else "none"),
    ]
    if f.chronic_opioids:
        return Assessment("MP-DX-042", crit, "redirect", "Chronic opioid use: attended in-lab polysomnography preferred.")
    if crit[0].met:
        return Assessment("MP-DX-042", crit, "approve", "High pretest probability, no in-lab indication.")
    return Assessment("MP-DX-042", crit, "pend", "Pretest probability not documented.")


def knee(f: ClinicalFacts) -> Assessment:
    crit = [
        _c("mechanical symptoms", f.mechanical_symptoms, "documented" if f.mechanical_symptoms else "not documented"),
        _c("MRI-confirmed tear", f.mri_confirmed_tear, "yes" if f.mri_confirmed_tear else "no"),
        _c(">= 4 weeks conservative treatment", None if f.conservative_therapy_weeks is None
           else f.conservative_therapy_weeks >= 4, f"{f.conservative_therapy_weeks} weeks"),
        _c("no advanced OA (KL grade < 3)", None if f.kl_grade is None else f.kl_grade < 3, f"KL grade {f.kl_grade}"),
    ]
    if f.kl_grade is not None and f.kl_grade >= 3:
        return Assessment("MP-SURG-087", crit, "deny", "Advanced osteoarthritis (KL 3-4): not medically necessary.")
    if all(c.met for c in crit):
        return Assessment("MP-SURG-087", crit, "approve", "All criteria met.")
    return Assessment("MP-SURG-087", crit, "pend", "Missing documentation.")


ENGINES = {"MP-RAD-014": mri_lumbar, "MP-RX-221": glp1, "MP-DX-042": hsat, "MP-SURG-087": knee}


def assess(policy_id: str, facts: ClinicalFacts) -> Assessment:
    if policy_id not in ENGINES:
        return Assessment(policy_id, [], "pend", "No automated criteria for this policy; manual review.")
    return ENGINES[policy_id](facts)
