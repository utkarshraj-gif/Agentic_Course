"""Guardrails (Class 11): input screening, PHI/PII redaction, output policy checks.

These are deterministic, auditable rules - the layer you keep even when you add model-based
classifiers (e.g. NeMo Guardrails, Llama Guard, Azure AI Content Safety) on top.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

PII_PATTERNS: dict[str, str] = {
    "SSN": r"\b\d{3}-\d{2}-\d{4}\b",
    "MRN": r"\bMRN[:#\s]*\d{6,10}\b",
    "PHONE": r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b",
    "EMAIL": r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b",
    "DOB": r"\b(?:DOB|Date of birth)[:\s]*\d{4}-\d{2}-\d{2}\b",
    "CARD": r"\b(?:\d[ -]?){13,16}\b",
}

INJECTION_PATTERNS = [
    r"ignore (all|any|the)? ?(previous|prior|above) (instructions|rules)",
    r"disregard (your|the) (system|previous) prompt",
    r"you are now (?:dan|developer mode|unrestricted)",
    r"reveal (your|the) (system prompt|hidden instructions)",
    r"act as (?:an? )?(?:admin|root|superuser)",
]


@dataclass
class GuardResult:
    allowed: bool
    text: str
    findings: list[str] = field(default_factory=list)


def redact(text: str, keep_names: bool = False, names: list[str] | None = None) -> GuardResult:
    """Replace PHI/PII with typed placeholders. Pass known patient/party names to mask them too."""
    findings = []
    out = text
    for label, pat in PII_PATTERNS.items():
        out, n = re.subn(pat, f"[{label}]", out, flags=re.I)
        if n:
            findings.append(f"{label}x{n}")
    for name in names or []:
        if not keep_names and name and name in out:
            out = out.replace(name, "[NAME]")
            findings.append("NAME")
    return GuardResult(True, out, findings)


def screen_input(text: str, max_chars: int = 8000) -> GuardResult:
    findings = [p for p in INJECTION_PATTERNS if re.search(p, text, re.I)]
    if len(text) > max_chars:
        findings.append("too_long")
    return GuardResult(not findings, text, [f"injection:{f}" if f != "too_long" else f for f in findings])


def check_citations(answer: str, allowed_ids: set[str]) -> GuardResult:
    """Every [doc#n] citation must point at a retrieved chunk; answers need at least one."""
    cited = set(re.findall(r"\[([\w\-]+#\d+)\]", answer))
    bad = cited - allowed_ids
    findings = []
    if not cited:
        findings.append("no_citations")
    if bad:
        findings.append(f"unknown_citations:{sorted(bad)}")
    return GuardResult(not findings, answer, findings)


CLINICAL_BLOCKLIST = [r"\b(definitely|certainly) (has|have) (cancer|a tumou?r)\b",
                      r"\bstop taking\b", r"\bincrease (your|the) dose\b"]
LEGAL_BLOCKLIST = [r"\bthis constitutes legal advice\b", r"\byou will (definitely )?win\b"]


def check_output(answer: str, domain: str) -> GuardResult:
    rules = {"clinical": CLINICAL_BLOCKLIST, "legal": LEGAL_BLOCKLIST}.get(domain, [])
    hits = [r for r in rules if re.search(r, answer, re.I)]
    leaked = [k for k, p in PII_PATTERNS.items() if k != "CARD" and re.search(p, answer, re.I)]
    findings = [f"policy:{h}" for h in hits] + [f"pii_leak:{k}" for k in leaked]
    return GuardResult(not findings, answer, findings)
