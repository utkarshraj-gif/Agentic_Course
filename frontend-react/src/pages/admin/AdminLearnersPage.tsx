// pages/admin/AdminLearnersPage.tsx
// Complete Learner Roster & Dossiers matching clean Learner Design System

import { useEffect, useState, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Award,
  ChevronRight,
  X,
  Download,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { AdminService } from '../../services/admin/AdminService';
import type {
  LearnerOverview,
  LearnerDossier
} from '../../services/admin/AdminService';
import { AdminErrorBanner } from '../../components/admin/AdminErrorBanner';
import { downloadCsv } from '../../services/admin/exportUtils';
import { AdminTableSkeleton } from '../../components/common/Skeleton';

const COHORTS = [
  'All',
  'Platform Engineering',
  'Clinical AI Leaders',
  'Legal & Compliance',
  'Supply Chain & Ops'
];

export function AdminLearnersPage() {
  const [learners, setLearners] = useState<LearnerOverview[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Dossier State
  const [activeDossierId, setActiveDossierId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<LearnerDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLearners = useCallback(async (query: string = searchTerm, cohort: string = selectedCohort) => {
    try {
      setLoading(true);
      const data = await AdminService.getLearners(cohort, query);
      setLearners(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch learners:', err);
      setError(err.message || 'Failed to retrieve learners roster.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCohort]);

  // Initial and cohort change load
  useEffect(() => {
    fetchLearners(searchTerm, selectedCohort);
  }, [selectedCohort]);

  // Debounced search (250ms)
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchLearners(val, selectedCohort);
    }, 250);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    fetchLearners('', selectedCohort);
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    fetchLearners(searchTerm, selectedCohort);
  };

  const handleExportCsv = () => {
    if (learners.length === 0) return;
    const headers = ['User ID', 'Name', 'Email', 'Cohort', 'Role', 'Completed Classes', 'Completion Rate (%)', 'Avg Quiz (%)', 'Capstones', 'Last Active'];
    const rows = learners.map(l => [
      l.id,
      l.name,
      l.email,
      l.cohort,
      l.role,
      l.completed_classes.length,
      Math.round((l.completed_classes.length / 15) * 100),
      l.quiz_avg,
      l.capstones.join('; '),
      l.last_active,
    ]);
    downloadCsv(`learners_roster_${selectedCohort.toLowerCase().replace(/\s+/g, '_')}`, headers, rows);
  };

  const handleOpenDossier = async (userId: string) => {
    setActiveDossierId(userId);
    setDossierLoading(true);
    try {
      const data = await AdminService.getLearnerDossier(userId);
      setDossier(data);
    } catch (err) {
      console.error('Failed to load dossier:', err);
    } finally {
      setDossierLoading(false);
    }
  };

  const handleCloseDossier = () => {
    setActiveDossierId(null);
    setDossier(null);
  };

  return (
    <div className="page page--admin">
      {/* Degraded State Banner */}
      {error && (
        <AdminErrorBanner
          title="Learner Directory Unreachable"
          message={error}
          onRetry={() => fetchLearners(searchTerm, selectedCohort)}
        />
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Learners & Teams
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Manage employee enrollments, track module progress, and review individual certification transcripts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => fetchLearners(searchTerm, selectedCohort)} className="btn btn--outline btn--sm" style={{ gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExportCsv} className="btn btn--outline btn--sm" style={{ gap: '6px' }} disabled={learners.length === 0}>
            <Download size={14} /> Export Roster (CSV)
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-2)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {COHORTS.map((c) => (
            <button
              key={c}
              className="btn btn--sm"
              style={{
                background: selectedCohort === c ? 'var(--color-bg-white)' : 'transparent',
                color: selectedCohort === c ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: selectedCohort === c ? 700 : 500,
                border: selectedCohort === c ? '1px solid var(--border)' : '1px solid transparent',
                boxShadow: selectedCohort === c ? 'var(--shadow-sm)' : 'none',
              }}
              onClick={() => setSelectedCohort(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', position: 'relative', minWidth: '280px', flex: '1', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="login-input"
            style={{ paddingLeft: '2.4rem', paddingRight: searchTerm ? '2rem' : '1rem', height: '38px', fontSize: '0.85rem' }}
            placeholder="Search learner, email, role..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </form>
      </div>

      {/* Learners Table in a Clean Card */}
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '1rem' }}>
            <AdminTableSkeleton rows={7} columns={7} />
          </div>
        ) : learners.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
            <p>No learners found matching the search criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Cohort & Role</th>
                  <th>Curriculum Progress</th>
                  <th>Avg Quiz</th>
                  <th>Capstones</th>
                  <th>Last Active</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((l) => {
                  const completionPct = Math.round((l.completed_classes.length / 15) * 100);
                  return (
                    <tr key={l.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem' }}>
                            {l.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <Link
                              to={`/admin/learners/${l.id}`}
                              style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem', textDecoration: 'none' }}
                              className="hover-underline"
                              title={`Inspect complete telemetry and data for ${l.name}`}
                            >
                              {l.name}
                            </Link>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.82rem' }}>{l.cohort}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{l.role}</div>
                      </td>
                      <td>
                        <div style={{ minWidth: '150px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-muted)' }}>
                            <span>{l.completed_classes.length}/15 classes</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{completionPct}%</span>
                          </div>
                          <div className="progress-bar" style={{ height: '6px' }}>
                            <div className="progress-fill" style={{ width: `${completionPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Award size={14} style={{ color: l.quiz_avg >= 80 ? 'var(--green)' : 'var(--amber)' }} />
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{l.quiz_avg}%</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 500 }}>
                          {l.capstones.length} of 4
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{l.last_active}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            className="btn btn--secondary btn--sm"
                            style={{ fontSize: '0.72rem', padding: '3px 8px', height: '26px' }}
                            onClick={() => handleOpenDossier(l.id)}
                            title="Quick snapshot preview"
                          >
                            Preview
                          </button>
                          <Link
                            to={`/admin/learners/${l.id}`}
                            className="btn btn--outline btn--sm"
                            style={{ gap: '4px', fontSize: '0.72rem', padding: '3px 8px', height: '26px' }}
                            title="Open full dedicated user command profile"
                          >
                            Deep Dive <ChevronRight size={12} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Learner Dossier Modal */}
      {activeDossierId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1rem',
          }}
          onClick={handleCloseDossier}
        >
          <div
            style={{
              background: 'var(--color-bg-white)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {dossierLoading || !dossier ? (
              <div className="loading-state" style={{ minHeight: '300px' }}>
                <span>Loading Full Transcript & Dossier...</span>
              </div>
            ) : (
              <div>
                {/* Dossier Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                      {dossier.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{dossier.name}</h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {dossier.email} • {dossier.cohort} • <span style={{ fontWeight: 600 }}>{dossier.role}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Link
                      to={`/admin/learners/${dossier.id}`}
                      className="btn btn--primary btn--sm"
                      style={{ gap: '6px', fontSize: '0.78rem' }}
                      title="Open full command profile with telemetry and tabs"
                    >
                      <ExternalLink size={13} /> Full Command Profile
                    </Link>
                    <button className="btn btn--outline btn--sm" onClick={handleCloseDossier} style={{ padding: '6px' }} title="Close preview">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Dossier Body */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Progress KPIs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                    <div className="stat-card">
                      <div className="stat-label">Completion</div>
                      <div className="stat-value">{dossier.completionRate}%</div>
                      <div className="stat-desc">{dossier.completedClassesCount} of {dossier.totalClasses} classes</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Certification Status</div>
                      <div className="stat-value" style={{ color: dossier.completionRate === 100 ? 'var(--green)' : 'var(--amber)', fontSize: '1.15rem' }}>
                        {dossier.completionRate === 100 ? 'Certified' : 'In Progress'}
                      </div>
                      <div className="stat-desc">Target: 15 Classes</div>
                    </div>
                  </div>

                  {/* Complete 15 Module Matrix */}
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                      All 15 Curriculum Classes Transcript
                    </h4>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Class #</th>
                            <th>Status</th>
                            <th>Knowledge Check</th>
                            <th>Time Spent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dossier.classesMatrix.map((item) => (
                            <tr key={item.classId}>
                              <td>
                                <strong style={{ color: 'var(--text-main)' }}>Class {String(item.classId).padStart(2, '0')}</strong>
                              </td>
                              <td>
                                {item.status === 'completed' ? (
                                  <span className="status-badge status-badge--done" style={{ fontSize: '0.7rem' }}>Completed</span>
                                ) : (
                                  <span className="status-badge status-badge--none" style={{ fontSize: '0.7rem' }}>Pending</span>
                                )}
                              </td>
                              <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>{item.quiz}</td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.timeSpent}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Activity Log */}
                  {dossier.recentActivity && dossier.recentActivity.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                        Audit Timeline
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {dossier.recentActivity.map((act, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              background: 'var(--surface-2)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.8rem',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{act.label}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                              {act.time ? new Date(act.time).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
