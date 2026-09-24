"""Class 3 - What an embedding space looks like.

Prints a cosine-similarity matrix for clinical sentences. With a real embedding model
(OPENAI_API_KEY set), paraphrases score high even with no shared words ("heart attack" vs
"myocardial infarction"). The offline hashing embedder only sees shared words and character
n-grams - a useful way to *see* why lexical search misses paraphrases.

Run:  python -m classes.class03_embeddings_rag.embeddings_demo
"""
import numpy as np

from common.embeddings import embed

SENTENCES = [
    "Patient had a heart attack last year.",
    "History of myocardial infarction in 2025.",
    "Low back pain radiating to the left leg for 9 weeks.",
    "Lumbar radiculopathy with sciatica, two months duration.",
    "HbA1c of 8.4% on metformin.",
]

if __name__ == "__main__":
    V = embed(SENTENCES)
    S = V @ V.T
    print("cosine similarity (1.0 = identical direction)\n")
    print(" " * 6 + "".join(f"  S{i}  " for i in range(len(SENTENCES))))
    for i, row in enumerate(S):
        print(f"S{i}  " + "".join(f"{v:6.2f}" for v in row))
    print()
    for i, s in enumerate(SENTENCES):
        print(f"S{i}: {s}")
    pairs = [(S[i, j], i, j) for i in range(len(S)) for j in range(i + 1, len(S))]
    best = max(pairs)
    print(f"\nclosest pair: S{best[1]} ~ S{best[2]} ({best[0]:.2f}); vector dim = {V.shape[1]}")
    print("norms:", np.round(np.linalg.norm(V, axis=1), 3))
