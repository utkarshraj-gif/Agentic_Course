// pages/admin/AdminAnalyticsPage.tsx
// Curriculum Bottlenecks, Drop-off Heatmap & Quiz Difficulty Curve

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingDown,
  AlertOctagon,
  Clock,
  RefreshCw,
  Download
} from 'lucide-react';
import { AdminService } from '../../services/admin/AdminService';
import type { CurriculumAnalyticsItem } from '../../services/admin/AdminService';
import { AdminErrorBanner } from '../../components/admin/AdminErrorBanner';
import { downloadCsv } from '../../services/admin/exportUtils';

export function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<CurriculumAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AdminService.getCurriculumAnalytics();
      setAnalytics(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      if (analytics.length === 0) {
        setError(err.message || 'Failed to calculate curriculum analytics and retention curves.');
      }
    } finally {
      setLoading(false);
    }
  }, [analytics.length]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleExportCsv = () => {
    if (analytics.length === 0) return;
    const headers = [
      'Class ID',
      'Module Title',
      'Domain',
      'Completion Rate (%)',
      'Drop-off Rate (%)',
      'Average Quiz Score (%)',
      'Difficulty Level',
      'Avg Duration (min)',
      'Total Passed'
    ];
    const rows = analytics.map(c => [
      c.classId,
      c.title,
      c.domain,
      c.completionRate,
      c.dropoffRate,
      c.averageQuizScore,
      c.difficultyLevel,
      c.avgDurationMin,
      c.totalPassed,
    ]);
    downloadCsv('curriculum_analytics_retention', headers, rows);
  };

  if (loading && analytics.length === 0) {
    return (
      <div className="page page--admin">
        <div className="loading-state">
          <RefreshCw size={20} className="admin-spinner" />
          <span>Calculating Curriculum Attrition & Difficulty Curves...</span>
        </div>
      </div>
    );
  }

  // Find hardest class & lowest completion
  const hardest = [...analytics].sort((a, b) => a.averageQuizScore - b.averageQuizScore)[0];
  const lowestCompletion = [...analytics].sort((a, b) => a.completionRate - b.completionRate)[0];

  return (
    <div className="page page--admin">
      {/* Degraded State Banner */}
      {error && (
        <AdminErrorBanner
          title="Curriculum Analytics Unavailable"
          message={error}
          onRetry={fetchAnalytics}
        />
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Course Analytics & Retention
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Identify module completion trends, drop-off rates, and quiz score averages across the curriculum.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchAnalytics} className="btn btn--outline btn--sm" style={{ gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExportCsv} className="btn btn--outline btn--sm" style={{ gap: '6px' }} disabled={analytics.length === 0}>
            <Download size={14} /> Export (CSV)
          </button>
        </div>
      </div>

      {/* Insight Highlight Cards - Fluid Responsive 3 Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Lowest Quiz Average</span>
            <div className="stat-icon-wrap" style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)' }}>
              <AlertOctagon size={15} />
            </div>
          </div>
          <div className="stat-value">{hardest?.title.split(':')[0] || 'Class 06'}</div>
          <div className="stat-meta">
            <span style={{ color: 'var(--red)', fontWeight: 600 }}>{hardest?.averageQuizScore}% avg score</span>
            <span style={{ color: 'var(--text-muted)' }}> • MCP & Protocols</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Highest Drop-Off</span>
            <div className="stat-icon-wrap" style={{ color: 'var(--amber)', background: 'rgba(245, 158, 11, 0.1)' }}>
              <TrendingDown size={15} />
            </div>
          </div>
          <div className="stat-value">{lowestCompletion?.dropoffRate}%</div>
          <div className="stat-meta">
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{lowestCompletion?.title.split(':')[0]}</span>
            <span style={{ color: 'var(--text-muted)' }}> • Review recommended</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Course Runtime</span>
            <div className="stat-icon-wrap">
              <Clock size={15} />
            </div>
          </div>
          <div className="stat-value">13.5 Hours</div>
          <div className="stat-meta">
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>54m avg per module</span>
            <span style={{ color: 'var(--text-muted)' }}> • 15 modules</span>
          </div>
        </div>
      </div>

      {/* Curriculum Performance Matrix */}
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Module</th>
                <th>Topic & Domain</th>
                <th style={{ width: '180px' }}>Completion Rate</th>
                <th style={{ width: '110px' }}>Drop-off</th>
                <th style={{ width: '110px' }}>Avg Quiz</th>
                <th style={{ width: '110px' }}>Difficulty</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Runtime</th>
              </tr>
            </thead>
            <tbody>
              {analytics.map((item) => (
                <tr key={item.classId}>
                  <td>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-light)',
                        padding: '3px 7px',
                        borderRadius: '4px',
                        display: 'inline-block',
                      }}
                    >
                      Class {String(item.classId).padStart(2, '0')}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.86rem' }}>{item.title}</div>
                    <span className="lesson-tag" style={{ marginTop: '2px', display: 'inline-block', fontSize: '0.7rem' }}>
                      {item.domain}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="progress-bar" style={{ flex: 1, height: '6px' }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${item.completionRate}%`,
                            background: item.dropoffRate > 35 ? 'var(--amber)' : 'var(--green)',
                          }}
                        />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', minWidth: '35px', textAlign: 'right' }}>
                        {item.completionRate}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        color: item.dropoffRate > 35 ? 'var(--red)' : item.dropoffRate > 20 ? 'var(--amber)' : 'var(--text-muted)',
                      }}
                    >
                      {item.dropoffRate}%
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        color: item.averageQuizScore >= 80 ? 'var(--green)' : 'var(--amber)',
                      }}
                    >
                      {item.averageQuizScore}%
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background:
                          item.difficultyLevel === 'High'
                            ? 'rgba(239, 68, 68, 0.12)'
                            : item.difficultyLevel === 'Medium'
                            ? 'rgba(245, 158, 11, 0.12)'
                            : 'rgba(16, 185, 129, 0.12)',
                        color:
                          item.difficultyLevel === 'High'
                            ? 'var(--red)'
                            : item.difficultyLevel === 'Medium'
                            ? 'var(--amber)'
                            : 'var(--green)',
                      }}
                    >
                      {item.difficultyLevel}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {item.avgDurationMin} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
