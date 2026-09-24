import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Users,
  BarChart3,
  Terminal,
  Activity,
  LogOut,
  ExternalLink,
  LayoutDashboard,
  Shield,
  Menu,
  X,
  User
} from 'lucide-react';
import { useAdminAuth } from '../../services/admin/AdminAuthContext';
import { AdminService } from '../../services/admin/AdminService';
import type { LearnerOverview } from '../../services/admin/AdminService';

export function AdminLayout() {
  const { adminUser, adminLogout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [learnersList, setLearnersList] = useState<LearnerOverview[]>([]);

  useEffect(() => {
    AdminService.getLearners()
      .then(data => setLearnersList(data))
      .catch(() => {});
  }, []);

  const isLearnerDetail = location.pathname.startsWith('/admin/learners/');
  const activeLearnerId = isLearnerDetail ? location.pathname.split('/')[3] : null;
  const activeLearner = learnersList.find(l => l.id === activeLearnerId);

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login');
  };

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile hamburger */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar matching Learner navigation layout */}
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`} role="navigation" aria-label="Admin navigation">
        {/* Brand */}
        <Link to="/admin/dashboard" className="sidebar-brand" title="Enterprise Administration" onClick={() => setMobileOpen(false)}>
          <img src="/logo.png" alt="Velloe Logo" className="sidebar-brand-img" />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">VELLOE</span>
            <span className="sidebar-brand-sub">Enterprise Admin</span>
          </div>
        </Link>

        {/* Primary Admin Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Management</div>
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <LayoutDashboard size={16} />
            <span>Overview</span>
          </NavLink>
          <NavLink
            to="/admin/learners"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <Users size={16} />
            <span>Learners & Teams</span>
          </NavLink>
          <NavLink
            to="/admin/analytics"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <BarChart3 size={16} />
            <span>Course Analytics</span>
          </NavLink>
          <NavLink
            to="/admin/sandboxes"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <Terminal size={16} />
            <span>Hands-on Labs</span>
          </NavLink>
          <NavLink
            to="/admin/activity"
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <Activity size={16} />
            <span>Audit Log</span>
          </NavLink>
        </nav>

        {/* Operational Status */}
        <nav className="sidebar-nav" style={{ marginTop: 'auto', marginBottom: '1rem' }}>
          <div className="sidebar-section-label">System Status</div>
          <div className="sidebar-admin-status-box">
            <div className="sidebar-admin-status-indicator">
              <span className="sidebar-admin-live-dot" />
              <span>All Systems Operational</span>
            </div>
            <p className="sidebar-admin-status-sub">15 Modules & 4 Lab Sandboxes</p>
          </div>
          <a
            href="/dashboard"
            className="sidebar-nav-item"
            target="_blank"
            rel="noreferrer"
            style={{ marginTop: '0.5rem' }}
          >
            <ExternalLink size={16} />
            <span>Switch to Learner View</span>
          </a>
        </nav>

        {/* User footer matching Learner Sidebar */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" style={{ background: '#F1F5F9', color: '#475569' }}>
              <Shield size={14} />
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{adminUser?.name || 'Administrator'}</span>
              <span className="sidebar-user-email">{adminUser?.role || 'Super Admin'}</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} title="Sign out of Admin">
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="app-main" id="main-content">
        {/* Global Admin Command & Learner Scope Bar */}
        <header className="admin-command-bar">
          <div className="admin-command-bar-left">
            <div className="admin-scope-badge">
              <span className="admin-scope-beacon" />
              <span>
                Scope: {activeLearner ? <strong>Individual Learner ({activeLearner.name})</strong> : 'Global Organization'}
              </span>
            </div>
            {activeLearner && (
              <button
                className="btn btn--sm btn--outline"
                style={{ padding: '2px 8px', fontSize: '0.72rem', height: '26px' }}
                onClick={() => navigate('/admin/learners')}
                title="Return to entire company roster"
              >
                Clear User Scope
              </button>
            )}
          </div>

          <div className="admin-command-bar-right">
            <div className="admin-scope-select-wrap">
              <User size={13} style={{ color: 'var(--text-muted)' }} />
              <select
                className="admin-scope-select"
                value={activeLearnerId || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    navigate(`/admin/learners/${e.target.value}`);
                  } else {
                    navigate('/admin/learners');
                  }
                }}
                aria-label="Inspect individual learner data"
              >
                <option value="">👤 Select Learner to Inspect Particular Data...</option>
                {learnersList.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.cohort}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
