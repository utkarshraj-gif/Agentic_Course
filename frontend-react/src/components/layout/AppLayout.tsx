// components/layout/AppLayout.tsx
import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X, PanelLeftOpen } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { API_BASE } from '../../services/api';

interface ClassInfo {
  id: number;
  short: string;
}

interface OverviewData {
  classes: Record<string, ClassInfo>;
}

export function AppLayout() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('velloe_sidebar_collapsed') === 'true';
  });
  const location = useLocation();

  useEffect(() => {
    fetch(`${API_BASE}/curriculum`)
      .then(res => res.json())
      .then(setOverview)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('progress_updated', handler);
    return () => window.removeEventListener('progress_updated', handler);
  }, []);

  // Automatically close mobile menu when navigating routes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Global keyboard shortcut: Ctrl+B / Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsCollapsed(prev => {
          const next = !prev;
          localStorage.setItem('velloe_sidebar_collapsed', String(next));
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
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('velloe_sidebar_collapsed', String(next));
      return next;
    });
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

      <Sidebar
        classes={overview?.classes || {}}
        refreshKey={refreshKey}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <main
        className={`app-main ${mobileOpen ? 'app-main--obscured' : ''}`}
        id="main-content"
      >
        <Outlet context={{ overview, refreshKey }} />
      </main>
    </div>
  );
}
