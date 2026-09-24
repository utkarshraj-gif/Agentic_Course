// components/layout/AppLayout.tsx
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';

const API_BASE = 'http://127.0.0.1:8000/api';

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

      <Sidebar
        classes={overview?.classes || {}}
        refreshKey={refreshKey}
        onMobileClose={() => setMobileOpen(false)}
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
