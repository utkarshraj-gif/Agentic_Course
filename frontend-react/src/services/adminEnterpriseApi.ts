// src/services/adminEnterpriseApi.ts
// Enterprise Phase 2 API Client: Cohorts, Course Versioning, Reviews, Audit Logs, Risk Engine

import { API_BASE } from './api';

export interface CohortCourse {
  id?: number;
  cohort_id: string;
  course_id: string;
  course_title?: string;
  course_version_id?: string;
  assigned_at?: string;
  deadline?: string;
  modules_count?: number;
  classes_count?: number;
}

export interface CohortMember {
  id?: number;
  cohort_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  joined_at?: string;
  status: 'active' | 'completed' | 'withdrawn' | 'paused';
  progress?: number;
  avg_score?: number;
  risk_status?: 'on_track' | 'at_risk' | 'ahead';
  risk_score?: number;
  risk_reasons?: string[];
}

export interface Cohort {
  id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status: 'active' | 'upcoming' | 'completed' | 'archived';
  created_by?: string;
  created_at: string;
  learners_count?: number;
  courses_count?: number;
  avg_progress?: number;
  members?: CohortMember[];
  courses?: CohortCourse[];
  risk_summary?: {
    at_risk: number;
    on_track: number;
    ahead: number;
  };
}

export interface CourseVersion {
  id: string;
  course_id: string;
  version_number: string;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'superseded' | 'archived';
  created_by?: string;
  change_summary?: string;
  snapshot_data?: any;
  created_at: string;
  published_at?: string;
}

export interface ReviewComment {
  id: number;
  course_id: string;
  version_id?: string;
  entity_type: 'course' | 'module' | 'class';
  entity_id?: string;
  author_name: string;
  author_role?: string;
  comment: string;
  status: 'open' | 'resolved';
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

export interface AuditLog {
  id: number;
  action: string;
  actor_id?: string;
  actor_name: string;
  actor_role: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface LearnerRiskItem {
  user_id: string;
  user_name: string;
  user_email: string;
  cohort: string;
  course_id: string;
  risk_score: number;
  status: 'ahead' | 'on_track' | 'at_risk';
  reasons: string[];
  inactive_days: number;
  progress_gap: number;
  avg_score: number;
  updated_at: string;
}

export interface RiskOverview {
  total_evaluated: number;
  at_risk_count: number;
  on_track_count: number;
  ahead_count: number;
  critical_inactivity_count: number;
  behind_schedule_count: number;
  failing_assessments_count: number;
  learners: LearnerRiskItem[];
}

// ---------------- Cohorts API ----------------
export async function listCohorts(): Promise<Cohort[]> {
  const res = await fetch(`${API_BASE}/admin/cohorts`);
  if (!res.ok) throw new Error('Failed to load cohorts');
  const json = await res.json();
  return json.data || [];
}

export async function getCohortDetail(cohortId: string): Promise<Cohort> {
  const res = await fetch(`${API_BASE}/admin/cohorts/${cohortId}`);
  if (!res.ok) throw new Error(`Failed to load cohort ${cohortId}`);
  const json = await res.json();
  return json.data;
}

export async function createCohort(payload: {
  id?: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}): Promise<Cohort> {
  const res = await fetch(`${API_BASE}/admin/cohorts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create cohort');
  }
  const json = await res.json();
  return json.data;
}

export async function updateCohort(
  cohortId: string,
  payload: Partial<Cohort>
): Promise<Cohort> {
  const res = await fetch(`${API_BASE}/admin/cohorts/${cohortId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update cohort');
  }
  const json = await res.json();
  return json.data;
}

export async function assignCourseToCohort(
  cohortId: string,
  payload: { course_id: string; course_version_id?: string; deadline?: string }
): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/cohorts/${cohortId}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to assign course');
  }
  return res.json();
}

export async function addMemberToCohort(
  cohortId: string,
  payload: { user_id: string; status?: string }
): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/cohorts/${cohortId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to add member to cohort');
  }
  return res.json();
}

export async function bulkEnrollCohort(
  cohortId: string,
  payload: {
    user_ids?: string[];
    course_ids?: string[];
    assign_all_learners?: boolean;
    deadline?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/cohorts/${cohortId}/bulk-enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Bulk enrollment failed');
  }
  return res.json();
}

// ---------------- Course Versions API ----------------
export async function listCourseVersions(courseId: string): Promise<CourseVersion[]> {
  const res = await fetch(`${API_BASE}/admin/courses/${courseId}/versions`);
  if (!res.ok) throw new Error('Failed to load course versions');
  const json = await res.json();
  return json.data || [];
}

export async function createCourseVersionDraft(
  courseId: string,
  payload: { version_number: string; change_summary: string; created_by?: string }
): Promise<CourseVersion> {
  const res = await fetch(`${API_BASE}/admin/courses/${courseId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create version draft');
  }
  const json = await res.json();
  return json.data;
}

export async function updateCourseVersionStatus(
  courseId: string,
  versionId: string,
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'superseded' | 'archived'
): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/courses/${courseId}/versions/${versionId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update version status');
  }
  return res.json();
}

// ---------------- Content Reviews API ----------------
export async function listReviewComments(courseId: string): Promise<ReviewComment[]> {
  const res = await fetch(`${API_BASE}/admin/courses/${courseId}/reviews`);
  if (!res.ok) throw new Error('Failed to load review comments');
  const json = await res.json();
  return json.data || [];
}

export async function createReviewComment(
  courseId: string,
  payload: {
    version_id?: string;
    entity_type: 'course' | 'module' | 'class';
    entity_id?: string;
    author_name?: string;
    author_role?: string;
    comment: string;
  }
): Promise<ReviewComment> {
  const res = await fetch(`${API_BASE}/admin/courses/${courseId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to post review comment');
  }
  const json = await res.json();
  return json.data;
}

export async function resolveReviewComment(courseId: string, commentId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/courses/${courseId}/reviews/${commentId}/resolve`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to resolve review comment');
  }
  return res.json();
}

// ---------------- Audit Logs API ----------------
export async function listAuditLogs(params?: {
  action?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  const q = new URLSearchParams();
  if (params?.action) q.set('action', params.action);
  if (params?.limit) q.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/admin/audit-logs?${q.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  const json = await res.json();
  return json.data || [];
}

// ---------------- Risk Engine API ----------------
export async function getRiskOverview(cohortId?: string): Promise<RiskOverview> {
  const q = cohortId ? `?cohort_id=${encodeURIComponent(cohortId)}` : '';
  const res = await fetch(`${API_BASE}/admin/risk-overview${q}`);
  if (!res.ok) throw new Error('Failed to fetch risk overview');
  const json = await res.json();
  return json.data;
}
