// pages/CurriculumPage.tsx
import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ChevronDown, ChevronRight, CheckCircle, Circle, Minus, Clock, ArrowRight, Lock } from 'lucide-react';
import { ProgressService } from '../services/progress/ProgressService';

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
              <span>W{week.n}</span>
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
              {week.classes.length} classes
              {isLocked ? (
                <span className="week-meta-locked"> · Complete Week {week.n - 1} to unlock</span>
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
                        <div className="class-row-num">Class {String(classId).padStart(2, '0')}</div>
                        <div className="class-row-title">{cls.short}</div>
                        {cls.description && <div className="class-row-desc">{cls.description}</div>}
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
                      <div className="class-row-num">Class {String(classId).padStart(2, '0')}</div>
                      <div className="class-row-title">{cls.short}</div>
                      {cls.description && <div className="class-row-desc">{cls.description}</div>}
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
        </div>
      )}
    </div>
  );
}

export function CurriculumPage() {
  const ctx = useOutletContext<{ overview: OverviewData | null }>();
  const overview = ctx?.overview ?? null;
  const [, setTick] = useState(0);

  // Re-render when progress updates (e.g. user completes a lesson/quiz)
  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    window.addEventListener('progress_updated', handler);
    return () => window.removeEventListener('progress_updated', handler);
  }, []);

  if (!overview) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Curriculum</h1>
        </div>
        <div className="loading-state">Loading curriculum...</div>
      </div>
    );
  }

  const totalClasses = Object.keys(overview.classes).length;
  const progress = ProgressService.getCourseProgress(totalClasses);

  // Find the active week (first incomplete week that is unlocked)
  const activeWeek = overview.weeks.find(
    w => ProgressService.isWeekUnlocked(w.n, overview.weeks) && !ProgressService.isWeekCompleted(w.classes)
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Curriculum</h1>
          <p className="page-subtitle">
            {overview.weeks.length} weeks · {totalClasses} classes · {progress.completed} completed
          </p>
        </div>
        <div className="page-header-progress">
          <div className="progress-bar" style={{ width: '200px' }}>
            <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="page-header-pct">{progress.percent}%</span>
        </div>
      </div>

      <div className="curriculum-list">
        {overview.weeks.map(week => {
          const isLocked = !ProgressService.isWeekUnlocked(week.n, overview.weeks);
          const prevWeek = overview.weeks.find(w => w.n === week.n - 1);
          const defaultOpen = activeWeek ? activeWeek.n === week.n : week.n === 1;

          return (
            <WeekAccordion
              key={week.n}
              week={week}
              classes={overview.classes}
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
