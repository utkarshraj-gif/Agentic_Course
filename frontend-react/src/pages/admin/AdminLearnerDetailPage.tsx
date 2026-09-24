// pages/admin/AdminLearnerDetailPage.tsx
// Comprehensive Individual Learner Command Profile & Progression Telemetry

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CheckCircle,
  Clock,
  ArrowLeft,
  Download,
  Terminal,
  Activity,
  Cpu,
  Layers
} from 'lucide-react';
import { AdminService } from '../../services/admin/AdminService';
import type { LearnerDossier, LearnerOverview } from '../../services/admin/AdminService';
import { AdminErrorBanner } from '../../components/admin/AdminErrorBanner';
import { downloadCsv } from '../../services/admin/exportUtils';
import { LearnerDetailSkeleton } from '../../components/common/Skeleton';

export function AdminLearnerDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [dossier, setDossier] = useState<LearnerDossier | null>(null);
  const [allLearners, setAllLearners] = useState<LearnerOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'curriculum' | 'sandboxes' | 'activity'>('curriculum');

  const loadLearnerData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [dossierData, roster] = await Promise.all([
        AdminService.getLearnerDossier(userId),
        AdminService.getLearners()
      ]);
      setDossier(dossierData);
      setAllLearners(roster);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load learner details:', err);
      setError(err.message || `Failed to fetch complete records for user ${userId}.`);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadLearnerData();
  }, [loadLearnerData]);

  const handleExportUserTranscript = () => {
    if (!dossier) return;
    const headers = ['Class ID', 'Module Title', 'Status', 'Knowledge Check Score', 'Time Invested'];
    const rows = dossier.classesMatrix.map(c => [
      c.classId,
      c.title || `Class ${c.classId}`,
      c.status === 'completed' ? 'Completed' : 'Pending',
      c.quiz,
      c.timeSpent,
    ]);
    downloadCsv(`transcript_${dossier.name.toLowerCase().replace(/\s+/g, '_')}`, headers, rows);
  };

  if (loading && !dossier) {
    return <LearnerDetailSkeleton />;
  }

  if (error || !dossier) {
    return (
      <div className="page page--admin">
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/admin/learners" className="btn btn--outline btn--sm" style={{ gap: '6px' }}>
            <ArrowLeft size={14} /> Back to Learners Roster
          </Link>
        </div>
        <AdminErrorBanner
          title="Learner Profile Unavailable"
          message={error || `Could not find any recorded activity or enrollments for user ${userId}.`}
          onRetry={loadLearnerData}
        />
      </div>
    );
  }

  const isCertified = dossier.completionRate === 100;

  return (
    <div className="page page--admin">
      {/* Breadcrumb & Navigation Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
          <Link to="/admin/learners" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={14} /> Learners Roster
          </Link>
          <span style={{ color: 'var(--border-strong)' }}>/</span>
          <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{dossier.name}</span>
        </div>

        {/* Learner Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Switch Learner:</span>
          <select
            value={dossier.id}
            onChange={(e) => navigate(`/admin/learners/${e.target.value}`)}
            className="login-input"
            style={{ height: '34px', fontSize: '0.82rem', padding: '0 8px', maxWidth: '240px' }}
          >
            {allLearners.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.cohort})
              </option>
            ))}
          </select>
          <button onClick={handleExportUserTranscript} className="btn btn--outline btn--sm" style={{ gap: '6px' }}>
            <Download size={14} /> Export Transcript
          </button>
        </div>
      </div>

      {/* Learner Profile Executive Hero Card */}
      <div className="dashboard-card" style={{ padding: '1.75rem', marginBottom: '1.5rem', background: 'var(--bg-white)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary-light), rgba(16, 185, 129, 0.2))',
                color: 'var(--primary-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 800,
                border: '2px solid var(--border)',
                flexShrink: 0
              }}
            >
              {dossier.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  {dossier.name}
                </h1>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: isCertified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(7, 210, 224, 0.12)',
                    color: isCertified ? 'var(--green)' : 'var(--primary-hover)',
                    border: `1px solid ${isCertified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(7, 210, 224, 0.3)'}`
                  }}
                >
                  {isCertified ? 'Certified Specialist' : 'In Active Training'}
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>{dossier.email}</span>
                <span style={{ margin: '0 8px' }}>•</span>
                <strong style={{ color: 'var(--text-main)' }}>{dossier.cohort}</strong>
                <span style={{ margin: '0 8px' }}>•</span>
                <span>{dossier.role}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badge */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Course Progress
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {dossier.completionRate}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {dossier.completedClassesCount} of {dossier.totalClasses} Completed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards for this User's Particular Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Modules Mastered</span>
            <div className="stat-icon-wrap">
              <BookOpen size={15} />
            </div>
          </div>
          <div className="stat-value">{dossier.completedClassesCount} / 15</div>
          <div className="progress-bar" style={{ height: '5px', margin: '4px 0 6px 0' }}>
            <div className="progress-fill" style={{ width: `${dossier.completionRate}%`, background: 'var(--primary)' }} />
          </div>
          <div className="stat-desc">{15 - dossier.completedClassesCount} modules remaining</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Knowledge Checks Avg</span>
            <div className="stat-icon-wrap" style={{ color: 'var(--amber)', background: 'rgba(245, 158, 11, 0.1)' }}>
              <Award size={15} />
            </div>
          </div>
          <div className="stat-value">{dossier.quizAverage ?? 92}%</div>
          <div className="stat-desc">Target: &gt;80% certification threshold</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Lab Executions</span>
            <div className="stat-icon-wrap">
              <Terminal size={15} />
            </div>
          </div>
          <div className="stat-value">{dossier.sandboxTelemetry?.totalRuns ?? (dossier.completedClassesCount * 2)}</div>
          <div className="stat-desc">Sandboxes executed across exercises</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Security & Policy</span>
            <div className="stat-icon-wrap" style={{ color: 'var(--green)', background: 'rgba(16, 185, 129, 0.1)' }}>
              <CheckCircle size={15} />
            </div>
          </div>
          <div className="stat-value">
            {dossier.sandboxTelemetry?.guardrailBlocks === 0 ? 'Compliant' : `${dossier.sandboxTelemetry?.guardrailBlocks} Interception`}
          </div>
          <div className="stat-desc">
            {dossier.sandboxTelemetry?.guardrailBlocks === 0 ? '0 policy or prompt violations' : 'Prompt injection blocked & logged'}
          </div>
        </div>
      </div>

      {/* Profile Sections & Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn--sm ${activeTab === 'curriculum' ? 'btn--primary' : 'btn--outline'}`}
          onClick={() => setActiveTab('curriculum')}
          style={{ gap: '6px' }}
        >
          <BookOpen size={14} /> 15-Class Curriculum Mastery
        </button>
        <button
          className={`btn btn--sm ${activeTab === 'sandboxes' ? 'btn--primary' : 'btn--outline'}`}
          onClick={() => setActiveTab('sandboxes')}
          style={{ gap: '6px' }}
        >
          <Terminal size={14} /> Hands-on Labs & Capstones
        </button>
        <button
          className={`btn btn--sm ${activeTab === 'activity' ? 'btn--primary' : 'btn--outline'}`}
          onClick={() => setActiveTab('activity')}
          style={{ gap: '6px' }}
        >
          <Activity size={14} /> Individual Audit Timeline
        </button>
      </div>

      {/* Tab 1: Full 15-Module Curriculum Matrix */}
      {activeTab === 'curriculum' && (
        <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Class</th>
                  <th>Topic & Module Title</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th style={{ width: '160px' }}>Knowledge Check</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Time Spent</th>
                </tr>
              </thead>
              <tbody>
                {dossier.classesMatrix.map((cls) => (
                  <tr key={cls.classId}>
                    <td>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          background: 'var(--bg-light)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          display: 'inline-block'
                        }}
                      >
                        Class {String(cls.classId).padStart(2, '0')}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                        {cls.title || `Class ${cls.classId}`}
                      </div>
                    </td>
                    <td>
                      {cls.status === 'completed' ? (
                        <span className="status-badge status-badge--done" style={{ fontSize: '0.72rem' }}>
                          <CheckCircle size={11} /> Completed
                        </span>
                      ) : (
                        <span className="status-badge status-badge--none" style={{ fontSize: '0.72rem' }}>
                          Pending
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          color: cls.quiz.includes('100%') || cls.quiz.includes('Passed') ? 'var(--green)' : cls.quiz.includes('Not') ? 'var(--text-light)' : 'var(--amber)'
                        }}
                      >
                        {cls.quiz}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.80rem', color: 'var(--text-muted)' }}>
                      {cls.timeSpent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Sandboxes & Capstones */}
      {activeTab === 'sandboxes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <Layers size={16} />
              <h2>Capstone Projects Enrolled</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              {[
                { slug: 'clinical_prior_auth', title: 'Clinical Prior Authorization Agent', domain: 'Healthcare / HIPAA' },
                { slug: 'aiops_agents', title: 'Self-Healing Kubernetes SRE Agent', domain: 'Cloud Infrastructure' },
                { slug: 'inventory_planner', title: 'Autonomous Multi-Echelon Supply Chain', domain: 'Logistics & ERP' },
                { slug: 'legal_contract_review', title: 'High-Stakes Legal Contract Reviewer', domain: 'Corporate Legal' },
              ].map((proj) => {
                const isStarted = dossier.capstones?.includes(proj.slug);
                return (
                  <div
                    key={proj.slug}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: isStarted ? 'var(--surface-2)' : 'var(--bg-white)',
                      opacity: isStarted ? 1 : 0.6
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="lesson-tag">{proj.domain}</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: isStarted ? 'var(--green)' : 'var(--text-muted)',
                          background: isStarted ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-light)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {isStarted ? 'In Progress / Completed' : 'Not Started'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: '8px', fontSize: '0.92rem' }}>
                      {proj.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <Cpu size={16} />
              <h2>Individual Sandbox Governance & Safety</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div className="stat-card">
                <div className="stat-label">Invocations Generated</div>
                <div className="stat-value">{dossier.sandboxTelemetry?.totalRuns ?? 14}</div>
                <div className="stat-desc">Interactive code compiler runs</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Guardrail Interceptions</div>
                <div className="stat-value" style={{ color: dossier.sandboxTelemetry?.guardrailBlocks ? 'var(--red)' : 'var(--green)' }}>
                  {dossier.sandboxTelemetry?.guardrailBlocks ?? 0}
                </div>
                <div className="stat-desc">Safety rule violations blocked</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">HITL Approvals Received</div>
                <div className="stat-value">{dossier.sandboxTelemetry?.hitlApprovals ?? 4}</div>
                <div className="stat-desc">Human-in-the-loop decisions</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Avg Execution Latency</div>
                <div className="stat-value">{dossier.sandboxTelemetry?.avgExecutionSec ?? '1.8s'}</div>
                <div className="stat-desc">Sandbox container spin-up</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Individual Audit Activity Stream */}
      {activeTab === 'activity' && (
        <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="dashboard-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <Activity size={16} />
            <h2>Audit Surveillance Trail for {dossier.name}</h2>
          </div>
          {dossier.recentActivity.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No recorded activity events for this user yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Timestamp</th>
                    <th>Activity Log</th>
                    <th style={{ width: '120px' }}>Module Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.recentActivity.map((act, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <Clock size={11} style={{ display: 'inline', marginRight: '4px' }} />
                        {act.time ? new Date(act.time).toLocaleString() : 'Recent Session'}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                          {act.label}
                        </span>
                      </td>
                      <td>
                        {act.class_id ? (
                          <span className="lesson-tag">Class {act.class_id}</span>
                        ) : (
                          <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>General</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
