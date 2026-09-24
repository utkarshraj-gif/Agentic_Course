"""Loaders for the synthetic datasets used across the course (all data is fictional)."""
from __future__ import annotations

import csv
import json
import re
from functools import lru_cache

from . import DATA


# ----------------------------------------------------------------------------- clinical
def load_pa_requests() -> list[dict]:
    return json.loads((DATA / "clinical" / "prior_auth_requests.json").read_text())


def load_clinical_golden() -> list[dict]:
    return json.loads((DATA / "clinical" / "questions_golden.json").read_text())


# ----------------------------------------------------------------------------- legal
def load_contract_sections(name: str) -> list[dict]:
    """Split a contract into numbered sections: [{contract, section, text, meta}]"""
    return parse_contract(name, (DATA / "legal" / "contracts" / f"{name}.md").read_text())


def parse_contract(name: str, raw: str) -> list[dict]:
    """Parse contract markdown ('key: value' header, '## N. Title' sections)."""
    if "\n# " not in raw:
        raw = "\n# " + raw
    head, _, body = raw.partition("\n# ")
    meta = dict(re.findall(r"^(\w+):\s*(.+)$", head, re.M))
    out = []
    for block in re.split(r"(?m)^##\s+", body)[1:]:
        title, _, text = block.partition("\n")
        out.append({"contract": name, "section": title.strip(), "text": text.strip(), "meta": meta})
    return out


def list_contracts() -> list[str]:
    return sorted(p.stem for p in (DATA / "legal" / "contracts").glob("*.md"))


def load_clause_labels() -> list[dict]:
    return json.loads((DATA / "legal" / "clause_labels.json").read_text())


CLAUSE_TYPES = ["limitation_of_liability", "indemnification", "termination", "term_renewal",
                "payment_terms", "data_protection", "confidentiality", "non_solicitation",
                "governing_law", "other"]

_CLAUSE_KEYWORDS = {
    "limitation_of_liability": ["liability", "consequential", "aggregate"],
    "indemnification": ["indemnif", "hold harmless"],
    "termination": ["terminate", "termination for convenience"],
    "term_renewal": ["renew", "initial term", "successive"],
    "payment_terms": ["invoice", "fees", "late payment", "interest"],
    "data_protection": ["security", "breach affecting", "customer data", "personal data"],
    "confidentiality": ["confidential", "degree of care", "trade secret", "survive"],
    "non_solicitation": ["solicit", "hire any employee"],
    "governing_law": ["governed by the laws", "jurisdiction"],
}


def classify_clause_heuristic(section_title: str, text: str) -> str:
    """Keyword baseline used as the offline fallback (and as the 'model to beat' in Class 2)."""
    t = (section_title + " " + text).lower()
    scores = {k: sum(t.count(w) for w in kws) for k, kws in _CLAUSE_KEYWORDS.items()}
    # the section title is a strong signal - weight it
    title = section_title.lower()
    for k, kws in _CLAUSE_KEYWORDS.items():
        scores[k] += 3 * sum(w in title for w in kws + [k.replace("_", " ")])
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "other"


# ----------------------------------------------------------------------------- aiops
@lru_cache
def load_telemetry() -> dict:
    return json.loads((DATA / "aiops" / "telemetry.json").read_text())


# ----------------------------------------------------------------------------- inventory
def load_sales_history() -> dict[str, list[int]]:
    series: dict[str, list[int]] = {}
    with (DATA / "inventory" / "sales_history.csv").open() as f:
        for row in csv.DictReader(f):
            series.setdefault(row["sku"], []).append(int(row["units_sold"]))
    return series


def load_inventory_json(name: str):
    return json.loads((DATA / "inventory" / f"{name}.json").read_text())
