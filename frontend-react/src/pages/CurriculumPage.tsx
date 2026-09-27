// pages/CurriculumPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useOutletContext, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, CheckCircle, Circle, Minus, Clock, ArrowRight, Lock, Layers } from 'lucide-react';
import { ProgressService } from '../services/progress/ProgressService';
import { ENROLLED_COURSES, getCourseBySlug, getCapstonesForWeek, getCapstonesForClass, ALL_CAPSTONES } from '../data';
import { adminCourseApi } from '../services/adminCourseApi';


interface ClassInfo {
  id: number;
  short: string;
  description: string;
  week?: number;
}

interface WeekInfo {
  n: number;
  title: string;
  classes: number[];
  summary: string;
  tools: string[];
}

interface OverviewData {
  weeks: WeekInfo[];
  classes: Record<string, ClassInfo>;
}

const ESTIMATED_TIMES: Record<number, string> = {
  0: '30 min',
  1: '45 min', 2: '50 min', 3: '55 min', 4: '50 min',
  5: '60 min', 6: '60 min', 7: '55 min', 8: '50 min',
  9: '65 min', 10: '55 min', 11: '60 min', 12: '70 min',
  13: '50 min', 14: '60 min', 15: '75 min',
};

function StatusBadge({ classId, isLocked }: { classId: number; isLocked?: boolean }) {
  if (isLocked) {
    return <span className="status-badge status-badge--locked"><Lock size={11} /> Locked</span>;
  }
  const done = ProgressService.isClassCompleted(classId);
  if (done) return <span className="status-badge status-badge--done"><CheckCircle size={12} /> Completed</span>;
  return <span className="status-badge status-badge--none"><Minus size={12} /> Not started</span>;
}

