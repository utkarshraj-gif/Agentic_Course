// src/pages/admin/AdminCohortDetailPage.tsx
// Comprehensive Cohort Dashboard: Overview, Learners Roster, Assigned Courses & Deadlines, Risk Analysis

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  BookOpen,
  Calendar,
  Clock,
  Plus,
  Search,
  Save
} from 'lucide-react';
import {
  getCohortDetail,
  updateCohort,
  assignCourseToCohort
} from '../../services/adminEnterpriseApi';
import type {
  Cohort,
  CohortMember,
  CohortCourse
} from '../../services/adminEnterpriseApi';
import { adminCourseApi } from '../../services/adminCourseApi';
import type { AdminCourseListItem } from '../../services/adminCourseApi';

export function AdminCohortDetailPage() {
  const { cohortId } = useParams<{ cohortId: string }>();

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [availableCourses, setAvailableCourses] = useState<AdminCourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'learners' | 'courses' | 'settings'>('overview');

  // Search & Filters inside learners
  const [learnerSearch, setLearnerSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'at_risk' | 'on_track' | 'ahead'>('all');

  // Assign course modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseDeadline, setCourseDeadline] = useState('2026-10-31');
  const [assigning, setAssigning] = useState(false);

  // Settings edit state
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    status: 'active' | 'upcoming' | 'completed' | 'archived';
  }>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'active'
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (cohortId) {
      loadData(cohortId);
    }
  }, [cohortId]);

  async function loadData(id: string) {
    setLoading(true);
    try {
      const [data, courseList] = await Promise.all([
        getCohortDetail(id),
        adminCourseApi.listCourses()
      ]);
      setCohort(data);
      setAvailableCourses(courseList);
      if (courseList.length > 0 && !selectedCourseId) {
        setSelectedCourseId(courseList[0].id);
      }
      setEditForm({
        name: data.name,
        description: data.description || '',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        status: data.status
      });
    } catch (err) {
      console.error('Error fetching cohort detail:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleAssignCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortId || !selectedCourseId) return;
    setAssigning(true);
    try {
      await assignCourseToCohort(cohortId, {
        course_id: selectedCourseId,
        deadline: courseDeadline
      });
      setShowAssignModal(false);
      await loadData(cohortId);
    } catch (err: any) {
      alert(err.message || 'Failed to assign course');
    } finally {
      setAssigning(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortId) return;
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      const updated = await updateCohort(cohortId, editForm);
      setCohort(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update cohort');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading cohort dashboard...
      </div>
    );
  }

  if (!cohort) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        <h2>Cohort not found</h2>
        <Link to="/admin/cohorts" className="btn btn--primary" style={{ marginTop: '1rem' }}>
          Back to Cohorts
        </Link>
      </div>
    );
  }

  const members: CohortMember[] = cohort.members || [];
  const courses: CohortCourse[] = cohort.courses || [];

  const filteredMembers = members.filter(m => {
    const nameMatch = (m.user_name || '').toLowerCase().includes(learnerSearch.toLowerCase()) ||
      (m.user_email || '').toLowerCase().includes(learnerSearch.toLowerCase());
    const riskMatch = riskFilter === 'all' || m.risk_status === riskFilter;
    return nameMatch && riskMatch;
  });

  const atRiskCount = members.filter(m => m.risk_status === 'at_risk').length;
  const onTrackCount = members.filter(m => m.risk_status === 'on_track').length;
  const aheadCount = members.filter(m => m.risk_status === 'ahead').length;
  const avgScore = members.length > 0
    ? Math.round(members.reduce((acc, m) => acc + (m.avg_score || 0), 0) / members.length)
    : 82;

  return (
    <div className="admin-cohort-detail-page" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Back Link */}
      <Link
        to="/admin/cohorts"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          color: 'var(--text-muted, #4A7275)',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
          marginBottom: '1.25rem'
        }}
      >
        <ArrowLeft size={16} />
        <span>Back to Cohorts</span>
      </Link>

      {/* Header Banner */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid var(--border, #E2EDEB)',
        borderRadius: '14px',
        padding: '1.75rem',
        marginBottom: '1.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1.5rem',
        boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #113032)', letterSpacing: '-0.02em' }}>
              {cohort.name}
            </h1>
            <span style={{
              background: cohort.status === 'active' ? '#ECFDF5' : cohort.status === 'upcoming' ? '#FFFBEB' : '#F1F5F9',
              color: cohort.status === 'active' ? '#059669' : cohort.status === 'upcoming' ? '#D97706' : '#64748B',
              border: cohort.status === 'active' ? '1px solid #A7F3D0' : cohort.status === 'upcoming' ? '1px solid #FDE68A' : '1px solid #E2E8F0',
              padding: '0.2rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {cohort.status}
            </span>
          </div>
          {cohort.description && (
            <p style={{ color: 'var(--text-muted, #4A7275)', margin: '0 0 1rem', fontSize: '0.925rem', maxWidth: '700px', lineHeight: '1.5' }}>
              {cohort.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted, #4A7275)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Users size={16} color="var(--text-light, #7A9A9C)" />
              <strong style={{ color: 'var(--text-main, #113032)' }}>{members.length}</strong> Enrolled Learners
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BookOpen size={16} color="var(--text-light, #7A9A9C)" />
              <strong style={{ color: 'var(--text-main, #113032)' }}>{courses.length}</strong> Assigned Courses
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={16} color="var(--text-light, #7A9A9C)" />
              {cohort.start_date || 'TBD'} → {cohort.end_date || 'TBD'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowAssignModal(true)}
            className="btn btn--primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            <span>Assign Course</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border, #E2EDEB)',
        marginBottom: '1.75rem'
      }}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'learners', label: `Learners (${members.length})` },
          { key: 'courses', label: `Assigned Courses (${courses.length})` },
          { key: 'settings', label: 'Settings' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary, #07D2E0)' : '2px solid transparent',
              padding: '0.75rem 1.25rem',
              color: activeTab === tab.key ? 'var(--text-main, #113032)' : 'var(--text-muted, #4A7275)',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
              <div style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Cohort Completion</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main, #113032)' }}>{cohort.avg_progress || 0}%</div>
              <div style={{ height: '5px', background: 'var(--border, #E2EDEB)', borderRadius: '3px', marginTop: '0.5rem' }}>
                <div style={{ height: '100%', width: `${cohort.avg_progress || 0}%`, background: 'var(--primary, #07D2E0)', borderRadius: '3px' }} />
              </div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
              <div style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Avg Assessment Score</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>{avgScore}%</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light, #7A9A9C)', marginTop: '0.25rem' }}>Passing benchmark: 70%</div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
              <div style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>Risk Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ color: '#d97706', fontWeight: 700, fontSize: '1.25rem' }}>{atRiskCount}</span>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-muted, #4A7275)' }}>at risk</span>
                <span style={{ color: 'var(--border, #E2EDEB)' }}>|</span>
                <span style={{ color: '#059669', fontWeight: 700, fontSize: '1.25rem' }}>{onTrackCount + aheadCount}</span>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-muted, #4A7275)' }}>healthy</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light, #7A9A9C)', marginTop: '0.25rem' }}>Deterministic risk engine</div>
            </div>
          </div>

          {/* Assigned Courses with Deadlines */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main, #113032)', fontWeight: 600 }}>
                Course Progression & Deadlines
              </h3>
              <button
                onClick={() => setShowAssignModal(true)}
                className="btn btn--outline"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                + Assign Course
              </button>
            </div>

            {courses.length === 0 ? (
              <p style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.9rem' }}>No courses assigned to this cohort yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {courses.map(c => (
                  <div
                    key={c.course_id}
                    style={{
                      background: 'var(--bg-light, #F8FCFB)',
                      border: '1px solid var(--border, #E2EDEB)',
                      borderRadius: '8px',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem', color: 'var(--text-main, #113032)', fontSize: '1rem', fontWeight: 600 }}>
                        {c.course_title || c.course_id}
                      </h4>
                      <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem' }}>
                        <span>{c.modules_count || 7} Modules</span>
                        <span>{c.classes_count || 15} Classes</span>
                        <span>Version: {c.course_version_id || '1.0'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        background: 'var(--primary-light, rgba(7, 210, 224, 0.12))',
                        color: '#0891b2',
                        border: '1px solid rgba(7, 210, 224, 0.25)',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontWeight: 500
                      }}>
                        <Clock size={14} />
                        <span>Deadline: {c.deadline || 'No deadline'}</span>
                      </div>

                      <Link
                        to={`/admin/courses/${c.course_id}`}
                        className="btn btn--outline"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LEARNERS ROSTER */}
      {activeTab === 'learners' && (
        <div>
          {/* Search & Risk Filter Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            background: '#FFFFFF',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid var(--border, #E2EDEB)',
            boxShadow: '0 1px 3px rgba(17, 48, 50, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
              <Search size={16} color="var(--text-light, #7A9A9C)" />
              <input
                type="text"
                placeholder="Search learners by name or email..."
                value={learnerSearch}
                onChange={e => setLearnerSearch(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main, #113032)', outline: 'none', width: '100%', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {(['all', 'at_risk', 'on_track', 'ahead'] as const).map(rf => (
                <button
                  key={rf}
                  onClick={() => setRiskFilter(rf)}
                  style={{
                    background: riskFilter === rf ? 'var(--primary-light, rgba(7, 210, 224, 0.14))' : 'transparent',
                    color: riskFilter === rf ? '#0891b2' : 'var(--text-muted, #4A7275)',
                    border: riskFilter === rf ? '1px solid var(--primary, #07D2E0)' : '1px solid transparent',
                    borderRadius: '6px',
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    fontWeight: 600,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {rf.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Learners Table */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border, #E2EDEB)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(17, 48, 50, 0.04)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2, #F8FCFB)', borderBottom: '1px solid var(--border, #E2EDEB)', color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem' }}>
                  <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Learner</th>
                  <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Progress</th>
                  <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Avg Score</th>
                  <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Risk Assessment</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted, #4A7275)' }}>
                      No learners match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map(m => {
                    const riskBg = m.risk_status === 'at_risk' ? '#FEF2F2' : m.risk_status === 'ahead' ? '#ECFDF5' : '#EFF6FF';
                    const riskColor = m.risk_status === 'at_risk' ? '#DC2626' : m.risk_status === 'ahead' ? '#059669' : '#2563EB';
                    const riskBorder = m.risk_status === 'at_risk' ? '#FECACA' : m.risk_status === 'ahead' ? '#A7F3D0' : '#BFDBFE';

                    return (
                      <tr key={m.user_id} style={{ borderBottom: '1px solid var(--border, #E2EDEB)' }}>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main, #113032)' }}>{m.user_name || m.user_id}</div>
                          <div style={{ color: 'var(--text-light, #7A9A9C)', fontSize: '0.8rem' }}>{m.user_email || `${m.user_id}@velloe.internal`}</div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span style={{
                            background: 'var(--bg-light, #F8FCFB)',
                            color: 'var(--text-muted, #4A7275)',
                            border: '1px solid var(--border, #E2EDEB)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            textTransform: 'capitalize'
                          }}>
                            {m.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', minWidth: '120px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1, height: '6px', background: 'var(--border, #E2EDEB)', borderRadius: '3px' }}>
                              <div style={{ width: `${m.progress || 0}%`, height: '100%', background: 'var(--primary, #07D2E0)', borderRadius: '3px' }} />
                            </div>
                            <span style={{ color: 'var(--text-main, #113032)', fontSize: '0.8rem', fontWeight: 600 }}>{m.progress || 0}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--text-main, #113032)', fontWeight: 600 }}>
                          {m.avg_score || 80}%
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{
                              background: riskBg,
                              color: riskColor,
                              border: `1px solid ${riskBorder}`,
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              alignSelf: 'flex-start'
                            }}>
                              {m.risk_status ? m.risk_status.replace('_', ' ') : 'on track'}
                            </span>
                            {m.risk_reasons && m.risk_reasons.length > 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #4A7275)' }}>
                                {m.risk_reasons[0]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                          <Link
                            to={`/admin/learners/${m.user_id}`}
                            className="btn btn--outline"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                          >
                            Inspect
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ASSIGNED COURSES */}
      {activeTab === 'courses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <p style={{ color: 'var(--text-muted, #4A7275)', margin: 0, fontSize: '0.9rem' }}>
              Courses assigned to this cohort. Learners enrolled in this cohort automatically receive access.
            </p>
            <button
              onClick={() => setShowAssignModal(true)}
              className="btn btn--primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <Plus size={16} />
              <span>Assign Course</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {courses.map(c => (
              <div
                key={c.course_id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border, #E2EDEB)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  boxShadow: '0 1px 3px rgba(17, 48, 50, 0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-main, #113032)', fontSize: '1.05rem', fontWeight: 600 }}>
                    {c.course_title || c.course_id}
                  </h4>
                  <span style={{ background: 'var(--bg-light, #F8FCFB)', color: 'var(--text-muted, #4A7275)', border: '1px solid var(--border, #E2EDEB)', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    v{c.course_version_id || '1.0'}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.825rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span>Modules: <strong style={{ color: 'var(--text-main, #113032)' }}>{c.modules_count || 7}</strong></span>
                  <span>Classes: <strong style={{ color: 'var(--text-main, #113032)' }}>{c.classes_count || 15}</strong></span>
                  <span>Assigned: <strong style={{ color: 'var(--text-main, #113032)' }}>{c.assigned_at ? c.assigned_at.split('T')[0] : 'Current'}</strong></span>
                  <span style={{ color: '#0891b2' }}>Deadline: <strong>{c.deadline || 'Flexible'}</strong></span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link
                    to={`/admin/courses/${c.course_id}`}
                    className="btn btn--outline"
                    style={{ flex: 1, textAlign: 'center', fontSize: '0.8rem', padding: '0.4rem' }}
                  >
                    Course Builder
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS */}
      {activeTab === 'settings' && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid var(--border, #E2EDEB)',
          borderRadius: '12px',
          padding: '1.75rem',
          maxWidth: '680px',
          boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)'
        }}>
          <h3 style={{ margin: '0 0 1rem', color: 'var(--text-main, #113032)', fontSize: '1.15rem', fontWeight: 700 }}>Cohort Settings</h3>

          {saveSuccess && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0',
              marginBottom: '1rem',
              fontSize: '0.85rem'
            }}>
              Cohort details updated successfully.
            </div>
          )}

          <form onSubmit={handleSaveSettings}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                Cohort Name
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                style={{ width: '100%', background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '8px', padding: '0.625rem', color: 'var(--text-main, #113032)' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                Description
              </label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                style={{ width: '100%', background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '8px', padding: '0.625rem', color: 'var(--text-main, #113032)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={editForm.start_date}
                  onChange={e => setEditForm({ ...editForm, start_date: e.target.value })}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '8px', padding: '0.5rem', color: 'var(--text-main, #113032)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={editForm.end_date}
                  onChange={e => setEditForm({ ...editForm, end_date: e.target.value })}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '8px', padding: '0.5rem', color: 'var(--text-main, #113032)' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                Status
              </label>
              <select
                value={editForm.status}
                onChange={e => setEditForm({ ...editForm, status: e.target.value as 'active' | 'upcoming' | 'completed' | 'archived' })}
                style={{ width: '100%', background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '8px', padding: '0.625rem', color: 'var(--text-main, #113032)' }}
              >
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="btn btn--primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Save size={16} />
              <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Assign Course Modal */}
      {showAssignModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(17, 48, 50, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border, #E2EDEB)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '500px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(17, 48, 50, 0.16)'
          }}>
            <h3 style={{ margin: '0 0 1rem', color: 'var(--text-main, #113032)', fontSize: '1.25rem', fontWeight: 700 }}>
              Assign Course to Cohort
            </h3>
            <form onSubmit={handleAssignCourse}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                  Select Course *
                </label>
                <select
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '8px', padding: '0.625rem', color: 'var(--text-main, #113032)' }}
                >
                  {availableCourses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                  Completion Deadline
                </label>
                <input
                  type="date"
                  value={courseDeadline}
                  onChange={e => setCourseDeadline(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '8px', padding: '0.625rem', color: 'var(--text-main, #113032)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="btn btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="btn btn--primary"
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default AdminCohortDetailPage;
