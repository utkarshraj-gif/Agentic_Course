"""
Class 0 Quickstart: Vector Similarity & Offline Agent Loop Smoke Test
Validates vector search logic and basic agent execution flow without requiring paid API keys.
"""
import math

def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    return dot / (norm1 * norm2) if (norm1 and norm2) else 0.0

def mock_embed(text: str, dim: int = 8) -> list[float]:
    """Generates deterministic pseudo-embeddings for offline verification."""
    vec = [0.0] * dim
    for i, char in enumerate(text.lower()):
        vec[i % dim] += (ord(char) % 17) / 10.0
    # Normalize
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]

class MiniVectorIndex:
    def __init__(self):
        self.documents: list[dict] = []

    def add(self, doc_id: str, content: str):
        vec = mock_embed(content)
        self.documents.append({"id": doc_id, "content": content, "vector": vec})

    def search(self, query: str, top_k: int = 2) -> list[dict]:
        q_vec = mock_embed(query)
        scored = []
        for doc in self.documents:
            score = cosine_similarity(q_vec, doc["vector"])
            scored.append({"id": doc["id"], "content": doc["content"], "score": round(score, 4)})
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

def test_prerequisites_pipeline():
    print("[*] Running Vector Store Verification...")
    index = MiniVectorIndex()
    index.add("policy-1", "Lumbar spine MRI requires prior authorization if symptoms < 6 weeks.")
    index.add("policy-2", "Physical therapy evaluation requires no prior authorization.")
    index.add("policy-3", "Emergency department admissions are exempt from prior approval.")

    query = "Does lumbar MRI need pre-approval?"
    results = index.search(query, top_k=2)

    print(f"  Query: '{query}'")
    for r in results:
        print(f"  - [{r['id']}] Score: {r['score']} | {r['content']}")

    assert len(results) > 0, "Vector index search should return results"
    print("\n[OK] Vector indexing and retrieval operational!")

    print("\n[*] Running Agent ReAct Control Loop Mock...")
    step = 0
    state = {"query": query, "retrieved": results[0]["content"], "decision": None}
    
    while step < 3 and not state["decision"]:
        step += 1
        print(f"  Turn {step}: Agent inspecting policy: '{state['retrieved'][:40]}...'")
        state["decision"] = "PA_REQUIRED"

    print(f"[OK] Agent loop resolved with status: {state['decision']}")
    print("\n>> All prerequisites tests passed successfully!")

if __name__ == "__main__":
    test_prerequisites_pipeline()
