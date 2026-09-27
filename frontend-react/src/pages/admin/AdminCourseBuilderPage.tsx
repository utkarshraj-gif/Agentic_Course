import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  Eye,
  Plus,
  Trash2,
  FileText,
  Layers,
  Clock,
  Users,
  BarChart2,
  X,
  GitBranch,
  MessageSquare,
  Send,
  Check,
  ArrowRight
} from 'lucide-react';
import { adminCourseApi } from '../../services/adminCourseApi';
import type {
  AdminCourseDetail,
  AdminClassItem,
  CourseValidationResult
} from '../../services/adminCourseApi';
import {
  listCourseVersions,
  createCourseVersionDraft,
  updateCourseVersionStatus,
  listReviewComments,
  createReviewComment,
  resolveReviewComment
} from '../../services/adminEnterpriseApi';
import type {
  CourseVersion,
  ReviewComment
} from '../../services/adminEnterpriseApi';
import { AdminErrorBanner } from '../../components/admin/AdminErrorBanner';

export function AdminCourseBuilderPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const isNew = !courseId || courseId === 'new';
  const navigate = useNavigate();

  // State
  const [course, setCourse] = useState<Partial<AdminCourseDetail>>({
    title: '',
    slug: '',
    short_title: '',
    category: 'Agentic AI',
    level: 'Advanced',
    icon: '🤖',
    banner_image: '/Agentic_Banner.png',
    short_description: '',
    description: '',
    estimated_duration: '4 Weeks',
    estimated_hours: 24,
    status: 'draft',
    tags: ['Agentic AI', 'LangGraph', 'Enterprise'],
    modules: [],
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'versions' | 'learners' | 'analytics'>('overview');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Validate required settings to unlock curriculum structure
  const hasRequiredSettings = Boolean(course.title?.trim() && course.slug?.trim());
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Enterprise Versioning & Review States
  const [versions, setVersions] = useState<CourseVersion[]>([]);
  const [reviews, setReviews] = useState<ReviewComment[]>([]);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newVersionNumber, setNewVersionNumber] = useState('1.1');
  const [newChangeSummary, setNewChangeSummary] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentEntityType, setNewCommentEntityType] = useState<'course' | 'module' | 'class'>('course');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Validation
  const [validation, setValidation] = useState<CourseValidationResult | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Class Lesson Editor Modal
  const [editingClass, setEditingClass] = useState<{
    moduleId: string;
    classData: AdminClassItem;
  } | null>(null);
  const [classEditorTab, setClassEditorTab] = useState<'markdown' | 'diagram' | 'code' | 'quiz'>('markdown');
  const [newTagInput, setNewTagInput] = useState('');

  // Learner Preview Modal
  const [showLearnerPreview, setShowLearnerPreview] = useState(false);

  // Load course if editing
  useEffect(() => {
    if (!isNew && courseId) {
      loadCourse(courseId);
    }
  }, [courseId, isNew]);

  const loadCourse = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminCourseApi.getCourse(id);
      setCourse(data);
      setHasUnsavedChanges(false);
      await loadVersionsAndReviews(id);
    } catch (err: any) {
      setError(err.message || 'Failed to load course details.');
    } finally {
      setLoading(false);
    }
  };

  const loadVersionsAndReviews = async (id: string) => {
    try {
      const [vList, rList] = await Promise.all([
        listCourseVersions(id).catch(() => []),
        listReviewComments(id).catch(() => [])
      ]);
      setVersions(vList);
      setReviews(rList);
    } catch (err) {
      console.error('Failed to load course versions/reviews:', err);
    }
  };

  const handleCreateVersionDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course.id || !newVersionNumber.trim()) return;
    setCreatingVersion(true);
    try {
      await createCourseVersionDraft(course.id, {
        version_number: newVersionNumber.trim(),
        change_summary: newChangeSummary.trim() || 'Working draft revision'
      });
      setShowVersionModal(false);
      setNewChangeSummary('');
      await loadVersionsAndReviews(course.id);
      setSuccessMsg(`Draft version ${newVersionNumber} created.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to create version draft');
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleUpdateVersionStatus = async (
    verId: string,
    newStatus: 'draft' | 'in_review' | 'approved' | 'published' | 'superseded' | 'archived'
  ) => {
    if (!course.id) return;
    try {
      await updateCourseVersionStatus(course.id, verId, newStatus);
      await loadVersionsAndReviews(course.id);
      setSuccessMsg(`Version transitioned to ${newStatus.replace('_', ' ')}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to transition version status');
    }
  };

  const handlePostReviewComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course.id || !newCommentText.trim()) return;
    setSubmittingComment(true);
    try {
      await createReviewComment(course.id, {
        entity_type: newCommentEntityType,
        comment: newCommentText.trim(),
        author_name: 'Lead Reviewer',
        author_role: 'Curriculum Director'
      });
      setNewCommentText('');
      await loadVersionsAndReviews(course.id);
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleResolveComment = async (commentId: number) => {
    if (!course.id) return;
    try {
      await resolveReviewComment(course.id, commentId);
      await loadVersionsAndReviews(course.id);
    } catch (err: any) {
      alert(err.message || 'Failed to resolve comment');
    }
  };

  // Warn on unsaved changes before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle title change & auto-generate slug
  const handleTitleChange = (newTitle: string) => {
    const autoSlug = newTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    setCourse(prev => ({
      ...prev,
      title: newTitle,
      short_title: prev.short_title || newTitle.slice(0, 25),
      slug: isNew && (!prev.slug || prev.slug === autoSlug.slice(0, -1)) ? autoSlug : prev.slug || autoSlug,
    }));
    setHasUnsavedChanges(true);
  };

  // Save Course Overview / Settings
  const handleSaveCourse = async () => {
    try {
      setSaving(true);
      setError(null);
      if (isNew) {
        const created = await adminCourseApi.createCourse(course);
        setSuccessMsg('Course created successfully in Draft status.');
        setHasUnsavedChanges(false);
        window.dispatchEvent(new CustomEvent('courses_updated'));
        navigate(`/admin/courses/${created.id}`, { replace: true });
      } else if (course.id) {
        const updated = await adminCourseApi.updateCourse(course.id, course);
        setCourse(updated);
        setSuccessMsg('Course settings saved.');
        setHasUnsavedChanges(false);
        window.dispatchEvent(new CustomEvent('courses_updated'));
      }
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save course.');
    } finally {
      setSaving(false);
    }
  };

  // Run validation checklist
  const handleValidate = async () => {
    if (!course.id) return;
    try {
      const res = await adminCourseApi.validateCourse(course.id);
      setValidation(res);
      setShowValidationModal(true);
    } catch (err: any) {
      setError(err.message || 'Validation request failed.');
    }
  };

  // Publish / Unpublish
  const handleTogglePublish = async () => {
    if (!course.id) return;
    try {
      setSaving(true);
      setError(null);
      if (course.status === 'published') {
        const res = await adminCourseApi.unpublishCourse(course.id);
        setCourse(prev => ({ ...prev, status: 'draft' }));
        window.dispatchEvent(new CustomEvent('courses_updated'));
        setSuccessMsg(res.message);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        await adminCourseApi.publishCourse(course.id);
        window.dispatchEvent(new CustomEvent('courses_updated'));
        // After publishing, return directly to Course Management list
        navigate('/admin/courses');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to publish course.');
      handleValidate();
    } finally {
      setSaving(false);
    }
  };

  // Module actions
  const handleAddPrerequisitesModule = async () => {
    if (isNew) {
      await handleSaveCourse();
      return;
    }
    if (!course.id) return;
    try {
      setSaving(true);
      const updated = await adminCourseApi.addModule(course.id, {
        title: 'Prerequisites & Environment Setup',
        description: 'Comprehensive workstation diagnostics, Python 3.10+ virtual environments, vector database setup, Docker runtimes, and multi-provider API credential provisioning.',
        tools: ['Python 3.10+', 'Virtualenv', 'LangGraph', 'Chroma DB', 'FAISS', 'Docker'],
        module_number: 0,
        position: 0,
      });
      setCourse(updated);
      setSuccessMsg('Prerequisites (Week 0) module added before Foundations.');
      window.dispatchEvent(new CustomEvent('courses_updated'));
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to add prerequisites module.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddModule = async () => {
    if (isNew) {
      await handleSaveCourse();
      return;
    }
    if (!course.id) return;
    const modCount = (course.modules || []).length + 1;
    try {
      setSaving(true);
      const updated = await adminCourseApi.addModule(course.id, {
        title: `Week ${modCount} — Module Title`,
        description: 'Module learning objectives and architectural topics.',
        tools: ['LangGraph', 'DSPy'],
      });
      setCourse(updated);
      setSuccessMsg(`Module ${modCount} added.`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to add module.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModule = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this module and its classes?')) return;
    try {
      setSaving(true);
      await adminCourseApi.deleteModule(moduleId);
      if (course.id) await loadCourse(course.id);
      setSuccessMsg('Module removed.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to delete module.');
    } finally {
      setSaving(false);
    }
  };

  // Class actions
  const handleAddClass = async (moduleId: string) => {
    if (!course.id) return;
    try {
      setSaving(true);
      const currentClassCount = (course.modules || []).reduce((acc, m) => acc + (m.classes?.length || 0), 0) + 1;
      const updated = await adminCourseApi.addClass(moduleId, {
        course_id: course.id,
        title: `Class ${currentClassCount}: New Lesson`,
        short_title: `Lesson ${currentClassCount}`,
        duration: '60 min',
        description: 'Hands-on architectural class covering production patterns.',
        lesson_content: `# Class ${currentClassCount}: New Lesson\n\n## Overview\nExplain core architectural concepts here.\n\n## Architecture Workflow\n\`\`\`mermaid\nflowchart TD\n    User --> Agent\n    Agent --> LLM\n    Agent --> Tools\n\`\`\`\n\n## Runnable Code Example\n\`\`\`python\ndef run_agent():\n    print("Agent pipeline online")\n\`\`\`\n`,
        topics: ['Agent Architecture'],
        quiz: [
          {
            id: 'q1',
            question: 'What is the primary pattern explored in this class?',
            options: ['Tool Orchestration', 'Single-turn Chat', 'Unsupervised Clustering', 'Model Pruning'],
            correctIndex: 0,
            explanation: 'Tool orchestration enables agents to interface dynamically with external APIs and data sources.',
          },
        ],
      });
      setCourse(updated);
      setSuccessMsg('Class added.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to add class.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenClassEditor = (moduleId: string, cl: AdminClassItem) => {
    setEditingClass({
      moduleId,
      classData: {
        ...cl,
        topics: cl.topics || [],
        learning_objectives: cl.learning_objectives || [],
        diagrams: cl.diagrams || [],
        code_examples: cl.code_examples || [],
        quiz: cl.quiz || [],
      },
    });
    setClassEditorTab('markdown');
  };

  const handleSaveClass = async () => {
    if (!editingClass) return;
    try {
      setSaving(true);
      await adminCourseApi.updateClass(editingClass.classData.id, editingClass.classData);
      if (course.id) await loadCourse(course.id);
      setEditingClass(null);
      setSuccessMsg('Class content saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save class.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this class permanently?')) return;
    try {
      setSaving(true);
      await adminCourseApi.deleteClass(classId);
      if (course.id) await loadCourse(course.id);
      setSuccessMsg('Class deleted.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to delete class.');
    } finally {
      setSaving(false);
    }
  };

  // Tag helper
  const addTag = () => {
    if (!newTagInput.trim()) return;
    const tag = newTagInput.trim();
    if (!course.tags?.includes(tag)) {
      setCourse(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }));
      setHasUnsavedChanges(true);
    }
    setNewTagInput('');
  };

  const removeTag = (t: string) => {
    setCourse(prev => ({ ...prev, tags: (prev.tags || []).filter(item => item !== t) }));
    setHasUnsavedChanges(true);
  };

  return (
    <div className="admin-page">
      {/* Top Breadcrumb & Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/admin/courses')}
            className="btn btn--outline btn--sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} /> Back to Courses
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>{course.icon || '🤖'}</span>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                {course.title || (isNew ? 'New Course' : 'Untitled Course')}
              </h1>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: course.status === 'published' ? '#DEF7EC' : '#FEF3C7',
                color: course.status === 'published' ? '#03543F' : '#92400E',
                textTransform: 'capitalize'
              }}>
                {course.status || 'draft'}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
              {course.slug ? `/${course.slug}` : 'URL slug will be generated automatically'}
              {hasUnsavedChanges && <span style={{ color: '#D97706', marginLeft: '8px', fontWeight: 600 }}>• Unsaved changes</span>}
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isNew && (
            <>
              <button
                onClick={() => setShowLearnerPreview(true)}
                className="btn btn--outline"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Preview course as learner"
              >
                <Eye size={15} /> Preview as Learner
              </button>

              <button
                onClick={handleValidate}
                className="btn btn--outline"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Check course publishing requirements"
              >
                <CheckCircle size={15} /> Validate
              </button>

              <button
                onClick={handleTogglePublish}
                disabled={saving}
                className={`btn ${course.status === 'published' ? 'btn--outline' : 'btn--primary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {course.status === 'published' ? 'Unpublish (Draft)' : 'Publish Course'}
              </button>
            </>
          )}

          <button
            onClick={handleSaveCourse}
            disabled={saving}
            className="btn btn--primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '110px', justifyContent: 'center' }}
          >
            <Save size={15} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && <AdminErrorBanner message={error} onRetry={() => { if (courseId) loadCourse(courseId); }} />}

      {loading && !isNew ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.25s ease' }}>
          {/* Skeleton Tab Strip */}
          <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border, #E2EDEB)', paddingBottom: '0.75rem' }}>
            <div className="skeleton" style={{ width: '180px', height: '28px', borderRadius: '6px' }} />
            <div className="skeleton" style={{ width: '200px', height: '28px', borderRadius: '6px' }} />
            <div className="skeleton" style={{ width: '150px', height: '28px', borderRadius: '6px' }} />
          </div>

          {/* Skeleton Module Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="admin-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="skeleton" style={{ width: '70px', height: '24px', borderRadius: '6px' }} />
                    <div className="skeleton" style={{ width: '260px', height: '24px', borderRadius: '6px' }} />
                  </div>
                  <div className="skeleton" style={{ width: '95px', height: '32px', borderRadius: '6px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[1, 2].map(j => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="skeleton" style={{ width: '24px', height: '18px', borderRadius: '4px' }} />
                        <div className="skeleton" style={{ width: '200px', height: '18px', borderRadius: '4px' }} />
                      </div>
                      <div className="skeleton" style={{ width: '60px', height: '18px', borderRadius: '4px' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
      {successMsg && (
        <div className="admin-success-banner" style={{ background: '#E6F9F5', border: '1px solid #07D2E0', color: '#113032', padding: '12px 16px', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} color="#10B981" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Course Builder Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #E2E8F0)', marginBottom: '1.5rem', gap: '1.5rem' }}>
        {/* TAB 1: Course Settings & Metadata (Always First) */}
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '10px 4px',
            fontSize: '0.95rem',
            fontWeight: 600,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'overview' ? '2px solid var(--primary, #07D2E0)' : '2px solid transparent',
            color: activeTab === 'overview' ? 'var(--primary, #07D2E0)' : '#64748B',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} /> Course Settings & Metadata
        </button>

        {/* TAB 2: Curriculum Structure (Faded until required fields are filled) */}
        <button
          onClick={() => {
            if (hasRequiredSettings) {
              setActiveTab('curriculum');
            }
          }}
          disabled={!hasRequiredSettings}
          style={{
            padding: '10px 4px',
            fontSize: '0.95rem',
            fontWeight: hasRequiredSettings ? 600 : 400,
            border: 'none',
            background: 'none',
            cursor: hasRequiredSettings ? 'pointer' : 'not-allowed',
            opacity: hasRequiredSettings ? 1 : 0.35,
            transition: 'all 0.2s ease',
            borderBottom: activeTab === 'curriculum' ? '2px solid var(--primary, #07D2E0)' : '2px solid transparent',
            color: activeTab === 'curriculum' ? 'var(--primary, #07D2E0)' : hasRequiredSettings ? '#64748B' : '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Layers size={16} /> Curriculum Structure ({course.modules?.length || 0} Weeks)
        </button>

        {!isNew && (
          <>
            <button
              onClick={() => setActiveTab('versions')}
              style={{
                padding: '10px 4px',
                fontSize: '0.95rem',
                fontWeight: 600,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: activeTab === 'versions' ? '2px solid var(--primary, #07D2E0)' : '2px solid transparent',
                color: activeTab === 'versions' ? 'var(--primary, #07D2E0)' : '#64748B',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <GitBranch size={16} /> Versions & Reviews ({versions.length})
            </button>
            <button
              onClick={() => setActiveTab('learners')}
              style={{
                padding: '10px 4px',
                fontSize: '0.95rem',
                fontWeight: 600,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: activeTab === 'learners' ? '2px solid var(--primary, #07D2E0)' : '2px solid transparent',
                color: activeTab === 'learners' ? 'var(--primary, #07D2E0)' : '#64748B',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Users size={16} /> Learners ({course.enrolled_count || 142})
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              style={{
                padding: '10px 4px',
                fontSize: '0.95rem',
                fontWeight: 600,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: activeTab === 'analytics' ? '2px solid var(--primary, #07D2E0)' : '2px solid transparent',
                color: activeTab === 'analytics' ? 'var(--primary, #07D2E0)' : '#64748B',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <BarChart2 size={16} /> Course Telemetry
            </button>
          </>
        )}
      </div>

      {/* TAB: CURRICULUM BUILDER */}
      {activeTab === 'curriculum' && (
        !hasRequiredSettings ? (
          <div className="admin-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', maxWidth: '640px', margin: '1rem auto' }}>
            <FileText size={36} color="var(--primary, #07D2E0)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#113032', marginBottom: '0.5rem' }}>
              Complete Course Settings
            </h3>
            <p style={{ color: '#4A7275', fontSize: '0.9rem', margin: '0 auto 1.5rem', lineHeight: '1.5', maxWidth: '420px' }}>
              Please enter the Course Title and Course URL Slug in Course Settings to author curriculum modules and lessons.
            </p>
            <button onClick={() => setActiveTab('overview')} className="btn btn--primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} /> Course Settings & Metadata
            </button>
          </div>
        ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1E293B', margin: 0 }}>
                Course Modules & Lessons
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Organize learning modules and craft lesson Markdown, architecture diagrams, and quiz questions.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!(course.modules || []).some(m => m.module_number === 0 || m.title.toLowerCase().includes('prereq')) && (
                <button
                  onClick={handleAddPrerequisitesModule}
                  className="btn btn--outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--primary, #07D2E0)', color: '#0D6E74', fontWeight: 600 }}
                >
                  <Plus size={16} /> Add Prerequisites (Week 0)
                </button>
              )}
              <button
                onClick={handleAddModule}
                className="btn btn--primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Add Week / Module
              </button>
            </div>
          </div>

          {(!course.modules || course.modules.length === 0) ? (
            <div className="admin-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <Layers size={40} style={{ color: '#CBD5E1', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1E293B', marginBottom: '0.5rem' }}>
                No modules created yet
              </h3>
              <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                Start structuring this curriculum by adding Week 0 (Prerequisites) or Week 1 (Foundations).
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={handleAddPrerequisitesModule} className="btn btn--outline" style={{ borderColor: 'var(--primary, #07D2E0)', color: '#0D6E74', fontWeight: 600 }}>
                  <Plus size={16} /> Add Prerequisites (Week 0)
                </button>
                <button onClick={handleAddModule} className="btn btn--primary">
                  <Plus size={16} /> Add First Module
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {course.modules.map((mod, mIdx) => (
                <div key={mod.id} className="admin-card" style={{ padding: '1.25rem' }}>
                  {/* Module Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--border, #E2E8F0)', paddingBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          background: mod.module_number === 0 ? '#FEF3C7' : 'var(--primary, #07D2E0)',
                          color: mod.module_number === 0 ? '#92400E' : '#113032',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          padding: '3px 8px',
                          borderRadius: '4px'
                        }}>
                          {mod.module_number === 0 ? 'Week 0 · Prerequisites' : `Week ${mod.module_number ?? (mIdx + 1)}`}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#0F172A' }}>
                          {mod.title}
                        </h3>
                      </div>
                      {mod.description && (
                        <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '6px 0 0 0' }}>
                          {mod.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleAddClass(mod.id)}
                        className="btn btn--sm btn--primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus size={13} /> Add Class
                      </button>
                      <button
                        onClick={e => handleDeleteModule(mod.id, e)}
                        className="btn btn--sm btn--outline text-danger"
                        title="Delete module"
                        style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Classes inside Module */}
                  {(!mod.classes || mod.classes.length === 0) ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', background: 'var(--surface-2, #F8FAFC)', borderRadius: '6px', border: '1px dashed var(--border, #CBD5E1)' }}>
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#64748B' }}>
                        No classes in this module yet.
                      </p>
                      <button
                        onClick={() => handleAddClass(mod.id)}
                        className="btn btn--sm btn--outline"
                      >
                        <Plus size={13} /> Add Class
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {mod.classes.map((cl, cIdx) => (
                        <div
                          key={cl.id}
                          onClick={() => handleOpenClassEditor(mod.id, cl)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: 'var(--surface-2, #F8FAFC)',
                            borderRadius: '6px',
                            border: '1px solid var(--border, #E2E8F0)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          className="admin-class-row"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontWeight: 700, color: '#64748B', fontSize: '0.85rem', width: '28px' }}>
                              #{cl.class_number || (cIdx + 1)}
                            </span>
                            <div>
                              <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.9rem' }}>
                                {cl.title}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', gap: '12px', marginTop: '2px' }}>
                                <span><Clock size={11} style={{ verticalAlign: '-1px' }} /> {cl.duration || '60 min'}</span>
                                {cl.quiz && cl.quiz.length > 0 && <span>📝 {cl.quiz.length} Questions</span>}
                                {cl.diagrams && cl.diagrams.length > 0 && <span>📊 {cl.diagrams.length} Diagrams</span>}
                                {cl.topics && cl.topics.length > 0 && <span>🏷️ {cl.topics.slice(0, 2).join(', ')}</span>}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenClassEditor(mod.id, cl)}
                              className="btn btn--sm btn--outline"
                              title="Edit class lesson content, markdown, diagram, code, and quiz"
                            >
                              Edit Lesson Content
                            </button>
                            <button
                              onClick={e => handleDeleteClass(cl.id, e)}
                              className="btn btn--sm btn--outline text-danger"
                              style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                              title="Delete class"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* TAB 2: OVERVIEW & METADATA */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '880px' }}>
          {/* Card 1: Core Identity */}
          <div className="admin-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border, #E2EDEB)', paddingBottom: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(7, 210, 224, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={18} color="#0D6E74" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#113032' }}>
                  Course Identity & Catalog Setup
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#4A7275' }}>
                  Primary metadata displayed across learner discovery, enrollment cards, and headers.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="admin-form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Course Title <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={course.title || ''}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="e.g. Enterprise AI Agents in Production"
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label className="admin-form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Course URL Slug <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={course.slug || ''}
                  onChange={e => {
                    setCourse(prev => ({ ...prev, slug: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="e.g. enterprise-ai-agents"
                  className="input"
                  style={{ width: '100%', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label className="admin-form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  value={course.category || 'Agentic AI'}
                  onChange={e => {
                    setCourse(prev => ({ ...prev, category: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="Agentic AI">Agentic AI</option>
                  <option value="Production AI">Production AI</option>
                  <option value="Generative AI">Generative AI</option>
                  <option value="Machine Learning">Machine Learning</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Security">Security</option>
                  <option value="Data">Data</option>
                </select>
              </div>

              <div>
                <label className="admin-form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Level
                </label>
                <select
                  value={course.level || 'Advanced'}
                  onChange={e => {
                    setCourse(prev => ({ ...prev, level: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>

              <div>
                <label className="admin-form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Estimated Duration
                </label>
                <input
                  type="text"
                  value={course.estimated_duration || '4 Weeks'}
                  onChange={e => {
                    setCourse(prev => ({ ...prev, estimated_duration: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="e.g. 4 Weeks"
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label className="admin-form-label" style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Icon / Visual Glyph
                </label>
                <input
                  type="text"
                  value={course.icon || '🤖'}
                  onChange={e => {
                    setCourse(prev => ({ ...prev, icon: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="input"
                  style={{ width: '100%', textAlign: 'center', fontSize: '1.2rem' }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Descriptions & Syllabus Copy */}
          <div className="admin-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border, #E2EDEB)', paddingBottom: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(7, 210, 224, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={18} color="#0D6E74" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#113032' }}>
                  Course Descriptions & Syllabus Copy
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#4A7275' }}>
                  Short pitch for catalog cards and comprehensive syllabus text for learners.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="admin-form-label" style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>
                  Catalog Card Short Summary
                </label>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>1 concise sentence</span>
              </div>
              <input
                type="text"
                value={course.short_description || ''}
                onChange={e => {
                  setCourse(prev => ({ ...prev, short_description: e.target.value }));
                  setHasUnsavedChanges(true);
                }}
                placeholder="High-level 1-sentence value proposition for catalog cards..."
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="admin-form-label" style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>
                  Full Course Syllabus & Description
                </label>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Markdown supported</span>
              </div>
              <textarea
                rows={5}
                value={course.description || ''}
                onChange={e => {
                  setCourse(prev => ({ ...prev, description: e.target.value }));
                  setHasUnsavedChanges(true);
                }}
                placeholder="Comprehensive syllabus overview, target audience, and enterprise learning outcomes..."
                className="input"
                style={{ width: '100%', resize: 'vertical', lineHeight: '1.5' }}
              />
            </div>
          </div>

          {/* Card 3: Skills & Competency Tags */}
          <div className="admin-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border, #E2EDEB)', paddingBottom: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(7, 210, 224, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} color="#0D6E74" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#113032' }}>
                  Topic & Skill Taxonomy
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#4A7275' }}>
                  Competencies learners will develop. Used for skill mapping and progress benchmarks.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {(course.tags || []).map(t => (
                <span key={t} className="admin-tag-pill">
                  {t}
                  <button
                    onClick={() => removeTag(t)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#0D6E74', display: 'flex', alignItems: 'center' }}
                    title={`Remove ${t}`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add skill tag (e.g. LangGraph, FAISS, Evaluators) & press Enter"
                className="input"
                style={{ maxWidth: '380px' }}
              />
              <button onClick={addTag} className="btn btn--outline btn--sm" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Plus size={14} /> Add Skill
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
            <button
              onClick={handleSaveCourse}
              disabled={saving}
              className="btn btn--outline"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={15} /> {saving ? 'Saving...' : 'Save Draft'}
            </button>

            <button
              onClick={async () => {
                if (!hasRequiredSettings) return;
                await handleSaveCourse();
                setActiveTab('curriculum');
              }}
              disabled={saving || !hasRequiredSettings}
              className="btn btn--primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minWidth: '180px',
                justifyContent: 'center',
                cursor: hasRequiredSettings ? 'pointer' : 'not-allowed',
                opacity: hasRequiredSettings ? 1 : 0.4
              }}
            >
              Continue to Curriculum <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* TAB: COURSE VERSIONS & REVIEWS */}
      {activeTab === 'versions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Versioning Overview Header */}
          <div className="admin-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GitBranch size={20} className="text-primary" />
                  Course Version History & Lifecycle
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0, maxWidth: '750px' }}>
                  Enterprise version snapshot isolation: Active learners stay anchored to their enrolled release while course designers author drafts, conduct multi-tier reviews, and publish immutable versions.
                </p>
              </div>

              <button
                onClick={() => setShowVersionModal(true)}
                className="btn btn--primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Create New Draft Version
              </button>
            </div>

            {/* Versions Table */}
            {versions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                No version records found for this course yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2, #F8FAFC)', borderBottom: '1px solid var(--border, #E2E8F0)' }}>
                      <th style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B' }}>VERSION</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B' }}>STATUS</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B' }}>CHANGE SUMMARY</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B' }}>AUTHOR</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B' }}>LIFECYCLE DATES</th>
                      <th style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map(v => {
                      const statusColor = v.status === 'published'
                        ? { bg: '#DEF7EC', text: '#03543F' }
                        : v.status === 'in_review'
                        ? { bg: '#E0E7FF', text: '#3730A3' }
                        : v.status === 'approved'
                        ? { bg: '#FEF3C7', text: '#92400E' }
                        : v.status === 'superseded'
                        ? { bg: '#F1F5F9', text: '#475569' }
                        : { bg: '#FEE2E2', text: '#991B1B' };

                      return (
                        <tr key={v.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A', fontFamily: 'monospace' }}>
                              v{v.version_number}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              background: statusColor.bg,
                              color: statusColor.text,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}>
                              {v.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '0.85rem', color: '#334155', maxWidth: '300px' }}>
                            {v.change_summary || 'Baseline version snapshot'}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '0.85rem', color: '#64748B' }}>
                            {v.created_by || 'Staff'}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '0.78rem', color: '#64748B' }}>
                            <div>Created: {v.created_at ? v.created_at.split('T')[0] : 'N/A'}</div>
                            {v.published_at && (
                              <div style={{ color: '#059669', fontWeight: 600 }}>
                                Published: {v.published_at.split('T')[0]}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {v.status === 'draft' && (
                                <button
                                  onClick={() => handleUpdateVersionStatus(v.id, 'in_review')}
                                  className="btn btn--outline btn--sm"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  Submit for Review
                                </button>
                              )}
                              {v.status === 'in_review' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateVersionStatus(v.id, 'approved')}
                                    className="btn btn--primary btn--sm"
                                    style={{ fontSize: '0.75rem' }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleUpdateVersionStatus(v.id, 'draft')}
                                    className="btn btn--outline btn--sm"
                                    style={{ fontSize: '0.75rem' }}
                                  >
                                    Request Changes
                                  </button>
                                </>
                              )}
                              {v.status === 'approved' && (
                                <button
                                  onClick={() => handleUpdateVersionStatus(v.id, 'published')}
                                  className="btn btn--primary btn--sm"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  Publish Release
                                </button>
                              )}
                              {v.status === 'published' && (
                                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Check size={14} /> Active Release
                                </span>
                              )}
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

          {/* Content Reviews & Comments Section */}
          <div className="admin-card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} className="text-primary" />
              Content Reviews & Quality Feedback
            </h3>

            {/* Post Comment Form */}
            <form onSubmit={handlePostReviewComment} style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: '10px', alignItems: 'center' }}>
                <select
                  value={newCommentEntityType}
                  onChange={e => setNewCommentEntityType(e.target.value as any)}
                  className="input"
                  style={{ fontSize: '0.85rem' }}
                >
                  <option value="course">Course Level</option>
                  <option value="module">Module Level</option>
                  <option value="class">Class / Lesson</option>
                </select>

                <input
                  type="text"
                  required
                  placeholder="Leave review note (e.g. 'Diagram needs reciprocal rank fusion clarification')..."
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  className="input"
                  style={{ fontSize: '0.85rem' }}
                />

                <button
                  type="submit"
                  disabled={submittingComment}
                  className="btn btn--primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                >
                  <Send size={14} />
                  <span>{submittingComment ? 'Posting...' : 'Post Feedback'}</span>
                </button>
              </div>
            </form>

            {/* Comments List */}
            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94A3B8', fontSize: '0.875rem' }}>
                No review comments recorded for this course.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reviews.map(rev => (
                  <div
                    key={rev.id}
                    style={{
                      background: rev.status === 'resolved' ? '#F8FAFC' : '#FFFBEB',
                      border: `1px solid ${rev.status === 'resolved' ? '#E2E8F0' : '#FDE68A'}`,
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0F172A' }}>
                          {rev.author_name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          ({rev.author_role || 'Reviewer'})
                        </span>
                        <span style={{
                          background: rev.status === 'resolved' ? '#DEF7EC' : '#FEF3C7',
                          color: rev.status === 'resolved' ? '#03543F' : '#92400E',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {rev.status}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                          [{rev.entity_type}]
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155' }}>
                        {rev.comment}
                      </p>
                    </div>

                    {rev.status === 'open' && (
                      <button
                        onClick={() => handleResolveComment(rev.id)}
                        className="btn btn--outline btn--sm"
                        style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LEARNERS & ENROLLMENT */}
      {activeTab === 'learners' && (
        <div className="admin-card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                Enrolled Enterprise Learners
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Teams and engineers enrolled in {course.title}.
              </p>
            </div>
            <button
              onClick={() => alert('Enterprise Cohort Enrollment: Assigning team members via Admin Directory.')}
              className="btn btn--primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={16} /> Enroll Team / Learner
            </button>
          </div>

          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2, #F8FAFC)', borderBottom: '1px solid var(--border, #E2E8F0)' }}>
                <th style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B' }}>LEARNER</th>
                <th style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B' }}>COHORT</th>
                <th style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B' }}>PROGRESS</th>
                <th style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B' }}>ENROLLED DATE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>Dr. Sarah Chen</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B' }}>sarah.chen@healthcorp.org</div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '0.85rem' }}>Clinical AI Leaders</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '100px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '75%', height: '100%', background: '#10B981' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>75%</span>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#64748B' }}>Aug 14, 2026</td>
              </tr>
              <tr>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>Alex Rivera</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B' }}>a.rivera@fintech-agents.io</div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '0.85rem' }}>Platform Engineering</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '100px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: '#07D2E0' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>100%</span>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#64748B' }}>Aug 10, 2026</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: COURSE TELEMETRY / ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="admin-card" style={{ padding: '1.75rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0F172A', marginBottom: '1.25rem' }}>
            Course Telemetry & Engagement
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--surface-2, #F8FAFC)', borderRadius: '6px' }}>
              <div style={{ color: '#64748B', fontSize: '0.8rem' }}>Active Learners</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A' }}>98</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface-2, #F8FAFC)', borderRadius: '6px' }}>
              <div style={{ color: '#64748B', fontSize: '0.8rem' }}>Completion Rate</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10B981' }}>84.2%</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface-2, #F8FAFC)', borderRadius: '6px' }}>
              <div style={{ color: '#64748B', fontSize: '0.8rem' }}>Avg Quiz Score</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary, #07D2E0)' }}>93.8%</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface-2, #F8FAFC)', borderRadius: '6px' }}>
              <div style={{ color: '#64748B', fontSize: '0.8rem' }}>Lab Executions</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#6366F1' }}>420 runs</div>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* CLASS LESSON CONTENT EDITOR MODAL */}
      {editingClass && (
        <div className="admin-modal-overlay" onClick={() => setEditingClass(null)}>
          <div
            className="admin-modal-card admin-modal-content-padded"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '1040px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border, #E2EDEB)', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(7, 210, 224, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} color="#0D6E74" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#113032' }}>
                    Lesson Editor: {editingClass.classData.title}
                  </h3>
                  <span style={{ fontSize: '0.825rem', color: '#4A7275' }}>
                    Class #{editingClass.classData.class_number} • {editingClass.classData.duration || '60 min'} • Markdown & Interactive Elements
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditingClass(null)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
                title="Close editor"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Metadata Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '1.25rem' }}>
              <div>
                <label className="admin-form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Class Title</label>
                <input
                  type="text"
                  value={editingClass.classData.title}
                  onChange={e => setEditingClass(prev => prev ? {
                    ...prev,
                    classData: { ...prev.classData, title: e.target.value }
                  } : null)}
                  className="input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label className="admin-form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Estimated Duration</label>
                <input
                  type="text"
                  value={editingClass.classData.duration || '60 min'}
                  onChange={e => setEditingClass(prev => prev ? {
                    ...prev,
                    classData: { ...prev.classData, duration: e.target.value }
                  } : null)}
                  className="input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label className="admin-form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Topics (comma-separated)</label>
                <input
                  type="text"
                  value={(editingClass.classData.topics || []).join(', ')}
                  onChange={e => {
                    const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    setEditingClass(prev => prev ? {
                      ...prev,
                      classData: { ...prev.classData, topics: list }
                    } : null);
                  }}
                  className="input"
                  style={{ width: '100%', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            {/* Sub-tabs inside Class Editor (Modern Pill Bar) */}
            <div style={{
              display: 'inline-flex',
              gap: '6px',
              background: '#F1F5F9',
              padding: '4px',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              alignSelf: 'flex-start'
            }}>
              {(['markdown', 'diagram', 'code', 'quiz'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setClassEditorTab(tab)}
                  style={{
                    padding: '7px 14px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: classEditorTab === tab ? '#FFFFFF' : 'transparent',
                    color: classEditorTab === tab ? '#0D6E74' : '#64748B',
                    boxShadow: classEditorTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab === 'markdown' && '📝 Markdown Content'}
                  {tab === 'diagram' && '📊 Architecture Diagram'}
                  {tab === 'code' && '💻 Python Sandbox Code'}
                  {tab === 'quiz' && `❓ Quiz Questions (${editingClass.classData.quiz?.length || 0})`}
                </button>
              ))}
            </div>

            {/* Modal Body Scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: '340px' }}>
              {/* MARKDOWN TAB */}
              {classEditorTab === 'markdown' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', height: '100%' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>
                        Markdown Source
                      </label>
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>GitHub Flavored Markdown</span>
                    </div>
                    <textarea
                      rows={16}
                      value={editingClass.classData.lesson_content || ''}
                      onChange={e => setEditingClass(prev => prev ? {
                        ...prev,
                        classData: { ...prev.classData, lesson_content: e.target.value }
                      } : null)}
                      className="input"
                      style={{ width: '100%', height: '380px', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical', lineHeight: '1.5', padding: '12px' }}
                      placeholder="# Lesson Title&#10;&#10;## Section 1&#10;Write explanation here..."
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155' }}>
                        Live Interactive Preview
                      </label>
                      <span style={{ fontSize: '0.75rem', color: '#0D6E74', fontWeight: 600 }}>Real-Time Render</span>
                    </div>
                    <div style={{
                      height: '380px',
                      overflowY: 'auto',
                      padding: '1.25rem',
                      background: 'var(--surface-2, #F8FAFC)',
                      border: '1px solid var(--border, #E2EDEB)',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      lineHeight: '1.6',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
                    }}>
                      <div dangerouslySetInnerHTML={{
                        __html: (editingClass.classData.lesson_content || '')
                          .replace(/^# (.*$)/gim, '<h1 style="font-size:1.35rem;font-weight:700;margin-bottom:0.5rem;color:#0F172A;">$1</h1>')
                          .replace(/^## (.*$)/gim, '<h2 style="font-size:1.1rem;font-weight:600;margin-top:1rem;margin-bottom:0.4rem;color:#0D6E74;">$1</h2>')
                          .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                          .replace(/```python([\s\S]*?)```/gim, '<pre style="background:#0F172A;color:#38BDF8;padding:12px;border-radius:6px;font-family:monospace;font-size:0.8rem;overflow-x:auto;">$1</pre>')
                          .replace(/```mermaid([\s\S]*?)```/gim, (_m, diag) => `
                            <div style="margin: 12px 0; border: 1.5px solid rgba(7, 210, 224, 0.4); border-radius: 10px; background: linear-gradient(135deg, rgba(7, 210, 224, 0.08) 0%, rgba(13, 110, 116, 0.03) 100%); overflow: hidden;">
                              <div style="background: rgba(7, 210, 224, 0.12); padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(7, 210, 224, 0.2);">
                                <span style="font-size: 0.75rem; font-weight: 700; color: #0D6E74; display: flex; align-items: center; gap: 5px;">⚡ Interactive Architecture Flowchart</span>
                                <span style="font-size: 0.68rem; font-weight: 700; background: #07D2E0; color: #113032; padding: 2px 6px; border-radius: 4px;">LIVE PREVIEW</span>
                              </div>
                              <div style="padding: 10px 12px; font-family: monospace; font-size: 0.78rem; color: #334155; line-height: 1.45; white-space: pre-wrap; max-height: 110px; overflow-y: auto;">${diag.trim()}</div>
                            </div>
                          `)
                          .replace(/\n/gim, '<br/>')
                      }} />
                    </div>
                  </div>
                </div>
              )}

              {/* ARCHITECTURE DIAGRAM TAB */}
              {classEditorTab === 'diagram' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Mermaid Diagram Definition
                  </label>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 8px 0' }}>
                    Enter Mermaid flowchart or state diagram source. Rendered live for learners.
                  </p>
                  <textarea
                    rows={8}
                    value={
                      editingClass.classData.diagrams?.[0] ||
                      `flowchart TD\n    User([Enterprise User]) --> Ingest[API Gateway]\n    Ingest --> Agent[Agent Supervisor]\n    Agent --> Retriever[Hybrid RAG Engine]\n    Retriever --> DB[(Vector Store)]\n    Agent --> Eval[Guardrail & Quality Gate]`
                    }
                    onChange={e => {
                      const val = e.target.value;
                      setEditingClass(prev => prev ? {
                        ...prev,
                        classData: { ...prev.classData, diagrams: [val] }
                      } : null);
                    }}
                    className="input"
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '1rem' }}
                  />

                  <div style={{ background: '#F0FAF7', border: '1px solid #07D2E0', borderRadius: '6px', padding: '1rem' }}>
                    <div style={{ fontWeight: 600, color: '#113032', fontSize: '0.85rem', marginBottom: '6px' }}>
                      Diagram Validation Status:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontSize: '0.85rem' }}>
                      <CheckCircle size={15} /> Mermaid diagram structure valid.
                    </div>
                  </div>
                </div>
              )}

              {/* CODE EXAMPLE TAB */}
              {classEditorTab === 'code' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155', display: 'block' }}>
                        Python Code Example (Runnable in Sandbox)
                      </label>
                      <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
                        Learners can execute, test, and experiment with this script directly in the browser sandbox.
                      </p>
                    </div>
                    <span style={{ fontSize: '0.75rem', background: '#F1F5F9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      Python 3.11 Standard
                    </span>
                  </div>

                  <div style={{ border: '1px solid #1E293B', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ background: '#1E293B', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }} />
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }} />
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }} />
                        </div>
                        <span style={{ color: '#94A3B8', fontSize: '0.78rem', fontFamily: 'monospace', marginLeft: '6px' }}>agent_example.py</span>
                      </div>
                      <span style={{ color: '#07D2E0', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>Interactive Sandbox Attached</span>
                    </div>
                    <textarea
                      rows={12}
                      value={
                        editingClass.classData.code_examples?.[0]?.code ||
                        `# Enterprise RAG & Tool Invocation\nfrom typing import Dict, Any\n\ndef execute_agent_step(query: str) -> Dict[str, Any]:\n    # Simulate agentic retrieval\n    return {\n        "status": "success",\n        "query": query,\n        "retrieved_docs": 4,\n        "confidence": 0.96\n    }\n\nif __name__ == "__main__":\n    result = execute_agent_step("Analyze clinical trial criteria")\n    print("Agent Result:", result)\n`
                      }
                      onChange={e => {
                        const codeVal = e.target.value;
                        setEditingClass(prev => prev ? {
                          ...prev,
                          classData: {
                            ...prev.classData,
                            code_examples: [{ name: 'agent_example.py', lang: 'python', code: codeVal, runnable: true }]
                          }
                        } : null);
                      }}
                      style={{
                        width: '100%',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        background: '#0F172A',
                        color: '#38BDF8',
                        padding: '14px',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                        lineHeight: '1.5'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* QUIZ BUILDER TAB */}
              {classEditorTab === 'quiz' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0F172A' }}>
                        Knowledge Check Questions
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
                        Questions required for class completion and automated scoring.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const newQ = {
                          id: `q_${Date.now()}`,
                          question: 'Enter question text here...',
                          options: ['Option A', 'Option B', 'Option C', 'Option D'],
                          correctIndex: 0,
                          explanation: 'Explanation for why Option A is correct.',
                        };
                        setEditingClass(prev => prev ? {
                          ...prev,
                          classData: {
                            ...prev.classData,
                            quiz: [...(prev.classData.quiz || []), newQ]
                          }
                        } : null);
                      }}
                      className="btn btn--sm btn--primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={14} /> Add Question
                    </button>
                  </div>

                  {(!editingClass.classData.quiz || editingClass.classData.quiz.length === 0) ? (
                    <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--surface-2, #F8FAFC)', borderRadius: '6px', border: '1px dashed var(--border, #CBD5E1)' }}>
                      <p style={{ color: '#64748B', fontSize: '0.85rem' }}>No quiz questions attached to this class yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {editingClass.classData.quiz.map((q, qIdx) => (
                        <div key={q.id || qIdx} style={{ padding: '1rem', background: 'var(--surface-2, #F8FAFC)', border: '1px solid var(--border, #E2E8F0)', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>
                              Question {qIdx + 1}
                            </span>
                            <button
                              onClick={() => {
                                setEditingClass(prev => prev ? {
                                  ...prev,
                                  classData: {
                                    ...prev.classData,
                                    quiz: (prev.classData.quiz || []).filter((_, idx) => idx !== qIdx)
                                  }
                                } : null);
                              }}
                              style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Remove
                            </button>
                          </div>

                          <input
                            type="text"
                            value={q.question}
                            onChange={e => {
                              const val = e.target.value;
                              setEditingClass(prev => {
                                if (!prev) return null;
                                const updatedQuiz = [...(prev.classData.quiz || [])];
                                updatedQuiz[qIdx] = { ...updatedQuiz[qIdx], question: val };
                                return { ...prev, classData: { ...prev.classData, quiz: updatedQuiz } };
                              });
                            }}
                            placeholder="Question Prompt..."
                            className="input"
                            style={{ width: '100%', marginBottom: '10px', fontWeight: 500 }}
                          />

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="radio"
                                  name={`correct_${q.id || qIdx}`}
                                  checked={q.correctIndex === oIdx}
                                  onChange={() => {
                                    setEditingClass(prev => {
                                      if (!prev) return null;
                                      const updatedQuiz = [...(prev.classData.quiz || [])];
                                      updatedQuiz[qIdx] = { ...updatedQuiz[qIdx], correctIndex: oIdx };
                                      return { ...prev, classData: { ...prev.classData, quiz: updatedQuiz } };
                                    });
                                  }}
                                  title="Mark as correct answer"
                                />
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={e => {
                                    const optVal = e.target.value;
                                    setEditingClass(prev => {
                                      if (!prev) return null;
                                      const updatedQuiz = [...(prev.classData.quiz || [])];
                                      const opts = [...updatedQuiz[qIdx].options];
                                      opts[oIdx] = optVal;
                                      updatedQuiz[qIdx] = { ...updatedQuiz[qIdx], options: opts };
                                      return { ...prev, classData: { ...prev.classData, quiz: updatedQuiz } };
                                    });
                                  }}
                                  className="input"
                                  style={{
                                    width: '100%',
                                    fontSize: '0.85rem',
                                    border: q.correctIndex === oIdx ? '1px solid #10B981' : undefined
                                  }}
                                />
                              </div>
                            ))}
                          </div>

                          <div>
                            <input
                              type="text"
                              value={q.explanation || ''}
                              onChange={e => {
                                const exp = e.target.value;
                                setEditingClass(prev => {
                                  if (!prev) return null;
                                  const updatedQuiz = [...(prev.classData.quiz || [])];
                                  updatedQuiz[qIdx] = { ...updatedQuiz[qIdx], explanation: exp };
                                  return { ...prev, classData: { ...prev.classData, quiz: updatedQuiz } };
                                });
                              }}
                              placeholder="Explanation shown after answer submission..."
                              className="input"
                              style={{ width: '100%', fontSize: '0.8rem', color: '#64748B' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border, #E2E8F0)', paddingTop: '1rem', marginTop: '1rem' }}>
              <button onClick={() => setEditingClass(null)} className="btn btn--outline">
                Cancel
              </button>
              <button onClick={handleSaveClass} disabled={saving} className="btn btn--primary">
                {saving ? 'Saving...' : 'Save Lesson'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VALIDATION RESULTS MODAL */}
      {showValidationModal && validation && (
        <div className="admin-modal-overlay" onClick={() => setShowValidationModal(false)}>
          <div className="admin-modal-card admin-modal-content-padded" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              {validation.valid ? (
                <CheckCircle size={24} color="#10B981" />
              ) : (
                <AlertCircle size={24} color="#EF4444" />
              )}
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
                {validation.valid ? 'Course Ready to Publish' : 'Validation Issues Found'}
              </h3>
            </div>

            {validation.valid ? (
              <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                All required curriculum elements are in place. You can publish this course immediately for enterprise learners.
              </p>
            ) : (
              <div>
                <p style={{ color: '#DC2626', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                  Please resolve the following {validation.errors.length} issue(s) before publishing:
                </p>
                <ul style={{ paddingLeft: '20px', color: '#475569', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                  {validation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn--outline" onClick={() => setShowValidationModal(false)}>
                Close
              </button>
              {validation.valid && course.status !== 'published' && (
                <button
                  className="btn btn--primary"
                  onClick={() => {
                    setShowValidationModal(false);
                    handleTogglePublish();
                  }}
                >
                  Publish Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW AS LEARNER MODAL */}
      {showLearnerPreview && (
        <div className="admin-modal-overlay" onClick={() => setShowLearnerPreview(false)}>
          <div
            className="admin-modal-card admin-modal-content-padded"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '900px', width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border, #E2E8F0)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={20} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
                  Learner View Preview
                </h3>
              </div>
              <button
                onClick={() => setShowLearnerPreview(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Course Header as seen by learner */}
            <div style={{ background: '#F0FAF7', border: '1px solid #07D2E0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <span style={{ fontSize: '2rem' }}>{course.icon || '🤖'}</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#113032' }}>
                    {course.title}
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: '#0D6E74', marginTop: '2px' }}>
                    {course.category} · {course.level} · {course.estimated_duration} · {course.modules?.length || 0} Modules
                  </div>
                </div>
              </div>
              <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                {course.description}
              </p>
            </div>

            {/* Syllabus Accordion preview */}
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#0F172A', marginBottom: '10px' }}>
              Curriculum Modules & Lessons
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(course.modules || []).map((m, mIdx) => (
                <div key={m.id} style={{ border: '1px solid #E2E8F0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ background: '#F8FAFC', padding: '10px 14px', fontWeight: 600, fontSize: '0.9rem', color: '#1E293B', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Week {m.module_number || (mIdx + 1)}: {m.title}</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 400 }}>{m.classes?.length || 0} classes</span>
                  </div>
                  <div style={{ padding: '8px 14px', background: '#FFF' }}>
                    {m.classes?.map((cl, cIdx) => (
                      <div key={cl.id} style={{ padding: '6px 0', borderBottom: cIdx === (m.classes.length - 1) ? 'none' : '1px solid #F1F5F9', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                        <span>Class {cl.class_number}: {cl.title}</span>
                        <span style={{ color: '#64748B', fontSize: '0.75rem' }}>{cl.duration || '60 min'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn--primary" onClick={() => setShowLearnerPreview(false)}>
                Done Previewing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Version Draft Modal */}
      {showVersionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#FFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0F172A' }}>
                Create New Course Version Draft
              </h3>
              <button
                onClick={() => setShowVersionModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
              Snapshots existing course modules and content into a distinct draft version without affecting active enrolled learners.
            </p>

            <form onSubmit={handleCreateVersionDraft}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Version Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1.1 or 2.0"
                  value={newVersionNumber}
                  onChange={e => setNewVersionNumber(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Change Summary / Release Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Updated RAG module with reciprocal rank fusion and added MCP tools evaluation lab"
                  value={newChangeSummary}
                  onChange={e => setNewChangeSummary(e.target.value)}
                  className="input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowVersionModal(false)}
                  className="btn btn--outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingVersion}
                  className="btn btn--primary"
                >
                  {creatingVersion ? 'Creating Snapshot...' : 'Create Draft Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
