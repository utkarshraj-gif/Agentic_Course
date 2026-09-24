"""Class 10 - Model routing: send each request to the cheapest model that can handle it.

Tiers (prices are illustrative; plug in your own contract / GPU cost per 1M tokens):
  small  - 8B open model on vLLM   : classification, extraction, simple lookups
  medium - hosted mini model        : grounded Q&A, summaries
  large  - frontier model           : multi-step reasoning, contradictions, high-risk decisions

The router is itself cheap: rules + features first; a small classifier later if needed.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Tier:
    name: str
    model: str
    usd_per_1m_in: float
    usd_per_1m_out: float
    base_latency_ms: float
    ms_per_out_token: float


TIERS = {
    "small": Tier("small", "llama-3.1-8b-instruct@vllm", 0.05, 0.10, 60, 6),
    "medium": Tier("medium", "gpt-4o-mini", 0.15, 0.60, 250, 12),
    "large": Tier("large", "frontier-model", 2.50, 10.00, 600, 25),
}

HARD = re.compile(r"\b(compare|contradict|why|explain|trade-?off|deny|appeal|root cause|should we)\b", re.I)
SIMPLE = re.compile(r"\b(classify|extract|which law|what code|yes or no|list)\b", re.I)


def route(task: str, risk: str = "low", context_tokens: int = 0) -> Tier:
    if risk == "high" or HARD.search(task) or context_tokens > 12_000:
        return TIERS["large"]
    if SIMPLE.search(task) and context_tokens < 2_000:
        return TIERS["small"]
    return TIERS["medium"]


def estimate(tier: Tier, in_tokens: int, out_tokens: int) -> tuple[float, float]:
    """(usd, latency_ms) for one call - a cost model you calibrate against real measurements."""
    usd = in_tokens / 1e6 * tier.usd_per_1m_in + out_tokens / 1e6 * tier.usd_per_1m_out
    return usd, tier.base_latency_ms + out_tokens * tier.ms_per_out_token
