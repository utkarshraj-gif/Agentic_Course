"""Class 3 - A complete, citation-grounded RAG pipeline over clinical medical policies.

    ingest -> chunk (structure-aware) -> embed -> FAISS index
    question -> embed -> top-k -> grounded prompt -> answer with [doc#chunk] citations

Run:  python -m classes.class03_embeddings_rag.example
      python -m classes.class03_embeddings_rag.example "What HbA1c is needed for GLP-1 approval?"
"""
from __future__ import annotations

import sys

from common import DATA
from common.domain import load_clinical_golden
from common.llm import get_llm
from common.retrieval import (VectorIndex, chunk_markdown, extractive_answer, format_context,
                              load_markdown_dir)

GROUNDED_PROMPT = """You answer questions about health-plan medical policies.
Use ONLY the context below. Cite every sentence with the chunk id in square brackets, e.g. [mri-lumbar-spine#2].
If the answer is not in the context, say "Not found in policy documents." Do not give medical advice.

Context:
{context}

Question: {question}"""


def build_index() -> VectorIndex:
    docs = load_markdown_dir(DATA / "clinical" / "guidelines")
    chunks = [c for doc_id, text in docs for c in chunk_markdown(doc_id, text, max_chars=700)]
    print(f"indexed {len(docs)} policies -> {len(chunks)} chunks")
    return VectorIndex(chunks)


def answer(index: VectorIndex, question: str, k: int = 3) -> dict:
    results = index.search(question, k=k)
    prompt = GROUNDED_PROMPT.format(context=format_context(results), question=question)
    text = get_llm().chat(prompt, fallback=lambda: extractive_answer(question, results))
    return {"question": question, "answer": text,
            "sources": [(c.id, c.meta["section"], round(s, 3)) for c, s in results]}


def retrieval_hit_rate(index: VectorIndex, k: int = 3) -> float:
    gold = load_clinical_golden()
    hits = sum(any(c.meta["doc_id"] == g["relevant_doc"] for c, _ in index.search(g["q"], k)) for g in gold)
    return hits / len(gold)


if __name__ == "__main__":
    idx = build_index()
    qs = sys.argv[1:] or ["How long must conservative therapy last before a lumbar MRI?",
                          "What family history excludes a patient from GLP-1 therapy?"]
    for q in qs:
        out = answer(idx, q)
        print(f"\nQ: {out['question']}\nA: {out['answer']}")
        for cid, sec, s in out["sources"]:
            print(f"   source {cid:<26} {sec:<28} score={s}")
    print(f"\nhit@3 on the 10-question golden set: {retrieval_hit_rate(idx):.0%}")
