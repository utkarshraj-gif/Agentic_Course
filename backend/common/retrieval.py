"""Retrieval building blocks (Classes 3, 4, 9) reused by the capstone projects.

  load_markdown_dir -> chunk_markdown -> VectorIndex (FAISS) + BM25Index -> hybrid (RRF) -> rerank
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import faiss
import numpy as np
from rank_bm25 import BM25Okapi

from .embeddings import embed


@dataclass
class Chunk:
    id: str
    text: str
    meta: dict = field(default_factory=dict)


def load_markdown_dir(path: str | Path) -> list[tuple[str, str]]:
    return [(p.stem, p.read_text()) for p in sorted(Path(path).glob("*.md"))]


def chunk_markdown(doc_id: str, text: str, max_chars: int = 900, overlap: int = 120,
                   extra_meta: dict | None = None) -> list[Chunk]:
    """Structure-aware chunking: split on headings first, then pack paragraphs up to max_chars
    with a character overlap. Each chunk keeps its heading path as metadata (for citations)."""
    title = doc_id
    m = re.search(r"^#\s+(.+)$", text, re.M)
    if m:
        title = m.group(1).strip()
    head, sep, rest = text.partition("\n# ")
    fm = dict(re.findall(r"^(\w[\w_]*):\s*(.+)$", head, re.M)) if sep else {}  # key: value front matter
    if fm:
        text = "# " + rest
    pieces: list[tuple[str, str]] = []  # (section heading, text)
    for sec in re.split(r"(?m)^(?=##\s)", text):
        hm = re.match(r"##\s+(.+)", sec)
        heading = hm.group(1).strip() if hm else "Overview"
        paras = [p.strip() for p in sec.split("\n\n")
                 if p.strip() and not p.lstrip().startswith("#")]
        buf = ""
        for p in paras:
            if len(buf) + len(p) > max_chars and buf:
                pieces.append((heading, buf))
                buf = buf[-overlap:] + "\n\n" + p
            else:
                buf = (buf + "\n\n" + p).strip()
        if buf:
            pieces.append((heading, buf))
    return [Chunk(id=f"{doc_id}#{i}", text=t,
                  meta={"doc_id": doc_id, "title": title, "section": h, **fm, **(extra_meta or {})})
            for i, (h, t) in enumerate(pieces)]


class VectorIndex:
    """FAISS inner-product index over normalised vectors (= cosine similarity)."""

    def __init__(self, chunks: list[Chunk]):
        self.chunks = chunks
        vecs = embed([c.text for c in chunks])
        self.index = faiss.IndexFlatIP(vecs.shape[1])
        self.index.add(vecs)

    def search(self, query: str, k: int = 5, where: dict | None = None) -> list[tuple[Chunk, float]]:
        qv = embed([query])
        scores, idx = self.index.search(qv, min(len(self.chunks), k * 4 if where else k))
        out = []
        for s, i in zip(scores[0], idx[0]):
            c = self.chunks[i]
            if where and any(c.meta.get(key) != val for key, val in where.items()):
                continue
            out.append((c, float(s)))
        return out[:k]


_tok = re.compile(r"[a-z0-9]+")


def tokenize(t: str) -> list[str]:
    return _tok.findall(t.lower())


class BM25Index:
    def __init__(self, chunks: list[Chunk]):
        self.chunks = chunks
        self.bm25 = BM25Okapi([tokenize(c.text + " " + c.meta.get("section", "")) for c in chunks])

    def search(self, query: str, k: int = 5, where: dict | None = None) -> list[tuple[Chunk, float]]:
        scores = self.bm25.get_scores(tokenize(query))
        order = np.argsort(-scores)
        out = []
        for i in order:
            c = self.chunks[i]
            if where and any(c.meta.get(key) != val for key, val in where.items()):
                continue
            out.append((c, float(scores[i])))
            if len(out) == k:
                break
        return out


class HybridRetriever:
    """Reciprocal Rank Fusion of dense + sparse results, then an optional reranker."""

    def __init__(self, chunks: list[Chunk], rrf_k: int = 60):
        self.dense, self.sparse, self.rrf_k = VectorIndex(chunks), BM25Index(chunks), rrf_k

    def search(self, query: str, k: int = 5, where: dict | None = None,
               rerank: bool = True) -> list[tuple[Chunk, float]]:
        fused: dict[str, float] = {}
        by_id: dict[str, Chunk] = {}
        for results in (self.dense.search(query, k * 3, where), self.sparse.search(query, k * 3, where)):
            for rank, (c, _) in enumerate(results):
                fused[c.id] = fused.get(c.id, 0.0) + 1.0 / (self.rrf_k + rank + 1)
                by_id[c.id] = c
        ranked = sorted(fused.items(), key=lambda kv: -kv[1])[: k * 2]
        results = [(by_id[i], s) for i, s in ranked]
        return (rerank_overlap(query, results) if rerank else results)[:k]


def rerank_overlap(query: str, results: list[tuple[Chunk, float]]) -> list[tuple[Chunk, float]]:
    """Cheap cross-encoder stand-in: score = fused score + query-term coverage.
    Replace with a real cross-encoder (e.g. bge-reranker, Cohere Rerank) in production."""
    q = set(tokenize(query))
    rescored = []
    for c, s in results:
        cov = len(q & set(tokenize(c.text))) / (len(q) or 1)
        rescored.append((c, s + 0.05 * cov))
    return sorted(rescored, key=lambda x: -x[1])


def format_context(results: list[tuple[Chunk, float]]) -> str:
    return "\n\n".join(f"[{c.id}] ({c.meta.get('title')} > {c.meta.get('section')})\n{c.text}"
                       for c, _ in results)


_STOP = {"the", "a", "an", "is", "are", "for", "of", "to", "and", "or", "in", "on", "what", "which",
         "when", "how", "does", "do", "be", "with", "any", "should", "must", "before", "long", "used"}


def extractive_answer(query: str, results: list[tuple[Chunk, float]], n: int = 2) -> str:
    """Offline answer generator: pick the n sentences that best cover the query's rare terms and
    cite their chunk. A real LLM replaces this; the citation format stays identical.

    Scoring = IDF-weighted query-term coverage + a bonus when the chunk's document title matches
    the query (metadata-aware), minus a small penalty for lower retrieval rank."""
    import math
    q = {t for t in tokenize(query) if len(t) > 1} - _STOP
    if not q:
        return "I could not find this in the provided documents."
    titled = [r for r in results if q & set(tokenize(r[0].meta.get("title", "")))]
    pool = titled or results                      # prefer chunks from the document the query names
    sents = []
    for rank, (c, _) in enumerate(pool):
        for sent in re.split(r"(?<=\.)\s+", c.text.replace("\n", " ")):
            toks = set(tokenize(sent))
            if len(toks) >= 4 and not sent.lstrip().startswith((">", "#")):
                sents.append((sent.strip(), toks, c.id, rank))
    if not sents:
        return "I could not find this in the provided documents."
    df = {t: sum(t in s[1] for s in sents) for t in q}
    idf = {t: math.log(1 + len(sents) / (1 + df[t])) for t in q}
    total = sum(idf.values())
    scored = sorted(((sum(idf[t] for t in q & toks) / total - 0.03 * rank, sent, cid)
                     for sent, toks, cid, rank in sents), key=lambda x: -x[0])
    picked = [f"{sent} [{cid}]" for score, sent, cid in scored[:n] if score > 0]
    return " ".join(picked) if picked else "I could not find this in the provided documents."
