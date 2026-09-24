// pages/admin/AdminDashboardPage.tsx
// Professional Enterprise Training Overview

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Award,
  Terminal,
  ArrowRight,
  TrendingUp,
  Shield,
  RefreshCw,
  Clock,
  BookOpen,
  Activity,
  Download
} from 'lucide-react';
import { AdminService } from '../../services/admin/AdminService';
import type {
  AdminKPIs,
  ActivityStreamEvent,
  CurriculumAnalyticsItem
} from '../../services/admin/AdminService';
import { AdminErrorBanner } from '../../components/admin/AdminErrorBanner';
import { downloadCsv } from '../../services/admin/exportUtils';
import { AdminDashboardSkeleton } from '../../components/common/Skeleton';

export function AdminDashboardPage() {
  const [kpis, setKpis] = useState<AdminKPIs | null>(null);
  const [activity, setActivity] = useState<ActivityStreamEvent[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const [kpiRes, actRes, currRes] = await Promise.all([
        AdminService.getOverviewKPIs(),
        AdminService.getActivityStream(8),
        AdminService.getCurriculumAnalytics(),
      ]);
      setKpis(kpiRes);
      setActivity(actRes);
      setCurriculum(currRes);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err);
      if (!kpis) {
        setError(err.message || 'Failed to communicate with Enterprise Training metrics API.');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [kpis]);

  useEffect(() => {
    loadData();
  }, []);

  // Visibility-aware polling every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData]);

  const handleExportSummary = () => {
    if (!kpis) return;
    const headers = ['Metric', 'Value', 'Context'];
    const rows = [
      ['Total Learners Enrolled', kpis.totalLearners, 'Organization Total'],
      ['Active Learners Today', kpis.activeToday, '24h window'],
      ['Curriculum Completion Rate (%)', `${kpis.academyCompletionPct}%`, 'Global Average'],
      ['Average Quiz Score (%)', `${kpis.averageQuizScore}%`, 'Target >80%'],
      ['Total Agent Sandbox Runs', kpis.totalAgentSandboxRuns, 'Hands-on Labs'],
      ['Enterprise Readiness Score', `${kpis.enterpriseReadinessScore} / 100`, 'Competency Metric'],
      ['Certifications Awarded', kpis.certificationsAwarded, 'Certified Engineers'],
      ['Certifications Eligible', kpis.certificationsEligible, 'Pending Certification'],
    ];
    downloadCsv('enterprise_training_kpis', headers, rows);
  };

  if (loading && !kpis) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <div className="page page--admin">
      {/* Degraded State Banner */}
      {error && (
        <AdminErrorBanner
          title="Dashboard Telemetry Unavailable"
          message={error}
          onRetry={() => loadData(false)}
        />
      )}

      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Enterprise Training Overview
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Company-wide progress metrics, module completion rates, and hands-on lab evaluations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => loadData(false)} className="btn btn--outline btn--sm" style={{ gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExportSummary} className="btn btn--outline btn--sm" style={{ gap: '6px' }}>
            <Download size={14} /> Export Overview
          </button>
        </div>
      </div>

      {/* KPI Stats Grid - Fluid Responsive Auto-Fit */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Enrolled Learners</span>
              <div className="stat-icon-wrap">
                <Users size={15} />
              </div>
            </div>
            <div className="stat-value">{kpis.totalLearners}</div>
            <div className="stat-desc">
              <strong style={{ color: 'var(--green)', fontWeight: 600 }}>+{kpis.activeToday} active today</strong> across cohorts
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Course Completion</span>
              <div className="stat-icon-wrap">
                <TrendingUp size={15} />
              </div>
            </div>
            <div className="stat-value">{kpis.academyCompletionPct}%</div>
            <div className="progress-bar" style={{ height: '5px', margin: '4px 0 6px 0' }}>
              <div className="progress-fill" style={{ width: `${kpis.academyCompletionPct}%`, background: 'var(--primary)' }} />
            </div>
            <div className="stat-desc">Organization average</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Avg. Quiz Score</span>
              <div className="stat-icon-wrap">
                <Award size={15} />
              </div>
            </div>
            <div className="stat-value">{kpis.averageQuizScore}%</div>
            <div className="stat-desc">Target: &gt;80% pass threshold</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Hands-on Labs</span>
              <div className="stat-icon-wrap">
                <Terminal size={15} />
              </div>
            </div>
            <div className="stat-value">{kpis.totalAgentSandboxRuns}</div>
            <div className="stat-desc">Completed across 4 capstones</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Readiness Score</span>
              <div className="stat-icon-wrap">
                <Shield size={15} />
              </div>
            </div>
            <div className="stat-value">{kpis.enterpriseReadinessScore} / 100</div>
            <div className="stat-desc">{kpis.certificationsEligible} certified candidates</div>
          </div>
        </div>
      )}

      {/* Two Column Grid: Module Progress & Recent Activity */}
      <div className="dashboard-grid-layout" style={{ marginTop: '0.5rem' }}>
        {/* Left Column: Module Completion Rates */}
        <div className="dashboard-main-col">
          <section className="dashboard-card">
            <div className="dashboard-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={16} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'none', letterSpacing: 'normal', margin: 0 }}>
                  Module Completion Rates
                </h2>
              </div>
              <Link to="/admin/analytics" className="card-link" style={{ fontSize: '0.8rem', color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Detailed analytics <ArrowRight size={12} />
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0.25rem 0' }}>
              {curriculum.slice(0, 10).map((c) => (
                <div key={c.classId} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.84rem' }}>
                  <span
                    style={{
                      minWidth: '60px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      background: 'var(--bg-light)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}
                  >
                    Class {String(c.classId).padStart(2, '0')}
                  </span>
                  <span style={{ width: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)', fontWeight: 500 }} title={c.title}>
                    {c.title}
                  </span>
                  <div className="progress-bar" style={{ flex: 1, height: '6px' }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${c.completionRate}%`,
                        backgroundColor: c.dropoffRate > 40 ? 'var(--amber)' : 'var(--green)'
                      }}
                    />
                  </div>
                  <span style={{ minWidth: '45px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                    {c.completionRate}%
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Showing top 10 modules</span>
              <Link to="/admin/analytics" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                View all 15 modules & drop-off curves →
              </Link>
            </div>
          </section>
        </div>

        {/* Right Column: Live Event Surveillance Stream */}
        <div className="dashboard-side-col">
          <section className="dashboard-card">
            <div className="dashboard-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'none', letterSpacing: 'normal', margin: 0 }}>
                  Live Event Surveillance
                </h2>
              </div>
              <Link to="/admin/activity" className="card-link" style={{ fontSize: '0.8rem', color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Full audit trail <ArrowRight size={12} />
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0.25rem 0' }}>
              {activity.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No recent activity logged yet.
                </div>
              ) : (
                activity.map((act) => (
                  <div
                    key={act.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '0.65rem 0.85rem',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8rem',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: 'rgba(7, 210, 224, 0.1)',
                        color: 'var(--primary-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      <Activity size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <Link
                          to={`/admin/learners/${act.userId || 'user_sarah_chen'}`}
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textDecoration: 'none'
                          }}
                          className="hover-underline"
                          title={`Inspect particular data for ${act.userName}`}
                        >
                          {act.userName}
                        </Link>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', flexShrink: 0, marginLeft: '6px' }}>
                          <Clock size={10} style={{ display: 'inline', marginRight: '2px' }} />
                          {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {act.label}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
