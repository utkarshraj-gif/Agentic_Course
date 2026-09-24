"""Our negotiation playbook expressed as executable, explainable rules (we are the customer).

The LLM is good at reading messy clauses; code is better at applying thresholds consistently.
Each rule returns (risk, finding, escalate) and the finding quotes the numbers it used.
Thresholds mirror data/legal/playbook.md - keep them in sync (a test enforces the key ones).
"""
from __future__ import annotations

import re

Risk = tuple[str, str, bool]   # (low|medium|high, finding, escalate_to_senior_counsel)


def _num_before(text: str, unit: str) -> int | None:
    """'ninety (90) days' / '12 months' -> 90 / 12 (first match)."""
    unit = unit.rstrip("s") + "s?"                     # month / months
    m = re.search(rf"\((\d+)\)\s*{unit}\b|(\d+)\s*{unit}\b", text, re.I)
    return int(m.group(1) or m.group(2)) if m else None


def liability(t: str) -> Risk:
    months = _num_before(t, "months")
    one_sided = re.search(r"provider's aggregate liability|supplier's aggregate liability", t, re.I) \
        and not re.search(r"each party|either party", t, re.I)
    covers_data = re.search(r"limitations apply to breaches of[^.]*data protection", t, re.I)
    issues = []
    if months is not None and months < 12:
        issues.append(f"cap = {months} months of fees (standard 12)")
    if one_sided:
        issues.append("cap protects provider only")
    if covers_data:
        issues.append("cap applies to data-protection breaches (must be carved out)")
    if not re.search(r"does not apply|shall not apply|excluding|except", t, re.I):
        issues.append("no carve-outs")
    if not issues:
        return "low", f"mutual {months}-month cap with carve-outs", False
    return "high", "; ".join(issues), bool(months is not None and months < 6)


def indemnification(t: str) -> Risk:
    one_way = re.search(r"customer shall indemnify", t, re.I) and not re.search(r"each party shall indemnify", t, re.I)
    no_ip = re.search(r"no obligation to indemnify[^.]*intellectual property", t, re.I) or \
        not re.search(r"(supplier|provider) shall indemnify[^.]*intellectual property", t, re.I)
    issues = (["one-way indemnity from us"] if one_way else []) + (["no IP indemnity from supplier"] if no_ip else [])
    return ("high", "; ".join(issues), False) if issues else ("low", "mutual indemnities incl. supplier IP", False)


def termination(t: str) -> Risk:
    supplier_only = re.search(r"provider may terminate[^.]*convenience", t, re.I) and not re.search(
        r"either party may terminate[^.]*convenience", t, re.I)
    cure = [int(x) for x in re.findall(r"(?:uncured|cured)[^.]*?\((\d+)\)\s*days", t, re.I)]
    long_cure = any(c > 30 for c in cure)
    issues = (["supplier-only termination for convenience"] if supplier_only else []) + \
             ([f"cure period {max(cure)} days (standard 30)"] if long_cure else [])
    return ("high", "; ".join(issues), False) if issues else ("low", "mutual termination rights, 30-day cure", False)


def renewal(t: str) -> Risk:
    if not re.search(r"automatic|renews", t, re.I) or re.search(r"requires a written amendment", t, re.I):
        return "low", "no auto-renewal", False
    notice = _num_before(t, "days")
    issues = ([f"non-renewal notice {notice} days (max 60)"] if notice and notice > 60 else [])
    return ("high", "; ".join(issues), False) if issues else ("low", f"auto-renewal with {notice}-day notice", False)


def payment(t: str) -> Risk:
    days = _num_before(t, "days")
    interest = re.search(r"([\d.]+)% per month", t)
    inc = re.search(r"increase fees by up to (\d+)%", t, re.I)
    issues = []
    if days is not None and days < 30:
        issues.append(f"payment due in {days} days (min 30)")
    if interest and float(interest.group(1)) > 1.0:
        issues.append(f"late interest {interest.group(1)}%/month (max 1%)")
    if inc and int(inc.group(1)) > 5:
        issues.append(f"renewal price increase up to {inc.group(1)}% (max 5%)")
    return ("high", "; ".join(issues), False) if issues else ("low", f"net {days} days", False)


def data_protection(t: str) -> Risk:
    issues = []
    if re.search(r"commercially reasonable", t, re.I) and not re.search(r"ISO 27001|SOC 2", t, re.I):
        issues.append("vague security standard (need ISO 27001 / SOC 2)")
    if re.search(r"reasonable time", t, re.I) or not re.search(r"72 hours", t, re.I):
        issues.append("no fixed breach-notification deadline (need 72h)")
    return ("high", "; ".join(issues), False) if issues else ("low", "meets security + 72h notice", False)


def non_solicit(t: str) -> Risk:
    months = _num_before(t, "months")
    general_exception = re.search(r"general (job )?(advertisement|solicitation)", t, re.I)
    issues = ([f"{months}-month non-solicit (max 12)"] if months and months > 12 else []) + \
             ([] if general_exception else ["no general-advertisement exception"])
    if not issues:
        return "low", "within playbook", False
    return ("medium", "; ".join(issues), False)


def governing_law(t: str) -> Risk:
    ok = re.search(r"New York|Delaware|England and Wales", t, re.I)
    return ("low", f"acceptable jurisdiction ({ok.group(0)})", False) if ok else ("medium", "non-standard jurisdiction", False)


def confidentiality(t: str) -> Risk:
    years = _num_before(t, "years")
    if years is not None and years < 2:
        return "high", f"survival {years} years (min 2)", False
    return "low", "standard confidentiality terms", False


RULES = {"limitation_of_liability": liability, "indemnification": indemnification, "termination": termination,
         "term_renewal": renewal, "payment_terms": payment, "data_protection": data_protection,
         "non_solicitation": non_solicit, "governing_law": governing_law, "confidentiality": confidentiality}

REDLINES = {
    "limitation_of_liability": "Each party's aggregate liability shall not exceed the fees paid or payable in the twelve (12) months preceding the claim. The cap shall not apply to breaches of confidentiality or data protection, indemnification obligations, or gross negligence or wilful misconduct.",
    "indemnification": "Each party shall indemnify the other against third-party claims arising from its breach or negligence. Provider shall defend and indemnify Customer against third-party claims that the Services infringe intellectual property rights.",
    "termination": "Either party may terminate for convenience on sixty (60) days written notice, or for material breach not cured within thirty (30) days of written notice.",
    "term_renewal": "This Agreement renews for successive twelve (12) month terms unless either party gives notice of non-renewal at least sixty (60) days before the end of the then-current term.",
    "payment_terms": "Customer shall pay undisputed invoices within forty-five (45) days of receipt. Late amounts accrue interest at no more than 1% per month. Fee increases on renewal shall not exceed 5%.",
    "data_protection": "Provider shall maintain security controls certified to ISO 27001 or SOC 2 Type II and notify Customer of any security breach affecting Customer Data within seventy-two (72) hours.",
    "non_solicitation": "For twelve (12) months, neither party shall solicit the other's employees, provided that general job advertisements not targeted at such employees are permitted.",
    "governing_law": "This Agreement is governed by the laws of the State of New York.",
}


def assess_clause(clause_type: str, text: str) -> Risk:
    rule = RULES.get(clause_type)
    return rule(text) if rule else ("low", "no playbook position", False)
