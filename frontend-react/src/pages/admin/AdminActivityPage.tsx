// pages/admin/AdminActivityPage.tsx
// Real-time Organization Activity Stream & Event Surveillance Feed

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  RefreshCw,
  Search,
  CheckCircle,
  Terminal,
  Award,
  Clock,
  Download,
  X
} from 'lucide-react';
import { AdminService } from '../../services/admin/AdminService';
import type { ActivityStreamEvent } from '../../services/admin/AdminService';
import { AdminErrorBanner } from '../../components/admin/AdminErrorBanner';
import { downloadCsv } from '../../services/admin/exportUtils';

const EVENT_TYPES = [
  { key: 'all', label: 'All Events' },
  { key: 'quiz_complete', label: 'Quiz Passes' },
  { key: 'lesson_complete', label: 'Lessons Completed' },
  { key: 'sandbox_run', label: 'Agent Sandbox' },
  { key: 'project_start', label: 'Capstones' },
  { key: 'bookmark', label: 'Bookmarks' },
];

export function AdminActivityPage() {
  const [events, setEvents] = useState<ActivityStreamEvent[]>([]);
  const [selectedType, setSelectedType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const fetchEvents = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const data = await AdminService.getActivityStream(100);
      setEvents(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load activity stream:', err);
      if (events.length === 0) {
        setError(err.message || 'Failed to connect to organizational activity stream.');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [events.length]);

  useEffect(() => {
    fetchEvents();
  }, []);

  // Visibility-aware background polling (20s)
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchEvents(true);
      }
    }, 20000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchEvents(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLive, fetchEvents]);

  // Filter events
  const filteredEvents = events.filter((ev) => {
    const matchesType = selectedType === 'all' || ev.type === selectedType;
    const matchesSearch =
      !searchTerm ||
      ev.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.label.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleExportCsv = () => {
    if (filteredEvents.length === 0) return;
    const headers = ['Event ID', 'Timestamp', 'User Name', 'Event Type', 'Activity Description', 'Class ID'];
    const rows = filteredEvents.map(ev => [
      ev.id,
      ev.timestamp,
      ev.userName,
      ev.type,
      ev.label,
      ev.classId ?? 'N/A',
    ]);
    downloadCsv('activity_audit_log', headers, rows);
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'quiz_complete':
        return { label: 'Quiz', color: 'var(--amber)', bg: 'rgba(245, 158, 11, 0.12)', icon: Award };
      case 'lesson_complete':
        return { label: 'Lesson', color: 'var(--green)', bg: 'rgba(16, 185, 129, 0.12)', icon: CheckCircle };
      case 'sandbox_run':
        return { label: 'Sandbox', color: 'var(--primary)', bg: 'var(--primary-light)', icon: Terminal };
      case 'project_start':
        return { label: 'Capstone', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)', icon: Activity };
      default:
        return { label: 'Activity', color: 'var(--text-muted)', bg: 'var(--surface-2)', icon: Clock };
    }
  };

  return (
    <div className="page page--admin">
      {/* Degraded State Banner */}
      {error && (
        <AdminErrorBanner
          title="Activity Feed Connection Lost"
          message={error}
          onRetry={() => fetchEvents(false)}
        />
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Audit & Activity Log
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Chronological surveillance of learner module completions, quiz submissions, and hands-on lab interactions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Live Indicator */}
          <button
            onClick={() => setIsLive(prev => !prev)}
            className={`btn btn--sm ${isLive ? 'btn--outline' : 'btn--secondary'}`}
            style={{ gap: '6px' }}
            title={isLive ? 'Live 20s polling active' : 'Polling paused'}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isLive ? 'var(--green)' : 'var(--text-light)',
                boxShadow: isLive ? '0 0 6px var(--green)' : 'none',
                display: 'inline-block'
              }}
            />
            {isLive ? 'Live Feed (20s)' : 'Paused'}
          </button>

          <button onClick={() => fetchEvents(false)} className="btn btn--outline btn--sm" style={{ gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>

          <button onClick={handleExportCsv} className="btn btn--outline btn--sm" style={{ gap: '6px' }} disabled={filteredEvents.length === 0}>
            <Download size={14} /> Export (CSV)
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-2)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {EVENT_TYPES.map((t) => (
            <button
              key={t.key}
              className="btn btn--sm"
              style={{
                background: selectedType === t.key ? 'var(--color-bg-white)' : 'transparent',
                color: selectedType === t.key ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: selectedType === t.key ? 700 : 500,
                border: selectedType === t.key ? '1px solid var(--border)' : '1px solid transparent',
                boxShadow: selectedType === t.key ? 'var(--shadow-sm)' : 'none',
              }}
              onClick={() => setSelectedType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', position: 'relative', minWidth: '200px', flex: '1 1 auto', maxWidth: '380px', width: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="login-input"
            style={{ paddingLeft: '2.4rem', paddingRight: searchTerm ? '2rem' : '1rem', height: '38px', fontSize: '0.85rem' }}
            placeholder="Search by learner or activity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Activity Log Feed */}
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && events.length === 0 ? (
          <div className="loading-state" style={{ minHeight: '200px' }}>
            <span>Loading Activity Feed...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
            <p>No activity logs found for the selected criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Time</th>
                  <th style={{ width: '110px' }}>Type</th>
                  <th>Learner</th>
                  <th>Activity Description</th>
                  <th style={{ textAlign: 'right' }}>Event ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((ev) => {
                  const badge = getEventBadge(ev.type);
                  const Icon = badge.icon;
                  return (
                    <tr key={ev.id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: '0.7rem' }}>
                          {new Date(ev.timestamp).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.color,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Icon size={12} /> {badge.label}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/admin/learners/${ev.userId || 'user_sarah_chen'}`}
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            textDecoration: 'none',
                            display: 'inline-block'
                          }}
                          className="hover-underline"
                          title={`Inspect particular data for ${ev.userName}`}
                        >
                          {ev.userName}
                        </Link>
                        {ev.email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ev.email}</div>}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 500 }}>
                          {ev.label}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-light)' }}>
                            #{ev.id}
                          </span>
                          <Link
                            to={`/admin/learners/${ev.userId || 'user_sarah_chen'}`}
                            className="btn btn--outline btn--sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem', height: '24px' }}
                            title={`Inspect ${ev.userName}'s dossier`}
                          >
                            User Data →
                          </Link>
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
    </div>
  );
}
