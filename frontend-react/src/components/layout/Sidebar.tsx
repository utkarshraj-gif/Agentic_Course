// components/layout/Sidebar.tsx
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Layers, FlaskConical,
  CheckCircle, LogOut, User, Lock
} from 'lucide-react';
import { useAuth } from '../../services/auth/AuthContext';
import { ProgressService } from '../../services/progress/ProgressService';
import { getPrimaryCapstoneForClass } from '../../data';

interface ClassInfo {
  id: number;
  short: string;
}

interface SidebarProps {
  classes: Record<string, ClassInfo>;
  refreshKey: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const BASE_NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/curriculum', label: 'Courses', icon: BookOpen },
];

export function Sidebar({ classes, refreshKey, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const classList = Object.values(classes).sort((a, b) => a.id - b.id);

  // Content context: show practice and projects only while in course curriculum, classes, or labs/projects
  const isCoursesOpen = location.pathname.startsWith('/curriculum/') || location.pathname.startsWith('/class/');
  const isPracticeOrProjects = location.pathname.startsWith('/practice') || location.pathname.startsWith('/projects') || location.pathname.startsWith('/capstones/');
  const isContentContext = isCoursesOpen || isPracticeOrProjects;

  // Extract active class ID if currently on /class/:id
  const classMatch = location.pathname.match(/\/class\/(\d+)/);
  const currentClassId = classMatch ? parseInt(classMatch[1], 10) : null;
  const currentClassCapstone = currentClassId !== null ? getPrimaryCapstoneForClass(currentClassId) : null;

  const navItems = isContentContext
    ? [
        { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
        { to: '/curriculum', label: 'Courses', icon: BookOpen },
        {
          to: currentClassId !== null ? `/practice?class=${currentClassId}` : '/practice',
          label: 'Practice',
          icon: FlaskConical,
        },
        {
          to: currentClassCapstone ? `/capstones/${currentClassCapstone.slug}` : (currentClassId !== null ? `/projects?class=${currentClassId}` : '/projects'),
          label: 'Projects',
          icon: Layers,
        },
      ]
    : BASE_NAV_ITEMS;

  const isActive = (to: string) => {
    if (to === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/overview';
    if (to === '/curriculum') return location.pathname === '/curriculum' || isCoursesOpen;
    const basePath = to.split('?')[0];
    return location.pathname.startsWith(basePath);
  };

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    window.addEventListener('progress_updated', handler);
    return () => window.removeEventListener('progress_updated', handler);
  }, []);

  void refreshKey;
  void tick;

  const completedCount = classList.filter(cls => ProgressService.isClassCompleted(cls.id)).length;
  const firstIncomplete = classList.find(cls => !ProgressService.isClassCompleted(cls.id));
  const upNextId = firstIncomplete ? firstIncomplete.id : null;

  const CLASS_DURATIONS: Record<number, string> = {
    1: '45m', 2: '50m', 3: '55m', 4: '50m', 5: '45m',
    6: '50m', 7: '45m', 8: '50m', 9: '55m', 10: '45m',
    11: '50m', 12: '60m', 13: '45m', 14: '50m', 15: '55m',
  };

  return (
    <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`} role="navigation" aria-label="Main navigation">
      {/* Brand - Links back to Landing Page */}
      <Link to="/" className="sidebar-brand" title="Back to Landing Page" onClick={onMobileClose}>
        <img src="/logo.png" alt="Velloe Logo" className="sidebar-brand-img" />
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">VELLOE</span>
          <span className="sidebar-brand-sub">Learns</span>
        </div>
      </Link>

      {/* Primary Nav — Only Overview and Courses on root overview/catalog, adds Practice & Projects when inside related content */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={label}
            to={to}
            className={`sidebar-nav-item ${isActive(to) ? 'sidebar-nav-item--active' : ''}`}
            onClick={onMobileClose}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Classes Progress Stepper - only show when Courses are open */}
      {isCoursesOpen && (
        <nav className="sidebar-nav">
          <div className="sidebar-classes-header">
            <span className="sidebar-section-label">Course Track</span>
            <span className="sidebar-classes-badge">{completedCount} / {classList.length}</span>
          </div>

          <div className="sidebar-stepper">
            {classList.map((cls) => {
              const done = ProgressService.isClassCompleted(cls.id);
              const isLocked = !ProgressService.isClassUnlocked(cls.id);
              const isCurrent = location.pathname === `/class/${cls.id}`;
              const isNext = !done && !isLocked && cls.id === upNextId;
              const primaryCap = getPrimaryCapstoneForClass(cls.id);

              return (
                <div key={cls.id} className="stepper-item-group">
                  <Link
                    to={`/class/${cls.id}`}
                    className={`stepper-item ${isCurrent ? 'stepper-item--current' : ''} ${done ? 'stepper-item--done' : ''} ${isLocked ? 'stepper-item--locked' : ''} ${isNext ? 'stepper-item--next' : ''}`}
                    onClick={onMobileClose}
                    title={cls.id === 0 ? `${cls.short} ${isLocked ? '(Locked)' : '(30m)'}` : `Class ${cls.id}: ${cls.short} ${isLocked ? '(Locked)' : `(${CLASS_DURATIONS[cls.id] || '45m'})`}`}
                  >
                    {/* Timeline node */}
                    <div className="stepper-node">
                      {done ? (
                        <CheckCircle size={11} className="stepper-icon--done" />
                      ) : isLocked ? (
                        <Lock size={9} className="stepper-icon--locked" />
                      ) : isNext ? (
                        <span className="stepper-dot--next" />
                      ) : (
                        <span className="stepper-num">{cls.id === 0 ? 'P' : String(cls.id).padStart(2, '0')}</span>
                      )}
                    </div>

                    {/* Title */}
                    <span className="stepper-title">{cls.short}</span>

                    {/* Right Status Indicator */}
                    {isLocked && <span className="stepper-pill--locked"><Lock size={8} /> LOCKED</span>}
                    {!isLocked && isNext && <span className="stepper-pill--next">UP NEXT</span>}
                    {!isLocked && !done && !isNext && <span className="stepper-dur">{CLASS_DURATIONS[cls.id] || '45m'}</span>}
                  </Link>

                  {/* Contextual Practice & Project sub-links when this class is open */}
                  {isCurrent && (
                    <div className="stepper-sub-links">
                      <Link
                        to={`/practice?class=${cls.id}`}
                        className="stepper-sub-link"
                        onClick={onMobileClose}
                        title={`Open practice lab for ${cls.short}`}
                      >
                        <FlaskConical size={11} color="var(--primary)" />
                        <span>Practice Lab</span>
                      </Link>
                      {primaryCap && (
                        <Link
                          to={`/capstones/${primaryCap.slug}`}
                          className="stepper-sub-link"
                          onClick={onMobileClose}
                          title={`Open Capstone: ${primaryCap.title}`}
                        >
                          <Layers size={11} color={primaryCap.color} />
                          <span>{primaryCap.short}</span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>
      )}

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            <User size={14} />
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-user-email">{user?.email}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={logout} title="Sign out">
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}
