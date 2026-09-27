import uuid
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_cohorts_management():
    # 1. List cohorts
    res = client.get("/api/admin/cohorts")
    assert res.status_code == 200
    cohorts = res.json()["data"]
    assert len(cohorts) >= 1
    cohort_id = cohorts[0]["id"]

    # 2. Get cohort detail
    detail_res = client.get(f"/api/admin/cohorts/{cohort_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()["data"]
    assert "members" in detail
    assert "courses" in detail

    # 3. Create new cohort
    suffix = uuid.uuid4().hex[:6]
    create_res = client.post("/api/admin/cohorts", json={
        "name": f"November 2026 — AI Security {suffix}",
        "description": "Enterprise security and red teaming specialists.",
        "start_date": "2026-11-01",
        "end_date": "2026-12-31"
    })
    assert create_res.status_code == 200
    new_cohort_id = create_res.json()["data"]["id"]

    # 4. Assign course with deadline
    assign_res = client.post(f"/api/admin/cohorts/{new_cohort_id}/courses", json={
        "course_id": "enterprise-ai",
        "start_date": "2026-11-01",
        "deadline": "2026-12-31"
    })
    assert assign_res.status_code == 200

    # 5. Bulk enroll learners
    bulk_res = client.post(f"/api/admin/cohorts/{new_cohort_id}/enroll", json={
        "user_ids": ["user_sarah_chen", "user_david_kim"]
    })
    assert bulk_res.status_code == 200
    assert bulk_res.json()["data"]["enrolled_count"] >= 1

def test_course_versioning_and_reviews():
    # 1. List versions
    res = client.get("/api/admin/courses/enterprise-ai/versions")
    assert res.status_code == 200
    versions = res.json()["data"]
    assert len(versions) >= 1

    # 2. Create version draft
    v_num = f"1.2-{uuid.uuid4().hex[:6]}"
    draft_res = client.post("/api/admin/courses/enterprise-ai/versions", json={
        "version_number": v_num,
        "change_summary": "Added MCP tools test revision"
    })
    assert draft_res.status_code == 200
    ver_id = draft_res.json()["data"]["id"]

    # 3. Transition lifecycle
    life_res = client.patch(f"/api/admin/courses/versions/{ver_id}/lifecycle", json={
        "status": "in_review"
    })
    assert life_res.status_code == 200

    # 4. Add review comment
    rev_res = client.post("/api/admin/courses/enterprise-ai/reviews", json={
        "entity_type": "course",
        "entity_id": "enterprise-ai",
        "author_name": "Reviewer Bot",
        "comment": "Clarify prerequisite requirements in Week 1."
    })
    assert rev_res.status_code == 200
    rev_id = rev_res.json()["data"]["review_id"]

    # 5. Resolve review comment
    resolve_res = client.patch(f"/api/admin/courses/reviews/{rev_id}/resolve?resolved_by=Staff%20Lead")
    assert resolve_res.status_code == 200

def test_audit_logs_and_risk_engine():
    # 1. Audit logs
    audit_res = client.get("/api/admin/audit-logs")
    assert audit_res.status_code == 200
    logs = audit_res.json()["data"]
    assert len(logs) >= 1

    # 2. Risk Overview
    risk_res = client.get("/api/admin/risk-overview")
    assert risk_res.status_code == 200
    risk_data = risk_res.json()["data"]
    assert "at_risk_count" in risk_data
    assert "reasons_tally" in risk_data
