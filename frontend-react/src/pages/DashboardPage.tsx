// pages/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, CheckCircle, Clock, BookOpen, Layers, Activity, BarChart2, Lock } from 'lucide-react';
import { useAuth } from '../services/auth/AuthContext';
import { ProgressService, DEFAULT_WEEKS } from '../services/progress/ProgressService';
import type { ActivityItem, LastVisited } from '../services/progress/ProgressService';

interface WeekInfo {
  n: number;
  title: string;
  classes: number[];
}

interface OverviewData {
  weeks: WeekInfo[];
  classes: Record<string, { id: number; short: string; description: string }>;
}

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  const icons = {
    lesson_complete: <CheckCircle size={14} color="#10B981" />,
    quiz_complete: <BarChart2 size={14} color="#07D2E0" />,
    lab_complete: <CheckCircle size={14} color="#07D2E0" />,
    bookmark: <BookOpen size={14} color="#6B7280" />,
    lesson_start: <BookOpen size={14} color="#4A7275" />,
    project_start: <Layers size={14} color="#07D2E0" />,
  };
  return icons[type] ?? <Activity size={14} />;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const ctx = useOutletContext<{ overview: OverviewData | null }>();
  const overview = ctx?.overview ?? null;

  const [lastVisited, setLastVisited] = useState<LastVisited | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLastVisited(ProgressService.getLastVisited());
    setActivity(ProgressService.getRecentActivity());
  }, [refreshKey]);

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('progress_updated', handler);
    return () => window.removeEventListener('progress_updated', handler);
  }, []);

  const classList = overview ? Object.values(overview.classes).sort((a, b) => a.id - b.id) : [];
  const totalClasses = classList.length;
  const progress = ProgressService.getCourseProgress(totalClasses);

  const greet = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="page">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">{greet()}, {user?.name?.split(' ')[0]}.</h1>
        <p className="page-subtitle">Here's where you stand in the Agentic AI program.</p>
      </div>

      <div className="dashboard-grid-layout">
        {/* Left column */}
        <div className="dashboard-main-col">

          {/* Continue Learning */}
          <section className="dashboard-card">
            <div className="dashboard-card-header">
              <BookOpen size={16} />
              <h2>Continue Learning</h2>
            </div>
            {lastVisited ? (
              <div className="resume-block">
                <div className="resume-meta">
                  <span className="resume-tag">Class {lastVisited.classId}</span>
                </div>
                <h3 className="resume-title">{lastVisited.classTitle}</h3>
                <div className="resume-progress-row">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: ProgressService.isLessonComplete(lastVisited.classId) ? '100%' : '30%' }}
                    />
                  </div>
                  <span className="resume-progress-label">
                    {ProgressService.isLessonComplete(lastVisited.classId) ? 'Completed' : 'In progress'}
                  </span>
                </div>
                <Link to={`/class/${lastVisited.classId}`} className="btn btn--primary">
                  Continue Learning <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="resume-block resume-block--empty">
                <h3 className="resume-title">Start your learning journey</h3>
                <p>Begin with the foundation of Agentic AI — and build from there.</p>
                <Link to="/class/1" className="btn btn--primary">
                  Start Class 1 <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </section>

          {/* Learning Path */}
          <section className="dashboard-card">
            <div className="dashboard-card-header">
              <Clock size={16} />
              <h2>Learning Path</h2>
            </div>
            <div className="learning-path">
              {(overview?.weeks ?? DEFAULT_WEEKS).map((week) => {
                const weekProgress = ProgressService.getWeekProgress(week.classes);
                const isWeekUnlocked = ProgressService.isWeekUnlocked(week.n, overview?.weeks);
                const isDone = weekProgress === 100;
                const isLocked = !isWeekUnlocked;
                const isActive = isWeekUnlocked && !isDone;

                return (
                  <div key={week.n} className={`path-step ${isDone ? 'path-step--done' : isLocked ? 'path-step--locked' : isActive ? 'path-step--active' : ''}`}>
                    <div className="path-step-indicator">
                      {isDone ? <CheckCircle size={14} /> : isLocked ? <Lock size={12} /> : <span>{String(week.n).padStart(2, '0')}</span>}
                    </div>
                    <div className="path-step-content">
                      <div className="path-step-title-row">
                        <span className="path-step-title">{week.title}</span>
                        {isLocked && <span className="path-step-locked-pill"><Lock size={9} /> Locked</span>}
                      </div>
                      {isLocked ? (
                        <div className="path-step-locked-hint">Complete Week {week.n - 1} to unlock</div>
                      ) : (
                        weekProgress > 0 && !isDone && (
                          <div className="progress-bar" style={{ marginTop: '6px', height: '4px' }}>
                            <div className="progress-fill" style={{ width: `${weekProgress}%` }} />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="dashboard-side-col">
          {/* Overall progress */}
          <section className="dashboard-card">
            <div className="dashboard-card-header">
              <BarChart2 size={16} />
              <h2>Overall Progress</h2>
            </div>
            <div className="progress-summary">
              <div className="progress-ring-wrap">
                <svg viewBox="0 0 56 56" className="progress-ring" aria-hidden="true">
                  <circle
                    className="progress-ring-bg"
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="#E2EDEB"
                    strokeWidth="5"
                  />
                  <circle
                    className="progress-ring-fill"
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="#07D2E0"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 22}`}
                    strokeDashoffset={`${2 * Math.PI * 22 * (1 - progress.percent / 100)}`}
                    transform="rotate(-90 28 28)"
                    style={{
                      transition: 'stroke-dashoffset 0.6s ease',
                      stroke: 'var(--primary, #07D2E0)',
                    }}
                  />
                </svg>
                <div className="progress-ring-label">{progress.percent}%</div>
              </div>
              <div className="progress-summary-text">
                <div className="progress-summary-title">Agentic AI Program</div>
                <div className="progress-summary-sub">{progress.completed} of {progress.total} classes complete</div>
              </div>
            </div>
            <Link to="/curriculum" className="btn btn--outline btn--sm" style={{ marginTop: '1rem', display: 'flex' }}>
              View curriculum <ArrowRight size={13} />
            </Link>
          </section>

          {/* Recent Activity */}
          <section className="dashboard-card">
            <div className="dashboard-card-header">
              <Activity size={16} />
              <h2>Recent Activity</h2>
            </div>
            {activity.length === 0 ? (
              <p className="empty-state-text">No activity yet. Start a class to track your progress.</p>
            ) : (
              <ul className="activity-list">
                {activity.slice(0, 8).map((item, i) => (
                  <li key={i} className="activity-item">
                    <div className="activity-icon"><ActivityIcon type={item.type} /></div>
                    <div className="activity-body">
                      <span className="activity-label">{item.label}</span>
                      <span className="activity-time">{timeAgo(item.timestamp)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
