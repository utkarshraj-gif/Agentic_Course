import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.course_management_service import CourseManagementService

client = TestClient(app)

def test_list_admin_courses():
    response = client.get("/api/admin/courses")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["data"]) >= 1
    # Canonical course should be present
    slugs = [c["slug"] for c in data["data"]]
    assert "enterprise-ai" in slugs

def test_course_builder_lifecycle():
    # 1. Create Course (Draft)
    create_payload = {
        "title": "Advanced RAG Engineering",
        "slug": "advanced-rag-test",
        "short_title": "Advanced RAG",
        "category": "Agentic AI",
        "level": "Advanced",
        "description": "Production-grade retrieval systems and agentic RAG workflows.",
        "estimated_duration": "4 Weeks",
        "estimated_hours": 24,
        "tags": ["RAG", "FAISS", "DSPy"]
    }
    create_res = client.post("/api/admin/courses", json=create_payload)
    assert create_res.status_code == 200
    course = create_res.json()["data"]
    course_id = course["id"]
    assert course["status"] == "draft"

    # 2. Cannot publish without modules
    pub_fail = client.post(f"/api/admin/courses/{course_id}/publish")
    assert pub_fail.status_code == 422

    # 3. Add Module
    mod_res = client.post(f"/api/admin/courses/{course_id}/modules", json={
        "title": "RAG Foundations",
        "description": "Dense and sparse retrieval fundamentals.",
        "tools": ["FAISS", "BM25"]
    })
    assert mod_res.status_code == 200
    mod_data = mod_res.json()["data"]["modules"]
    assert len(mod_data) >= 1
    mod_id = mod_data[0]["id"]

    # 4. Add Class with Markdown, Mermaid, and Quiz
    class_res = client.post(f"/api/admin/courses/modules/{mod_id}/classes", json={
        "course_id": course_id,
        "title": "Introduction to Production RAG",
        "short_title": "Production RAG",
        "slug": "intro-prod-rag",
        "duration": "90 min",
        "description": "Core architecture of production retrieval augmented generation.",
        "lesson_content": "# Introduction to Production RAG\n\n## Architecture\n\n```mermaid\nflowchart TD\nUser --> Agent\nAgent --> Retriever\nRetriever --> VectorDB\n```\n\n## Code\n\n```python\nprint('RAG online')\n```",
        "topics": ["RAG", "VectorDB", "Embeddings"],
        "quiz": [
            {
                "id": "q1",
                "question": "What is the primary benefit of hybrid search?",
                "options": ["Cheaper storage", "Combines lexical and dense semantic signals", "Avoids indexing", "Removes LLM dependency"],
                "correctIndex": 1,
                "explanation": "Hybrid search combines dense vector similarity with sparse BM25 keyword matching for optimal recall."
            }
        ]
    })
    assert class_res.status_code == 200

    # 5. Validation should pass now
    val_res = client.get(f"/api/admin/courses/{course_id}/validate")
    assert val_res.status_code == 200
    assert val_res.json()["data"]["valid"] is True

    # 6. Publish Course
    pub_res = client.post(f"/api/admin/courses/{course_id}/publish")
    assert pub_res.status_code == 200
    assert pub_res.json()["data"]["status"] == "published"

    # 7. Learner catalog should now contain this course!
    learner_res = client.get("/api/curriculum/courses")
    assert learner_res.status_code == 200
    catalog = learner_res.json()["data"]
    published_slugs = [c["slug"] for c in catalog]
    assert "advanced-rag-test" in published_slugs

    # 8. Duplicate Course
    dup_res = client.post(f"/api/admin/courses/{course_id}/duplicate")
    assert dup_res.status_code == 200
    dup_data = dup_res.json()["data"]
    assert "Copy" in dup_data["title"]
    assert dup_data["status"] == "draft"

    # Clean up test course
    client.delete(f"/api/admin/courses/{course_id}?archive_only=false")
    client.delete(f"/api/admin/courses/{dup_data['id']}?archive_only=false")
