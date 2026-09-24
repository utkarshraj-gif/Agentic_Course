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
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useAdminAuth } from '../../services/admin/AdminAuthContext';

export function AdminLayout() {
  const { adminUser, adminLogout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('velloe_admin_sidebar_collapsed') === 'true';
  });

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Global shortcut Ctrl+B / Cmd+B to toggle collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsCollapsed(c => {
          const next = !c;
          localStorage.setItem('velloe_admin_sidebar_collapsed', String(next));
          return next;
        });
      }
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed(c => {
      const next = !c;
      localStorage.setItem('velloe_admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login');
  };

  return (
    <div className={`app-shell ${isCollapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
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

      {/* Floating desktop expand button when sidebar is collapsed */}
      {isCollapsed && (
        <button
          className="sidebar-desktop-expand-btn"
          onClick={handleToggleCollapse}
          title="Expand Sidebar (Ctrl+B)"
          aria-label="Expand Sidebar"
        >
          <PanelLeftOpen size={15} />
          <span>Expand</span>
        </button>
      )}

      {/* Sidebar matching Learner navigation layout */}
      <aside 
        className={`sidebar ${mobileOpen ? 'sidebar--open' : ''} ${isCollapsed ? 'sidebar--collapsed' : ''}`} 
        role="navigation" 
        aria-label="Admin navigation"
      >
        {/* Brand Header Row with Collapse and Close buttons */}
        <div className="sidebar-header-row">
          <Link to="/admin/dashboard" className="sidebar-brand" title="Enterprise Administration" onClick={() => setMobileOpen(false)}>
            <img src="/logo.png" alt="Velloe Logo" className="sidebar-brand-img" />
            {!isCollapsed && (
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-name">VELLOE</span>
                <span className="sidebar-brand-sub">Enterprise Admin</span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={handleToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
            aria-label="Toggle sidebar panel"
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          {/* Mobile Close Button */}
          {mobileOpen && (
            <button
              type="button"
              className="sidebar-mobile-close-btn"
              onClick={() => setMobileOpen(false)}
              title="Close menu"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

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
        <Outlet />
      </main>
    </div>
  );
}