function WeekAccordion({
  week,
  classes,
  isLocked,
  prevWeek,
  defaultOpen,
}: {
  week: WeekInfo;
  classes: Record<string, ClassInfo>;
  isLocked: boolean;
  prevWeek?: WeekInfo;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const weekProgress = ProgressService.getWeekProgress(week.classes);
  const isDone = weekProgress === 100;

  // Keep open synchronized if defaultOpen changes (e.g., when previous week completes)
  useEffect(() => {
    if (defaultOpen && !isLocked) {
      setOpen(true);
    }
  }, [defaultOpen, isLocked]);

  return (
    <div className={`week-accordion ${open ? 'week-accordion--open' : ''} ${isLocked ? 'week-accordion--locked' : ''}`}>
      <button
        className={`week-accordion-header ${isLocked ? 'week-accordion-header--locked' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="week-accordion-left">
          <div className={`week-num-badge ${isDone ? 'week-num-badge--done' : isLocked ? 'week-num-badge--locked' : ''}`}>
            {isDone ? (
              <CheckCircle size={14} />
            ) : isLocked ? (
              <Lock size={14} />
            ) : (
              <span>{week.n === 0 ? 'PRE' : `W${week.n}`}</span>
            )}
          </div>
          <div>
            <div className="week-title-row">
              <span className="week-title">{week.title}</span>
              {isLocked && (
                <span className="week-locked-badge">
                  <Lock size={11} /> Locked
                </span>
              )}
            </div>
            <div className="week-meta">
              {week.classes.length} {week.classes.length === 1 ? 'class' : 'classes'}
              {isLocked ? (
                <span className="week-meta-locked"> · Complete {prevWeek ? prevWeek.title : `Week ${week.n - 1}`} to unlock</span>
              ) : (
                weekProgress > 0 && <span className="week-progress-txt"> · {weekProgress}% complete</span>
              )}
            </div>
          </div>
        </div>
        <div className="week-accordion-right">
          {!isLocked ? (
            <div className="week-progress-bar">
              <div className="week-progress-fill" style={{ width: `${weekProgress}%` }} />
            </div>
          ) : (
            <span className="week-locked-hint">
              <Lock size={14} />
            </span>
          )}
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {open && (
        <div className="week-accordion-body">
          {isLocked && (
            <div className="week-locked-banner">
              <div className="week-locked-banner-icon">
                <Lock size={18} />
              </div>
              <div className="week-locked-banner-content">
                <div className="week-locked-banner-title">Week {week.n} is currently locked</div>
                <p className="week-locked-banner-sub">
                  Complete all classes in{' '}
                  <strong>{prevWeek ? `Week ${prevWeek.n} (${prevWeek.title})` : `Week ${week.n - 1}`}</strong>{' '}
                  to unlock these lessons.
                </p>
              </div>
              {prevWeek && (
                <Link
                  to={`/class/${prevWeek.classes.find(id => !ProgressService.isClassCompleted(id)) || prevWeek.classes[0]}`}
                  className="btn btn--sm btn--primary week-locked-banner-btn"
                >
                  Continue Week {prevWeek.n} <ArrowRight size={12} />
                </Link>
              )}
            </div>
          )}

          <p className="week-summary">{week.summary}</p>
          <div className="week-tools">
            {week.tools.map(t => <span key={t} className="tool-badge">{t}</span>)}
          </div>
          <div className="class-list">
            {week.classes.map(classId => {
              const cls = classes[String(classId)];
              if (!cls) return null;
              const done = ProgressService.isClassCompleted(classId);
              const classCapstones = getCapstonesForClass(classId);

              if (isLocked) {
                return (
                  <div
                    key={classId}
                    className="class-row class-row--locked"
                    title={`Locked: Complete Week ${week.n - 1} classes first`}
                  >
                    <div className="class-row-left">
                      <div className="class-row-dot class-row-dot--locked">
                        <Lock size={13} />
                      </div>
                      <div>
                        <div className="class-row-num">{classId === 0 ? 'Prerequisites' : `Class ${String(classId).padStart(2, '0')}`}</div>
                        <div className="class-row-title">{cls.short}</div>
                        {cls.description && <div className="class-row-desc">{cls.description}</div>}
                        {classCapstones.length > 0 && (
                          <div className="class-row-capstones">
                            {classCapstones.map(c => (
                              <span
                                key={c.slug}
                                className="class-capstone-tag"
                                style={{ color: c.color, borderColor: `${c.color}40`, backgroundColor: `${c.color}15` }}
                              >
                                <Layers size={10} /> {c.short}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="class-row-right">
                      <StatusBadge classId={classId} isLocked={true} />
                      <div className="class-row-time">
                        <Clock size={12} /> {ESTIMATED_TIMES[classId] ?? '45 min'}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link key={classId} to={`/class/${classId}`} className="class-row">
                  <div className="class-row-left">
                    <div className={`class-row-dot ${done ? 'class-row-dot--done' : ''}`}>
                      {done ? <CheckCircle size={14} /> : <Circle size={14} />}
                    </div>
                    <div>
                      <div className="class-row-num">{classId === 0 ? 'Prerequisites' : `Class ${String(classId).padStart(2, '0')}`}</div>
                      <div className="class-row-title">{cls.short}</div>
                      {cls.description && <div className="class-row-desc">{cls.description}</div>}
                      {classCapstones.length > 0 && (
                        <div className="class-row-capstones">
                          {classCapstones.map(c => (
                            <span
                              key={c.slug}
                              className="class-capstone-tag"
                              style={{ color: c.color, borderColor: `${c.color}40`, backgroundColor: `${c.color}15` }}
                            >
                              <Layers size={10} /> {c.short}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="class-row-right">
                    <StatusBadge classId={classId} />
                    <div className="class-row-time">
                      <Clock size={12} /> {ESTIMATED_TIMES[classId] ?? '45 min'}
                    </div>
                    <ArrowRight size={14} className="class-row-arrow" />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Related Capstone Projects for this Week */}
          {week.n === 0 ? (
            <div className="week-projects-section week-projects-section--prereq">
              <div className="week-projects-header">
                <div className="week-projects-title-wrap">
                  <Layers size={14} className="week-projects-icon" />
                  <span className="week-projects-heading">Capstone Environment Prerequisite</span>
                </div>
                <span className="week-projects-subtitle">
                  Completing this setup configures the runtimes, vector databases, and APIs for all 4 enterprise capstones:
                </span>
              </div>
              <div className="week-prereq-capstones-grid">
                {ALL_CAPSTONES.map(cap => (
                  <Link
                    key={cap.slug}
                    to={`/capstones/${cap.slug}`}
                    className="week-prereq-capstone-chip"
                    title={`Explore ${cap.title}`}
                    onClick={() => ProgressService.markProjectStarted(cap.slug, cap.title)}
                  >
                    <span className="week-prereq-dot" style={{ background: cap.color }} />
                    <span className="week-prereq-chip-title">{cap.short}</span>
                    <span className="week-prereq-chip-domain">{cap.domain}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (() => {
            const weekCapstones = getCapstonesForWeek(week.n);
            if (weekCapstones.length === 0) return null;
            return (
              <div className="week-projects-section">
                <div className="week-projects-header">
                  <div className="week-projects-title-wrap">
                    <Layers size={14} className="week-projects-icon" />
                    <span className="week-projects-heading">
                      Related Capstone Project{weekCapstones.length > 1 ? 's' : ''}
                    </span>
                    <span className="week-projects-badge">
                      {weekCapstones.length} {weekCapstones.length === 1 ? 'project' : 'projects'}
                    </span>
                  </div>
                  <span className="week-projects-subtitle">
                    Applied production systems built using this week's architectures and tools
                  </span>
                </div>

                <div className="week-projects-list">
                  {weekCapstones.map(cap => {
                    const isStarted = ProgressService.isProjectStarted(cap.slug);
                    const highlight = cap.weekHighlight?.[week.n];
                    return (
                      <div key={cap.slug} className="week-project-item">
                        <div className="week-project-left">
                          <div
                            className="week-project-domain-pill"
                            style={{ borderColor: `${cap.color}60`, color: cap.color, background: `${cap.color}10` }}
                          >
                            {cap.domain}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="week-project-title-row">
                              <h4 className="week-project-title">{cap.title}</h4>
                              {isStarted && (
                                <span className="week-project-status-badge">
                                  <CheckCircle size={11} /> Started
                                </span>
                              )}
                            </div>
                            <p className="week-project-desc">{highlight || cap.description}</p>
                            <div className="week-project-meta-row">
                              <span className="week-project-meta-tag"><strong>Pattern:</strong> {cap.pattern}</span>
                              <span className="week-project-meta-tag"><strong>Key Metric:</strong> {cap.metric}</span>
                            </div>
                          </div>
                        </div>
                        <div className="week-project-right">
                          <Link
                            to={`/capstones/${cap.slug}`}
                            className="btn btn--sm btn--outline week-project-btn"
                            onClick={() => ProgressService.markProjectStarted(cap.slug, cap.title)}
                          >
                            {isStarted ? 'Continue Project' : 'Explore Project'} <ArrowRight size={13} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export function CurriculumPage() {
  const ctx = useOutletContext<{ overview: OverviewData | null }>();
  const overview = ctx?.overview ?? null;
  const [, setTick] = useState(0);
  const { courseSlug } = useParams<{ courseSlug?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedCourse = !!courseSlug;

  const [coursesList, setCoursesList] = useState(ENROLLED_COURSES);
  const [courseOverview, setCourseOverview] = useState<OverviewData | null>(null);

  const fetchLearnerCourses = useCallback(() => {
    adminCourseApi.getLearnerCourses()
      .then(courses => {
        if (courses && courses.length > 0) {
          setCoursesList(courses);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    fetchLearnerCourses();
  }, [location.key, fetchLearnerCourses]);

  useEffect(() => {
    const handler = () => fetchLearnerCourses();
    window.addEventListener('courses_updated', handler);
    return () => window.removeEventListener('courses_updated', handler);
  }, [fetchLearnerCourses]);

  useEffect(() => {
    if (courseSlug && courseSlug !== 'enterprise-ai') {
      adminCourseApi.getCourseOverview(courseSlug)
        .then(data => {
          if (data && data.weeks) {
            setCourseOverview(data);
          }
        })
        .catch(() => { });
    } else {
      setCourseOverview(null);
    }
  }, [courseSlug]);

  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    window.addEventListener('progress_updated', handler);
    return () => window.removeEventListener('progress_updated', handler);
  }, []);

  const activeOverview = courseOverview || overview;

  // CATALOG VIEW — Renders instantly without waiting for single-course curriculum overview
  if (!selectedCourse) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Courses</h1>
            <p className="page-subtitle">Your enrolled programs</p>
          </div>
        </div>
        <div className="courses-catalog">
          {coursesList.map(course => {
            const courseTotalClasses = course.totalClasses || (activeOverview ? Object.keys(activeOverview.classes).length : 24);
            const courseProgress = ProgressService.getCourseProgress(courseTotalClasses);
            const weeksCount = course.totalWeeks || (activeOverview ? activeOverview.weeks.length : 12);

            const bannerSrc = course.bannerImage || (course as any).banner_image || (course.slug === 'enterprise-ai' ? '/Agentic_Banner.png' : undefined);

            return (
              <button
                key={course.id}
                className="course-card"
                onClick={() => navigate(`/curriculum/${course.slug}`)}
                aria-label={`Open ${course.title}`}
              >
                <div className="course-card-banner">
                  {bannerSrc ? (
                    <img
                      src={bannerSrc}
                      alt={course.title}
                      className="course-card-banner-img"
                    />
                  ) : (
                    <span className="course-card-icon">{course.icon}</span>
                  )}
                </div>
                <div className="course-card-body">
                  <div className="course-card-meta">
                    <span className="course-card-tag">{course.category}</span>
                    <span className="course-card-tag course-card-tag--enrolled">Enrolled</span>
                  </div>
                  <h2 className="course-card-title">{course.title}</h2>
                  {(course.description || course.short_description) && (
                    <p className="course-card-desc">
                      {course.description || course.short_description}
                    </p>
                  )}
                  <div className="course-card-stats">
                    <span><Clock size={13} /> {weeksCount} weeks</span>
                    <span>📚 {courseTotalClasses} classes</span>
                    <span>✅ {courseProgress.completed} completed</span>
                  </div>
                  <div className="course-card-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: courseProgress.percent + '%' }} />
                    </div>
                    <span className="course-card-pct">{courseProgress.percent}%</span>
                  </div>
                  <div className="course-card-cta">
                    {courseProgress.completed > 0 ? 'Continue Course' : 'Start Course'} <ArrowRight size={15} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const currentCourse = coursesList.find(c => c.slug === courseSlug || c.id === courseSlug) || getCourseBySlug(courseSlug);

  // If a specific course is selected, wait for its curriculum overview
  if (!activeOverview) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{currentCourse?.title || 'Courses'}</h1>
        </div>
        <div className="loading-state">Loading courses...</div>
      </div>
    );
  }

  const totalClasses = Object.keys(activeOverview.classes).length;
  const progress = ProgressService.getCourseProgress(totalClasses);
  const activeWeek = activeOverview.weeks.find(
    w => ProgressService.isWeekUnlocked(w.n, activeOverview.weeks) && !ProgressService.isWeekCompleted(w.classes)
  );

  // COURSE DETAIL VIEW
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button
            className="courses-back-btn"
            onClick={() => navigate('/curriculum')}
            aria-label="Back to Courses"
          >
            ← Courses
          </button>
          <h1 className="page-title">{currentCourse?.title || 'Course Details'}</h1>
          <p className="page-subtitle">
            {activeOverview.weeks.length} weeks · {totalClasses} classes · {progress.completed} completed
          </p>
        </div>
        <div className="page-header-progress">
          <div className="progress-bar" style={{ width: '200px' }}>
            <div className="progress-fill" style={{ width: progress.percent + '%' }} />
          </div>
          <span className="page-header-pct">{progress.percent}%</span>
        </div>
      </div>
      <div className="curriculum-list">
        {activeOverview.weeks.map(week => {
          const isLocked = !ProgressService.isWeekUnlocked(week.n, activeOverview.weeks);
          const prevWeek = activeOverview.weeks.find(w => w.n === week.n - 1);
          const defaultOpen = activeWeek ? activeWeek.n === week.n : week.n === 1;
          return (
            <WeekAccordion
              key={week.n}
              week={week}
              classes={activeOverview.classes}
              isLocked={isLocked}
              prevWeek={prevWeek}
              defaultOpen={defaultOpen}
            />
          );
        })}
      </div>
    </div>
  );
}
