"""Agent memory (Class 6).

Three kinds of memory, same as LangGraph / LangMem terminology:
  * short-term  : the running message/state of one thread  -> LangGraph checkpointer
  * episodic    : what happened in past runs (summaries)   -> MemoryStore.add(kind="episode")
  * semantic    : durable facts & preferences              -> MemoryStore.add(kind="fact")

MemoryStore uses Redis when REDIS_URL is set (hashes + a JSON list per namespace) and an
in-process dict otherwise. Recall is embedding similarity + recency, filtered by namespace so
one patient's / client's / tenant's memories never leak into another's.
"""
from __future__ import annotations

import json
import math
import os
import time
import uuid
from dataclasses import asdict, dataclass

import numpy as np

from .embeddings import embed


@dataclass
class Memory:
    id: str
    namespace: str
    kind: str          # fact | episode | preference
    text: str
    ts: float
    importance: float = 0.5


class MemoryStore:
    def __init__(self, url: str | None = None):
        self.url = url or os.getenv("REDIS_URL")
        self._local: dict[str, list[Memory]] = {}
        self.r = None
        if self.url:
            import redis
            self.r = redis.Redis.from_url(self.url, decode_responses=True)

    # ------------------------------------------------------------ write
    def add(self, namespace: str, text: str, kind: str = "fact", importance: float = 0.5) -> Memory:
        existing = self.list(namespace)
        for m in existing:  # de-duplicate near-identical facts (LangMem-style consolidation)
            if m.kind == kind and float(np.dot(*embed([m.text, text]))) > 0.92:
                return m
        mem = Memory(uuid.uuid4().hex[:10], namespace, kind, text, time.time(), importance)
        if self.r:
            self.r.rpush(f"mem:{namespace}", json.dumps(asdict(mem)))
        else:
            self._local.setdefault(namespace, []).append(mem)
        return mem

    def list(self, namespace: str) -> list[Memory]:
        if self.r:
            return [Memory(**json.loads(x)) for x in self.r.lrange(f"mem:{namespace}", 0, -1)]
        return list(self._local.get(namespace, []))

    def forget(self, namespace: str) -> None:
        if self.r:
            self.r.delete(f"mem:{namespace}")
        else:
            self._local.pop(namespace, None)

    # ------------------------------------------------------------ read
    def recall(self, namespace: str, query: str, k: int = 3, half_life_days: float = 30) -> list[Memory]:
        mems = self.list(namespace)
        if not mems:
            return []
        vecs = embed([query] + [m.text for m in mems])
        q, M = vecs[0], vecs[1:]
        now = time.time()
        scored = []
        for m, v in zip(mems, M):
            recency = math.exp(-((now - m.ts) / 86400) / half_life_days)
            scored.append((0.7 * float(np.dot(q, v)) + 0.2 * recency + 0.1 * m.importance, m))
        return [m for _, m in sorted(scored, key=lambda x: -x[0])[:k]]
