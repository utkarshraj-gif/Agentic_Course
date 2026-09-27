// pages/admin/AdminCoursesPage.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Search,
  Copy,
  Archive,
  Eye,
  Edit3,
  Users,
  CheckCircle,
  AlertCircle,
  Trash2,
  Layers
} from 'lucide-react';
import { adminCourseApi } from '../../services/adminCourseApi';
import type { AdminCourseListItem } from '../../services/adminCourseApi';
import { AdminErrorBanner } from '../../components/admin/AdminErrorBanner';

export function AdminCoursesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState<AdminCourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    courseId: string;
    title: string;
    action: 'archive' | 'delete';
  }>({
    isOpen: false,
    courseId: '',
    title: '',
    action: 'archive',
  });

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminCourseApi.listCourses(true);
      setCourses(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load enterprise courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, [location.key]);

  useEffect(() => {
    const handler = () => loadCourses();
    window.addEventListener('courses_updated', handler);
    return () => window.removeEventListener('courses_updated', handler);
  }, []);

  const handleDuplicate = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      const dup = await adminCourseApi.duplicateCourse(courseId);
      setSuccessMsg(`Successfully duplicated "${dup.title}".`);
      window.dispatchEvent(new CustomEvent('courses_updated'));
      await loadCourses();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to duplicate course.');
      setLoading(false);
    }
  };

  const handleTogglePublish = async (course: AdminCourseListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      if (course.status === 'published') {
        await adminCourseApi.unpublishCourse(course.id);
        setSuccessMsg(`Course "${course.title}" moved to Draft.`);
      } else {
        await adminCourseApi.publishCourse(course.id);
        setSuccessMsg(`Course "${course.title}" is now Published!`);
      }
      window.dispatchEvent(new CustomEvent('courses_updated'));
      await loadCourses();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Publishing operation failed.');
      setLoading(false);
    }
  };

  const executeConfirmAction = async () => {
    try {
      setLoading(true);
      if (confirmModal.action === 'delete') {
        await adminCourseApi.deleteCourse(confirmModal.courseId, false);
        setSuccessMsg('Course permanently removed.');
      } else {
        await adminCourseApi.deleteCourse(confirmModal.courseId, true);
        setSuccessMsg('Course archived successfully.');
      }
      setConfirmModal({ isOpen: false, courseId: '', title: '', action: 'archive' });
      window.dispatchEvent(new CustomEvent('courses_updated'));
      await loadCourses();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Action failed.');
      setLoading(false);
    }
  };

  // Categories list
  const categories = Array.from(new Set(courses.map(c => c.category))).filter(Boolean);

  // Filtered courses
  const filteredCourses = courses.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPublished = courses.filter(c => c.status === 'published').length;
  const totalDraft = courses.filter(c => c.status === 'draft').length;
  const totalModules = courses.reduce((acc, c) => acc + (c.modules_count || 0), 0);
  const totalClasses = courses.reduce((acc, c) => acc + (c.classes_count || 0), 0);

  return (
    <div className="admin-page">
      {/* Page Header */}
      <div className="admin-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="admin-page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen className="text-primary" size={28} />
            Course Management
          </h1>
          <p className="admin-page-subtitle">
            Create, edit curriculum structure, configure quizzes & diagrams, and publish courses to learners.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/curriculum')}
            className="btn btn--outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Eye size={15} /> Learner Catalog
          </button>
          <Link
            to="/admin/courses/new"
            className="btn btn--primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> Create Course
          </Link>
        </div>
      </div>

      {error && <AdminErrorBanner message={error} onRetry={loadCourses} />}

      {successMsg && (
        <div className="admin-success-banner" style={{ background: '#E6F9F5', border: '1px solid #07D2E0', color: '#113032', padding: '12px 16px', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} color="#10B981" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Highlights */}
      <div className="admin-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {loading && courses.length === 0 ? (
          <>
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="skeleton-kpi">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="skeleton skeleton-text" style={{ width: '90px' }} />
                  <div className="skeleton skeleton-circle" style={{ width: '28px', height: '28px' }} />
                </div>
                <div className="skeleton skeleton-title" style={{ width: '60px', height: '28px' }} />
                <div className="skeleton skeleton-text" style={{ width: '130px', height: '12px' }} />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="admin-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Courses</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--bg-light, #F0FAF7)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={15} color="#0891b2" />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main, #113032)' }}>{courses.length}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light, #7A9A9C)', marginTop: '4px' }}>Canonical & dynamic programs</div>
            </div>

            <div className="admin-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Published Programs</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ECFDF5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={15} color="#059669" />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#059669' }}>{totalPublished}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light, #7A9A9C)', marginTop: '4px' }}>Accessible to enrolled learners</div>
            </div>

            <div className="admin-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: '#D97706', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Draft Courses</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FFFBEB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={15} color="#D97706" />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97706' }}>{totalDraft}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light, #7A9A9C)', marginTop: '4px' }}>In authoring / preview stage</div>
            </div>

            <div className="admin-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: 'var(--primary, #07D2E0)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Curriculum Footprint</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--primary-light, rgba(7, 210, 224, 0.12))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={15} color="#0891b2" />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main, #113032)' }}>
                {totalModules} <span style={{ fontSize: '1rem', color: 'var(--text-muted, #4A7275)', fontWeight: 500 }}>mods</span> / {totalClasses} <span style={{ fontSize: '1rem', color: 'var(--text-muted, #4A7275)', fontWeight: 500 }}>classes</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light, #7A9A9C)', marginTop: '4px' }}>Live lesson footprint</div>
            </div>
          </>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="admin-card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '1 1 300px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light, #7A9A9C)' }} />
            <input
              type="text"
              placeholder="Search by course name, category, or slug..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input"
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--surface-2, #F8FCFB)', borderRadius: '6px', padding: '3px', border: '1px solid var(--border, #E2EDEB)' }}>
            {(['all', 'published', 'draft', 'archived'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: statusFilter === st ? 'var(--primary, #07D2E0)' : 'transparent',
                  color: statusFilter === st ? '#113032' : 'var(--text-muted, #4A7275)',
                  textTransform: 'capitalize',
                  transition: 'all 0.15s ease'
                }}
              >
                {st}
              </button>
            ))}
          </div>

          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="input"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Courses List */}
      {loading && courses.length === 0 ? (
        <div className="admin-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border, #E2EDEB)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-2, #F8FCFB)' }}>
            <div className="admin-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #4A7275)', fontWeight: 500 }}>
              Synchronizing enterprise curriculum registry...
            </span>
          </div>
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2, #F8FCFB)', borderBottom: '1px solid var(--border, #E2EDEB)' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #4A7275)' }}>COURSE NAME & SLUG</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #4A7275)' }}>CATEGORY / LEVEL</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #4A7275)' }}>STRUCTURE</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #4A7275)' }}>ENROLLED</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #4A7275)' }}>STATUS</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #4A7275)' }}>LAST UPDATED</th>
                <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #4A7275)', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map(rowIdx => (
                <tr key={rowIdx} style={{ borderBottom: '1px solid var(--border, #E2EDEB)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="skeleton skeleton-circle" style={{ width: '32px', height: '32px' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="skeleton skeleton-text" style={{ width: '160px' }} />
                        <div className="skeleton skeleton-text" style={{ width: '90px', height: '10px' }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div className="skeleton skeleton-badge" style={{ width: '80px' }} />
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div className="skeleton skeleton-text" style={{ width: '110px' }} />
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div className="skeleton skeleton-text" style={{ width: '70px' }} />
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div className="skeleton skeleton-badge" style={{ width: '75px' }} />
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div className="skeleton skeleton-text" style={{ width: '65px' }} />
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div className="skeleton skeleton-text" style={{ width: '80px', float: 'right' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="admin-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <BookOpen size={48} style={{ color: '#CBD5E1', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1E293B', marginBottom: '0.5rem' }}>No courses match your filter</h3>
          <p style={{ color: '#64748B', maxWidth: '400px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            {search ? 'Try clearing your search query or adjusting the filters.' : 'Get started by creating your first enterprise learning curriculum.'}
          </p>
          <Link to="/admin/courses/new" className="btn btn--primary">
            <Plus size={16} /> Create Course
          </Link>
        </div>
      ) : (
        <div className="admin-card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2, #F8FAFC)', borderBottom: '1px solid var(--border, #E2E8F0)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>COURSE NAME & SLUG</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>CATEGORY / LEVEL</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>STRUCTURE</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>ENROLLED</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>LAST UPDATED</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#64748B', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map(course => (
                  <tr
                    key={course.id}
                    onClick={() => navigate(`/admin/courses/${course.id}`)}
                    style={{
                      borderBottom: '1px solid var(--border, #E2E8F0)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    className="admin-table-row"
                  >
                    {/* Title & Slug */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>{course.icon || '🤖'}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.95rem' }}>
                            {course.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace' }}>
                            /{course.slug}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category & Level */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: '#E2F7F6',
                          color: '#0D6E74',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          width: 'fit-content'
                        }}>
                          {course.category}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {course.level}
                        </span>
                      </div>
                    </td>

                    {/* Structure */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                        <strong>{course.modules_count}</strong> {course.modules_count === 1 ? 'module' : 'modules'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {course.classes_count} classes · {course.estimated_duration || '4 Weeks'}
                      </div>
                    </td>

                    {/* Enrolled */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#334155' }}>
                        <Users size={14} style={{ color: '#07D2E0' }} />
                        <span>{course.enrolled_count || (course.slug === 'enterprise-ai' ? 142 : 0)} learners</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '12px',
                        background: course.status === 'published' ? '#DEF7EC' : course.status === 'draft' ? '#FEF3C7' : '#F1F5F9',
                        color: course.status === 'published' ? '#03543F' : course.status === 'draft' ? '#92400E' : '#475569',
                        textTransform: 'capitalize'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: course.status === 'published' ? '#10B981' : course.status === 'draft' ? '#F59E0B' : '#94A3B8'
                        }} />
                        {course.status}
                      </span>
                    </td>

                    {/* Last Updated */}
                    <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#64748B' }}>
                      {course.updated_at ? new Date(course.updated_at).toLocaleDateString() : 'Just now'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          onClick={() => navigate(`/admin/courses/${course.id}`)}
                          className="btn btn--sm btn--outline"
                          title="Open Course Builder"
                        >
                          <Edit3 size={13} /> Edit
                        </button>

                        <button
                          onClick={e => handleDuplicate(course.id, e)}
                          className="btn btn--sm btn--outline"
                          title="Duplicate Course Structure"
                        >
                          <Copy size={13} />
                        </button>

                        <button
                          onClick={e => handleTogglePublish(course, e)}
                          className={`btn btn--sm ${course.status === 'published' ? 'btn--outline' : 'btn--primary'}`}
                          title={course.status === 'published' ? 'Unpublish (move to Draft)' : 'Publish to Learners'}
                        >
                          {course.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setConfirmModal({
                              isOpen: true,
                              courseId: course.id,
                              title: course.title,
                              action: course.status === 'draft' ? 'delete' : 'archive'
                            });
                          }}
                          className="btn btn--sm btn--outline text-danger"
                          title={course.status === 'draft' ? 'Delete Course' : 'Archive Course'}
                          style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
                        >
                          {course.status === 'draft' ? <Trash2 size={13} /> : <Archive size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="admin-modal-overlay" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="admin-modal-card admin-modal-content-padded" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: confirmModal.action === 'delete' ? '#FEE2E2' : '#FEF3C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertCircle size={22} color={confirmModal.action === 'delete' ? '#DC2626' : '#D97706'} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>
                  {confirmModal.action === 'delete' ? 'Delete Course Permanently?' : 'Archive Course?'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Action requires confirmation
                </span>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: '1.55', marginBottom: '1.5rem', background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              Are you sure you want to {confirmModal.action} <strong>"{confirmModal.title}"</strong>?
              {confirmModal.action === 'archive'
                ? ' Archived courses will no longer be visible in the catalog for new enrollments, but past learner progress remains preserved.'
                : ' This will permanently remove all draft modules, classes, diagrams, and quizzes attached to this course. This cannot be undone.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn--outline"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button
                className={`btn ${confirmModal.action === 'delete' ? 'btn--danger' : 'btn--primary'}`}
                style={confirmModal.action === 'delete' ? { background: '#DC2626', borderColor: '#DC2626', color: '#FFF' } : {}}
                onClick={executeConfirmAction}
              >
                {confirmModal.action === 'delete' ? 'Permanently Delete' : 'Archive Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
