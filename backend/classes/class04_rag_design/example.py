"""Class 4 - RAG design choices, measured.

Corpus: 3 synthetic contracts + our negotiation playbook (legal).
We compare retrieval configurations on 12 golden questions with recall@3 and MRR:

  1. dense (Chroma, cosine)         4. hybrid + rerank
  2. sparse (BM25)                  5. hybrid + rerank + self-query metadata filter
  3. hybrid (RRF of 1 + 2)

Run:  python -m classes.class04_rag_design.example
"""
from __future__ import annotations

import json
import re

import chromadb

from common import DATA
from common.embeddings import embed
from common.retrieval import BM25Index, Chunk, HybridRetriever, chunk_markdown, load_markdown_dir

COUNTERPARTIES = {"acme": "acme-saas-msa", "northwind": "northwind-nda", "globex": "globex-services"}


def load_corpus() -> list[Chunk]:
    chunks = []
    for doc_id, text in load_markdown_dir(DATA / "legal" / "contracts"):
        chunks += chunk_markdown(doc_id, text, extra_meta={"doc_type": "contract"})
    chunks += chunk_markdown("playbook", (DATA / "legal" / "playbook.md").read_text(),
                             extra_meta={"doc_type": "playbook"})
    return [c for c in chunks if c.meta["section"] != "Overview"]


# ----------------------------------------------------------------------------- Chroma (dense)
class ChromaDense:
    """Chroma collection with our own embeddings (swap in any model; Chroma just stores + searches)."""

    def __init__(self, chunks: list[Chunk]):
        self.client = chromadb.EphemeralClient()          # PersistentClient(path=...) in production
        self.col = self.client.get_or_create_collection("legal", metadata={"hnsw:space": "cosine"},
                                                        embedding_function=None)
        self.by_id = {c.id: c for c in chunks}
        self.col.add(ids=[c.id for c in chunks], documents=[c.text for c in chunks],
                     embeddings=embed([c.text for c in chunks]).tolist(),
                     metadatas=[{k: str(v) for k, v in c.meta.items()} for c in chunks])

    def search(self, q: str, k: int = 3, where: dict | None = None):
        res = self.col.query(query_embeddings=embed([q]).tolist(), n_results=k, where=where or None)
        return [(self.by_id[i], 1 - d) for i, d in zip(res["ids"][0], res["distances"][0])]


# ----------------------------------------------------------------------------- self-query router
def self_query_filter(q: str) -> dict | None:
    """Turn cues in the question into a metadata filter. An LLM does this in production
    (LangChain's SelfQueryRetriever); rules are enough to show the idea."""
    ql = q.lower()
    for name, doc in COUNTERPARTIES.items():
        if re.search(rf"\b{name}\b", ql):
            return {"doc_id": doc}
    if "playbook" in ql or "our standard" in ql or re.search(r"\bour\b", ql):
        return {"doc_type": "playbook"}
    return None


# ----------------------------------------------------------------------------- evaluation
def evaluate(search_fn, gold: list[dict], k: int = 3) -> dict:
    recall = mrr = 0.0
    misses = []
    for g in gold:
        ids = [c.id for c, _ in search_fn(g["q"], k)]
        rel = set(g["relevant"])
        recall += len(rel & set(ids)) / len(rel)
        rank = next((i + 1 for i, x in enumerate(ids) if x in rel), None)
        mrr += 1 / rank if rank else 0
        if not rank:
            misses.append((g["q"], ids[:2]))
    n = len(gold)
    return {"recall@3": recall / n, "mrr": mrr / n, "misses": misses}


def main():
    chunks = load_corpus()
    gold = json.loads((DATA / "legal" / "questions_golden.json").read_text())
    dense, sparse, hybrid = ChromaDense(chunks), BM25Index(chunks), HybridRetriever(chunks)
    configs = {
        "1 dense (Chroma)": lambda q, k: dense.search(q, k),
        "2 sparse (BM25)": lambda q, k: sparse.search(q, k),
        "3 hybrid RRF": lambda q, k: hybrid.search(q, k, rerank=False),
        "4 hybrid + rerank": lambda q, k: hybrid.search(q, k, rerank=True),
        "5 + self-query filter": lambda q, k: hybrid.search(q, k, where=self_query_filter(q)),
    }
    print(f"corpus: {len(chunks)} chunks · {len(gold)} golden questions\n")
    print(f"{'configuration':<26}{'recall@3':>10}{'MRR':>8}")
    results = {}
    for name, fn in configs.items():
        r = evaluate(fn, gold)
        results[name] = r
        print(f"{name:<26}{r['recall@3']:>10.2f}{r['mrr']:>8.2f}")
    worst = min(results, key=lambda n: results[n]["mrr"])
    print(f"\nmisses for '{worst}':")
    for q, ids in results[worst]["misses"][:4]:
        print(f"  - {q}  -> got {ids}")
    print("\nChroma metadata filter example:",
          [c.id for c, _ in dense.search("liability cap", 2, where={"doc_type": "playbook"})])


if __name__ == "__main__":
    main()
