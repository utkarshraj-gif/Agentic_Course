"""Class 10 - Semantic cache: reuse answers for questions that mean the same thing.

Exact-match caches miss "What HbA1c is needed for GLP-1?" vs "HbA1c threshold for GLP-1 approval?".
A semantic cache embeds the (normalised) question and returns a stored answer when cosine
similarity >= threshold AND the cache entry is still valid for the same scope + corpus version.

Safety rules for regulated domains:
  * key includes tenant/scope and corpus version -> invalidated when policies change
  * never cache answers that contain patient-specific data (cache only policy-level Q&A)
  * TTL on every entry
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from common.embeddings import embed


@dataclass
class CacheEntry:
    question: str
    vector: np.ndarray
    answer: str
    scope: str
    corpus_version: str
    created: float = field(default_factory=time.time)


class SemanticCache:
    def __init__(self, threshold: float = 0.80, ttl_s: float = 24 * 3600):
        self.threshold, self.ttl_s = threshold, ttl_s
        self.entries: list[CacheEntry] = []
        self.hits = self.misses = 0

    def get(self, question: str, scope: str, corpus_version: str) -> tuple[str | None, float]:
        if not self.entries:
            self.misses += 1
            return None, 0.0
        q = embed([question])[0]
        now = time.time()
        best, best_sim = None, 0.0
        for e in self.entries:
            if e.scope != scope or e.corpus_version != corpus_version or now - e.created > self.ttl_s:
                continue
            sim = float(np.dot(q, e.vector))
            if sim > best_sim:
                best, best_sim = e, sim
        if best and best_sim >= self.threshold:
            self.hits += 1
            return best.answer, best_sim
        self.misses += 1
        return None, best_sim

    def put(self, question: str, answer: str, scope: str, corpus_version: str) -> None:
        self.entries.append(CacheEntry(question, embed([question])[0], answer, scope, corpus_version))

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total else 0.0
