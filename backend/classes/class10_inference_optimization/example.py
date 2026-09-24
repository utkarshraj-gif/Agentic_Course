"""Class 10 - Cost/latency optimisation, measured on a realistic mixed workload.

Workload: 60 requests from the clinical, legal and AIOps assistants (with the repetition you
see in production - the same policy questions are asked all day).

Strategies compared with the same cost model (router.estimate):
  A. everything on the large model
  B. + model routing (small / medium / large by task)
  C. + semantic cache
  D. + context budget (trim retrieved context to what the answer needs)

Run:  python -m classes.class10_inference_optimization.example
"""
from __future__ import annotations

import random
import re
import statistics

from .router import TIERS, estimate, route
from .semantic_cache import SemanticCache

random.seed(3)

TEMPLATES = [  # (task text, risk, retrieved context tokens, output tokens)
    ("What HbA1c is required for GLP-1 approval?", "low", 1800, 80),
    ("What STOP-BANG score supports home sleep testing?", "low", 1500, 60),
    ("Classify this clause: limitation of liability or indemnification?", "low", 600, 20),
    ("Which law governs the Northwind NDA?", "low", 900, 30),
    ("Extract the notice period from the Acme renewal clause.", "low", 700, 25),
    ("Compare the Acme liability cap with our playbook and explain the risk.", "medium", 3500, 350),
    ("Why did payments-svc error rate spike? Give the root cause with evidence.", "high", 6000, 400),
    ("Should we deny PA-1004? Explain against MP-RX-221.", "high", 4000, 300),
]


def normalise(q: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s%-]", "", q.lower())).strip()


def workload(n: int = 60) -> list[tuple]:
    weights = [14, 10, 8, 6, 6, 6, 5, 5]   # FAQs dominate real traffic
    out = []
    for _ in range(n):
        t = random.choices(TEMPLATES, weights)[0]
        text = t[0] if random.random() < 0.7 else t[0].upper().rstrip("?.") + " ?"  # trivial variants
        out.append((text, *t[1:]))
    return out


def simulate(requests, use_router: bool, use_cache: bool, budget: int | None) -> dict:
    cache = SemanticCache(threshold=0.9)
    costs, lats, tiers = [], [], []
    for text, risk, ctx, out_tok in requests:
        prompt_tokens = 300 + (min(ctx, budget) if budget else ctx)
        if use_cache and risk != "high":          # never cache high-risk decisions
            ans, _ = cache.get(normalise(text), scope="global", corpus_version="2026-09")
            if ans:
                costs.append(0.0)
                lats.append(15.0)                  # embedding + lookup
                tiers.append("cache")
                continue
        tier = route(text, risk, prompt_tokens) if use_router else TIERS["large"]
        usd, ms = estimate(tier, prompt_tokens, out_tok)
        costs.append(usd)
        lats.append(ms)
        tiers.append(tier.name)
        if use_cache and risk != "high":
            cache.put(normalise(text), "cached-answer", scope="global", corpus_version="2026-09")
    lats.sort()
    return {"usd_per_1k_req": 1000 * sum(costs) / len(costs), "p50_ms": statistics.median(lats),
            "p95_ms": lats[int(0.95 * (len(lats) - 1))],
            "mix": {k: tiers.count(k) for k in ("cache", "small", "medium", "large") if k in tiers}}


if __name__ == "__main__":
    reqs = workload()
    rows = {
        "A all-large": simulate(reqs, False, False, None),
        "B + routing": simulate(reqs, True, False, None),
        "C + semantic cache": simulate(reqs, True, True, None),
        "D + context budget 1.5k": simulate(reqs, True, True, 1500),
    }
    base = rows["A all-large"]["usd_per_1k_req"]
    print(f"{'strategy':<26}{'$ / 1k req':>12}{'saving':>9}{'p50 ms':>9}{'p95 ms':>9}  mix")
    for name, r in rows.items():
        print(f"{name:<26}{r['usd_per_1k_req']:>12.3f}{1 - r['usd_per_1k_req'] / base:>9.0%}"
              f"{r['p50_ms']:>9.0f}{r['p95_ms']:>9.0f}  {r['mix']}")
    print("\nRouting examples:")
    for t in TEMPLATES[2::2]:
        print(f"  {route(t[0], t[1], t[2]).name:<7}<- {t[0]}")
