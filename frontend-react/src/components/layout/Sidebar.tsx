// components/layout/Sidebar.tsx
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Layers, FlaskConical, Map, Search,
  CheckCircle, LogOut, User, Lock
} from 'lucide-react';
import { useAuth } from '../../services/auth/AuthContext';
import { ProgressService } from '../../services/progress/ProgressService';

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

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/curriculum', label: 'Curriculum', icon: BookOpen },
  { to: '/practice', label: 'Practice', icon: FlaskConical },
  { to: '/projects', label: 'Projects', icon: Layers },
  { to: '/skills', label: 'Skill Map', icon: Map },
  { to: '/search', label: 'Search', icon: Search },
];

export function Sidebar({ classes, refreshKey, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const classList = Object.values(classes).sort((a, b) => a.id - b.id);

  const isActive = (to: string) => {
    if (to === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/overview';
    return location.pathname.startsWith(to);
  };

  void refreshKey;

  const completedCount = classList.filter(cls => ProgressService.isLessonComplete(cls.id)).length;
  const firstIncomplete = classList.find(cls => !ProgressService.isLessonComplete(cls.id));
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

      {/* Primary Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`sidebar-nav-item ${isActive(to) ? 'sidebar-nav-item--active' : ''}`}
            onClick={onMobileClose}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Classes Progress Stepper */}
      <nav className="sidebar-nav">
        <div className="sidebar-classes-header">
          <span className="sidebar-section-label">Curriculum Track</span>
          <span className="sidebar-classes-badge">{completedCount} / {classList.length}</span>
        </div>

        <div className="sidebar-stepper">
          {classList.map((cls) => {
            const done = ProgressService.isClassCompleted(cls.id);
            const isLocked = !ProgressService.isClassUnlocked(cls.id);
            const isCurrent = location.pathname === `/class/${cls.id}`;
            const isNext = !done && !isLocked && cls.id === upNextId;

            return (
              <Link
                key={cls.id}
                to={`/class/${cls.id}`}
                className={`stepper-item ${isCurrent ? 'stepper-item--current' : ''} ${done ? 'stepper-item--done' : ''} ${isLocked ? 'stepper-item--locked' : ''} ${isNext ? 'stepper-item--next' : ''}`}
                onClick={onMobileClose}
                title={`Class ${cls.id}: ${cls.short} ${isLocked ? '(Locked)' : `(${CLASS_DURATIONS[cls.id] || '45m'})`}`}
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
                    <span className="stepper-num">{String(cls.id).padStart(2, '0')}</span>
                  )}
                </div>

                {/* Title */}
                <span className="stepper-title">{cls.short}</span>

                {/* Right Status Indicator */}
                {isLocked && <span className="stepper-pill--locked"><Lock size={8} /> LOCKED</span>}
                {!isLocked && isNext && <span className="stepper-pill--next">UP NEXT</span>}
                {!isLocked && !done && !isNext && <span className="stepper-dur">{CLASS_DURATIONS[cls.id] || '45m'}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

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
