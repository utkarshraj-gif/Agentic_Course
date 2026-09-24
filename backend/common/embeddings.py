"""Embeddings with an offline fallback.

online : OpenAI `text-embedding-3-small` (or EMBED_MODEL) via the same key/base_url.
offline: a hashed word + character n-gram vectoriser (scikit-learn). It captures lexical
         overlap only - good enough to demonstrate chunking, indexing, hybrid search and
         retrieval evaluation, and fully deterministic.
"""
from __future__ import annotations

import os

import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer

DIM = 768

_word = HashingVectorizer(n_features=DIM, ngram_range=(1, 2), alternate_sign=False,
                          norm=None, stop_words="english")
_char = HashingVectorizer(n_features=DIM, analyzer="char_wb", ngram_range=(3, 5),
                          alternate_sign=False, norm=None)


def _offline(texts: list[str]) -> np.ndarray:
    w = _word.transform(texts).toarray()
    c = _char.transform(texts).toarray()
    v = np.log1p(w) * 2.0 + np.log1p(c) * 0.5
    n = np.linalg.norm(v, axis=1, keepdims=True)
    return (v / np.where(n == 0, 1, n)).astype("float32")


def embed(texts: list[str]) -> np.ndarray:
    """Return an (n, d) float32 matrix of L2-normalised vectors."""
    if os.getenv("OPENAI_API_KEY") and os.getenv("OFFLINE", "0") != "1":
        from openai import OpenAI
        client = OpenAI(base_url=os.getenv("EMBED_BASE_URL") or os.getenv("LLM_BASE_URL"))
        resp = client.embeddings.create(model=os.getenv("EMBED_MODEL", "text-embedding-3-small"),
                                        input=texts)
        v = np.array([d.embedding for d in resp.data], dtype="float32")
        return v / np.linalg.norm(v, axis=1, keepdims=True)
    return _offline(texts)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) or 1.0))
