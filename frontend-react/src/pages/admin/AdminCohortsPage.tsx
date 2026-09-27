// src/pages/admin/AdminCohortsPage.tsx
// Enterprise Cohort Management Dashboard

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  Calendar,
  Plus,
  Search,
  BookOpen,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  X,
  UserPlus
} from 'lucide-react';
import {
  listCohorts,
  createCohort,
  bulkEnrollCohort
} from '../../services/adminEnterpriseApi';
import type { Cohort } from '../../services/adminEnterpriseApi';
import { adminCourseApi } from '../../services/adminCourseApi';
import type { AdminCourseListItem } from '../../services/adminCourseApi';

export function AdminCohortsPage() {
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<AdminCourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'completed'>('all');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCohort, setNewCohort] = useState({
    id: '',
    name: '',
    description: '',
    start_date: '2026-10-01',
    end_date: '2026-11-30',
    status: 'active'
  });
  const [creatingCohort, setCreatingCohort] = useState(false);

  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false);
  const [bulkCohortId, setBulkCohortId] = useState('');
  const [bulkCourseId, setBulkCourseId] = useState('');
  const [bulkDeadline, setBulkDeadline] = useState('2026-10-31');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [cohortList, courseList] = await Promise.all([
        listCohorts(),
        adminCourseApi.listCourses()
      ]);
      setCohorts(cohortList);
      setCourses(courseList);
      if (cohortList.length > 0 && !bulkCohortId) {
        setBulkCohortId(cohortList[0].id);
      }
      if (courseList.length > 0 && !bulkCourseId) {
        setBulkCourseId(courseList[0].id);
      }
    } catch (err) {
      console.error('Error fetching cohorts:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCohort.name.trim()) return;
    setCreatingCohort(true);
    try {
      const slugId = newCohort.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      await createCohort({
        id: slugId,
        name: newCohort.name,
        description: newCohort.description,
        start_date: newCohort.start_date,
        end_date: newCohort.end_date,
        status: newCohort.status
      });
      setShowCreateModal(false);
      setNewCohort({
        id: '',
        name: '',
        description: '',
        start_date: '2026-10-01',
        end_date: '2026-11-30',
        status: 'active'
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create cohort');
    } finally {
      setCreatingCohort(false);
    }
  };

  const handleBulkEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCohortId || !bulkCourseId) return;
    setEnrolling(true);
    setEnrollMsg(null);
    try {
      const res = await bulkEnrollCohort(bulkCohortId, {
        course_ids: [bulkCourseId],
        assign_all_learners: true,
        deadline: bulkDeadline
      });
      setEnrollMsg({
        type: 'success',
        text: `Successfully enrolled ${res.learners_enrolled || 'all'} learners into course.`
      });
      setTimeout(() => {
        setShowBulkEnrollModal(false);
        setEnrollMsg(null);
        loadData();
      }, 1500);
    } catch (err: any) {
      setEnrollMsg({ type: 'error', text: err.message || 'Bulk enrollment failed' });
    } finally {
      setEnrolling(false);
    }
  };

  const filteredCohorts = cohorts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalLearners = cohorts.reduce((acc, c) => acc + (c.learners_count || 0), 0);
  const avgProgress = cohorts.length > 0
    ? Math.round(cohorts.reduce((acc, c) => acc + (c.avg_progress || 0), 0) / cohorts.length)
    : 0;
  const totalAtRisk = cohorts.reduce((acc, c) => acc + (c.risk_summary?.at_risk || 0), 0);

  return (
    <div className="admin-cohorts-page" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--primary-light, rgba(7, 210, 224, 0.12))', color: 'var(--primary, #07D2E0)' }}>
              <GraduationCap size={24} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #113032)', letterSpacing: '-0.02em' }}>
              Cohort Management
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted, #4A7275)', margin: 0, fontSize: '0.95rem' }}>
            First-class cohort provisioning, enterprise scheduling, progression tracking, and bulk course enrollment.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowBulkEnrollModal(true)}
            className="btn btn--outline"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem' }}
          >
            <UserPlus size={16} />
            <span>Bulk Enroll</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn--primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem' }}
          >
            <Plus size={16} />
            <span>Create Cohort</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            <span>Total Cohorts</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--bg-light, #F0FAF7)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={16} color="#0891b2" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main, #113032)' }}>{cohorts.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light, #7A9A9C)', marginTop: '0.25rem' }}>Enterprise corporate groups</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            <span>Active Learners</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="#8b5cf6" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main, #113032)' }}>{totalLearners}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light, #7A9A9C)', marginTop: '0.25rem' }}>Enrolled across active tracks</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            <span>Avg Completion</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main, #113032)' }}>{avgProgress}%</div>
          <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '0.25rem', fontWeight: 500 }}>Strong trajectory across cohorts</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            <span>Learners At Risk</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={16} color="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: totalAtRisk > 0 ? '#d97706' : 'var(--text-main, #113032)' }}>
            {totalAtRisk}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light, #7A9A9C)', marginTop: '0.25rem' }}>Identified by data-driven risk engine</div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        background: '#FFFFFF',
        padding: '0.875rem 1.25rem',
        borderRadius: '10px',
        border: '1px solid var(--border, #E2EDEB)',
        boxShadow: '0 1px 3px rgba(17, 48, 50, 0.04)'
      }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: '260px' }}>
          <Search size={18} color="var(--text-light, #7A9A9C)" />
          <input
            type="text"
            placeholder="Search cohorts by name or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main, #113032)',
              outline: 'none',
              width: '100%',
              fontSize: '0.9rem'
            }}
          />
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'active', 'upcoming', 'completed'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? 'var(--primary-light, rgba(7, 210, 224, 0.14))' : 'transparent',
                color: statusFilter === st ? '#0891b2' : 'var(--text-muted, #4A7275)',
                border: statusFilter === st ? '1px solid var(--primary, #07D2E0)' : '1px solid transparent',
                borderRadius: '6px',
                padding: '0.375rem 0.875rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Cohorts List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted, #4A7275)' }}>
          Loading enterprise cohorts...
        </div>
      ) : filteredCohorts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px dashed var(--border, #E2EDEB)',
          boxShadow: '0 1px 3px rgba(17, 48, 50, 0.04)'
        }}>
          <GraduationCap size={48} color="var(--text-light, #7A9A9C)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-main, #113032)' }}>No cohorts found</h3>
          <p style={{ color: 'var(--text-muted, #4A7275)', margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
            {searchQuery ? 'Try adjusting your search filter.' : 'Provision your first enterprise cohort to get started.'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn--primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} />
            <span>Create Cohort</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredCohorts.map(cohort => {
            const statusBg = cohort.status === 'active' ? '#ECFDF5' : cohort.status === 'upcoming' ? '#FFFBEB' : '#F1F5F9';
            const statusColor = cohort.status === 'active' ? '#059669' : cohort.status === 'upcoming' ? '#D97706' : '#64748B';
            const statusBorder = cohort.status === 'active' ? '#A7F3D0' : cohort.status === 'upcoming' ? '#FDE68A' : '#E2E8F0';

            return (
              <div
                key={cohort.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border, #E2EDEB)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1.5rem',
                  boxShadow: '0 1px 3px rgba(17, 48, 50, 0.04)',
                  transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s'
                }}
              >
                {/* Info Column */}
                <div style={{ flex: '1 1 320px', minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main, #113032)' }}>
                      {cohort.name}
                    </h3>
                    <span style={{
                      background: statusBg,
                      color: statusColor,
                      border: `1px solid ${statusBorder}`,
                      padding: '0.2rem 0.6rem',
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
                    <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted, #4A7275)', fontSize: '0.875rem', lineHeight: '1.5' }}>
                      {cohort.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted, #4A7275)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Calendar size={14} color="var(--text-light, #7A9A9C)" />
                      {cohort.start_date || 'TBD'} → {cohort.end_date || 'TBD'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <BookOpen size={14} color="var(--text-light, #7A9A9C)" />
                      {cohort.courses_count || 0} Assigned Courses
                    </span>
                  </div>
                </div>

                {/* Progress & Risk Column */}
                <div style={{ flex: '0 1 260px', minWidth: '220px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted, #4A7275)' }}>Cohort Progress</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-main, #113032)' }}>{cohort.avg_progress || 0}%</span>
                  </div>
                  <div style={{ height: '6px', width: '100%', background: 'var(--border, #E2EDEB)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                    <div style={{
                      height: '100%',
                      width: `${cohort.avg_progress || 0}%`,
                      background: 'linear-gradient(90deg, var(--primary, #07D2E0), #10B981)',
                      borderRadius: '4px'
                    }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted, #4A7275)' }}>
                      <strong style={{ color: 'var(--text-main, #113032)' }}>{cohort.learners_count || 0}</strong> Learners
                    </span>
                    {cohort.risk_summary && cohort.risk_summary.at_risk > 0 && (
                      <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                        <AlertTriangle size={12} color="#d97706" />
                        <strong>{cohort.risk_summary.at_risk}</strong> At Risk
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      setBulkCohortId(cohort.id);
                      setShowBulkEnrollModal(true);
                    }}
                    className="btn btn--outline"
                    style={{ fontSize: '0.825rem', padding: '0.5rem 0.875rem' }}
                    title="Bulk enroll learners into course"
                  >
                    Enroll
                  </button>
                  <button
                    onClick={() => navigate(`/admin/cohorts/${cohort.id}`)}
                    className="btn btn--primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.825rem', padding: '0.5rem 1rem' }}
                  >
                    <span>Dashboard</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Cohort Modal */}
      {showCreateModal && (
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
            maxWidth: '520px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(17, 48, 50, 0.16)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main, #113032)' }}>
                Create Enterprise Cohort
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #4A7275)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCohort}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                  Cohort Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. October 2026 — AI Engineering"
                  value={newCohort.name}
                  onChange={e => setNewCohort({ ...newCohort, name: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1px solid var(--border, #E2EDEB)',
                    borderRadius: '8px',
                    padding: '0.625rem 0.875rem',
                    color: 'var(--text-main, #113032)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description or organizational context..."
                  value={newCohort.description}
                  onChange={e => setNewCohort({ ...newCohort, description: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1px solid var(--border, #E2EDEB)',
                    borderRadius: '8px',
                    padding: '0.625rem 0.875rem',
                    color: 'var(--text-main, #113032)',
                    fontSize: '0.9rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newCohort.start_date}
                    onChange={e => setNewCohort({ ...newCohort, start_date: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#FFFFFF',
                      border: '1px solid var(--border, #E2EDEB)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      color: 'var(--text-main, #113032)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={newCohort.end_date}
                    onChange={e => setNewCohort({ ...newCohort, end_date: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#FFFFFF',
                      border: '1px solid var(--border, #E2EDEB)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      color: 'var(--text-main, #113032)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                  Initial Status
                </label>
                <select
                  value={newCohort.status}
                  onChange={e => setNewCohort({ ...newCohort, status: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1px solid var(--border, #E2EDEB)',
                    borderRadius: '8px',
                    padding: '0.625rem 0.875rem',
                    color: 'var(--text-main, #113032)',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="active">Active</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCohort}
                  className="btn btn--primary"
                >
                  {creatingCohort ? 'Creating...' : 'Create Cohort'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Enroll Modal */}
      {showBulkEnrollModal && (
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
            maxWidth: '520px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(17, 48, 50, 0.16)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--primary-light, rgba(7, 210, 224, 0.12))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={16} color="var(--primary, #07D2E0)" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main, #113032)' }}>
                  Bulk Enroll Cohort
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowBulkEnrollModal(false);
                  setEnrollMsg(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #4A7275)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.85rem', margin: '0 0 1.25rem', lineHeight: '1.45' }}>
              Enroll all learners of a cohort into a course simultaneously with an enterprise completion deadline.
            </p>

            {enrollMsg && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: enrollMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                color: enrollMsg.type === 'success' ? '#059669' : '#DC2626',
                border: enrollMsg.type === 'success' ? '1px solid #A7F3D0' : '1px solid #FECACA'
              }}>
                {enrollMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                <span>{enrollMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleBulkEnrollSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                  Target Cohort *
                </label>
                <select
                  value={bulkCohortId}
                  onChange={e => setBulkCohortId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1px solid var(--border, #E2EDEB)',
                    borderRadius: '8px',
                    padding: '0.625rem 0.875rem',
                    color: 'var(--text-main, #113032)',
                    fontSize: '0.9rem'
                  }}
                >
                  {cohorts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.learners_count || 0} learners)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                  Course to Assign *
                </label>
                <select
                  value={bulkCourseId}
                  onChange={e => setBulkCourseId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1px solid var(--border, #E2EDEB)',
                    borderRadius: '8px',
                    padding: '0.625rem 0.875rem',
                    color: 'var(--text-main, #113032)',
                    fontSize: '0.9rem'
                  }}
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main, #113032)', marginBottom: '0.35rem' }}>
                  Course Completion Deadline
                </label>
                <input
                  type="date"
                  value={bulkDeadline}
                  onChange={e => setBulkDeadline(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1px solid var(--border, #E2EDEB)',
                    borderRadius: '8px',
                    padding: '0.625rem 0.875rem',
                    color: 'var(--text-main, #113032)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkEnrollModal(false);
                    setEnrollMsg(null);
                  }}
                  className="btn btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrolling}
                  className="btn btn--primary"
                >
                  {enrolling ? 'Enrolling...' : 'Execute Bulk Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default AdminCohortsPage;
