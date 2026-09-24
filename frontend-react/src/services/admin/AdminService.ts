// services/admin/AdminService.ts
// Frontend API client for Executive Administration & Telemetry

import { API_BASE } from '../api';

export interface AdminKPIs {
  totalLearners: number;
  activeToday: number;
  academyCompletionPct: number;
  averageQuizScore: number;
  totalAgentSandboxRuns: number;
  enterpriseReadinessScore: number;
  certificationsEligible: number;
  certificationsAwarded: number;
  highRiskDropoffClasses: number[];
}

export interface LearnerOverview {
  id: string;
  name: string;
  email: string;
  cohort: string;
  role: string;
  completed_classes: number[];
  quiz_avg: number;
  capstones: string[];
  last_active: string;
}

export interface ClassMatrixItem {
  classId: number;
  title?: string;
  status: 'completed' | 'pending';
  quiz: string;
  timeSpent: string;
}

export interface LearnerDossier {
  id: string;
  name: string;
  email: string;
  cohort: string;
  role: string;
  completionRate: number;
  completedClassesCount: number;
  totalClasses: number;
  quizAverage?: number;
  capstones?: string[];
  sandboxTelemetry?: {
    totalRuns: number;
    guardrailBlocks: number;
    hitlApprovals: number;
    avgExecutionSec: string;
  };
  classesMatrix: ClassMatrixItem[];
  recentActivity: Array<{
    type: string;
    label: string;
    class_id: number | null;
    time: string | null;
  }>;
}

export interface CurriculumAnalyticsItem {
  classId: number;
  title: string;
  domain: string;
  completionRate: number;
  dropoffRate: number;
  averageQuizScore: number;
  difficultyLevel: 'Low' | 'Medium' | 'High';
  avgDurationMin: number;
  totalPassed: number;
}

export interface ActivityStreamEvent {
  id: number;
  userId?: string;
  userName: string;
  email?: string;
  type: string;
  label: string;
  classId: number | null;
  timestamp: string;
}

export interface SandboxTelemetryData {
  totalInvocations: number;
  averageLatencyMs: number;
  securityGuardrailBlocks: number;
  humanInTheLoopApprovals: number;
  humanInTheLoopDenials: number;
  sandboxes: Array<{
    name: string;
    domain: string;
    runs: number;
    avgExecutionTime: string;
    phiRedactionsCount?: number;
    clausesTriaged?: number;
    promptInjectionBlocks?: number;
    rcaAccuracy?: string;
    toolsInvoked?: number;
    a2aMessagesExchanged?: number;
    reordersGenerated?: number;
    hitlDecisions?: { approved: number; escalated: number; denied: number };
  }>;
}

export class AdminService {
  static async getOverviewKPIs(): Promise<AdminKPIs> {
    const res = await fetch(`${API_BASE}/admin/overview`);
    if (!res.ok) throw new Error('Failed to fetch admin overview KPIs');
    const json = await res.json();
    return json.data;
  }

  static async getLearners(cohort?: string, search?: string): Promise<LearnerOverview[]> {
    const params = new URLSearchParams();
    if (cohort && cohort !== 'All') params.append('cohort', cohort);
    if (search) params.append('search', search);

    const url = `${API_BASE}/admin/learners${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch learners roster');
    const json = await res.json();
    return json.data;
  }

  static async getLearnerDossier(userId: string): Promise<LearnerDossier> {
    const res = await fetch(`${API_BASE}/admin/learners/${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`Failed to fetch learner dossier for ${userId}`);
    const json = await res.json();
    return json.data;
  }

  static async getCurriculumAnalytics(): Promise<CurriculumAnalyticsItem[]> {
    const res = await fetch(`${API_BASE}/admin/analytics/curriculum`);
    if (!res.ok) throw new Error('Failed to fetch curriculum analytics');
    const json = await res.json();
    return json.data;
  }

  static async getActivityStream(limit: number = 50): Promise<ActivityStreamEvent[]> {
    const res = await fetch(`${API_BASE}/admin/activity?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch activity stream');
    const json = await res.json();
    return json.data;
  }

  static async getSandboxTelemetry(): Promise<SandboxTelemetryData> {
    const res = await fetch(`${API_BASE}/admin/sandboxes`);
    if (!res.ok) throw new Error('Failed to fetch sandbox telemetry');
    const json = await res.json();
    return json.data;
  }
}
