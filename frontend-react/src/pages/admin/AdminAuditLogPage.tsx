// src/pages/admin/AdminAuditLogPage.tsx
// Dedicated Administrative Audit Log: Immutable event ledger for LMS governance

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { listAuditLogs } from '../../services/adminEnterpriseApi';
import type { AuditLog } from '../../services/adminEnterpriseApi';

export function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionCategory, setActionCategory] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  async function loadAuditLogs(actionFilter?: string) {
    setLoading(true);
    try {
      const data = await listAuditLogs({
        action: actionFilter && actionFilter !== 'all' ? actionFilter : undefined,
        limit: 100
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCategoryChange = (cat: string) => {
    setActionCategory(cat);
    if (cat === 'all') {
      loadAuditLogs();
    } else {
      loadAuditLogs(cat);
    }
  };

  const filteredLogs = logs.filter(log => {
    const q = searchQuery.toLowerCase();
    const actorMatch = (log.actor_name || '').toLowerCase().includes(q) ||
      (log.actor_role || '').toLowerCase().includes(q);
    const actionMatch = (log.action || '').toLowerCase().includes(q);
    const entityMatch = (log.entity_name || '').toLowerCase().includes(q) ||
      (log.entity_id || '').toLowerCase().includes(q);
    return actorMatch || actionMatch || entityMatch;
  });

  const getActionColor = (action: string) => {
    if (action.includes('PUBLISH')) return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
    if (action.includes('CREATE')) return { bg: 'var(--primary-light, rgba(7, 210, 224, 0.12))', text: '#0891b2', border: 'rgba(7, 210, 224, 0.25)' };
    if (action.includes('ENROLL')) return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' };
    if (action.includes('DELETE') || action.includes('ARCHIVE')) return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
    return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
  };

  const courseEventsCount = logs.filter(l => l.action.startsWith('COURSE_')).length;
  const cohortEventsCount = logs.filter(l => l.action.startsWith('COHORT_')).length;
  const enrollmentEventsCount = logs.filter(l => l.action.includes('ENROLL')).length;

  return (
    <div className="admin-audit-log-page" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--primary-light, rgba(7, 210, 224, 0.12))', color: 'var(--primary, #07D2E0)' }}>
              <Shield size={24} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #113032)', letterSpacing: '-0.02em' }}>
              Enterprise Audit Log
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted, #4A7275)', margin: 0, fontSize: '0.95rem' }}>
            Immutable administrative mutation ledger tracking publishing cycles, version transitions, cohort actions, and system governance.
          </p>
        </div>

        <button
          onClick={() => loadAuditLogs(actionCategory !== 'all' ? actionCategory : undefined)}
          className="btn btn--outline"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
          <div style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Total Audit Events</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main, #113032)' }}>{logs.length}</div>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-light, #7A9A9C)', marginTop: '0.25rem' }}>Full cryptographic trace</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
          <div style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Course & Version Events</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary-hover, #0891b2)' }}>{courseEventsCount}</div>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-light, #7A9A9C)', marginTop: '0.25rem' }}>Drafts, approvals, published releases</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
          <div style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Cohort Operations</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#8b5cf6' }}>{cohortEventsCount}</div>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-light, #7A9A9C)', marginTop: '0.25rem' }}>Provisioning & course deadlines</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid var(--border, #E2EDEB)', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(17, 48, 50, 0.05)' }}>
          <div style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>Enrollment Actions</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#059669' }}>{enrollmentEventsCount}</div>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-light, #7A9A9C)', marginTop: '0.25rem' }}>Bulk & individual learner provisioning</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        background: '#FFFFFF',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        border: '1px solid var(--border, #E2EDEB)',
        boxShadow: '0 1px 3px rgba(17, 48, 50, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
          <Search size={16} color="var(--text-light, #7A9A9C)" />
          <input
            type="text"
            placeholder="Search by actor, action name, or affected entity..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main, #113032)', outline: 'none', width: '100%', fontSize: '0.875rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All Events' },
            { key: 'COURSE_PUBLISHED', label: 'Publishing' },
            { key: 'COURSE_VERSION_CREATED', label: 'Versioning' },
            { key: 'COHORT_CREATED', label: 'Cohorts' },
            { key: 'LEARNERS_BULK_ENROLLED', label: 'Bulk Enroll' }
          ].map(cat => (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              style={{
                background: actionCategory === cat.key ? 'var(--primary-light, rgba(7, 210, 224, 0.14))' : 'transparent',
                color: actionCategory === cat.key ? '#0891b2' : 'var(--text-muted, #4A7275)',
                border: actionCategory === cat.key ? '1px solid var(--primary, #07D2E0)' : '1px solid transparent',
                borderRadius: '6px',
                padding: '0.3rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid var(--border, #E2EDEB)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(17, 48, 50, 0.04)'
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted, #4A7275)' }}>
            Loading audit events...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted, #4A7275)' }}>
            No audit records match the current criteria.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2, #F8FCFB)', borderBottom: '1px solid var(--border, #E2EDEB)', color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem' }}>
                <th style={{ padding: '0.875rem 1rem', width: '40px' }}></th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Timestamp</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Actor</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Action</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Target Entity</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const colors = getActionColor(log.action);
                const isExpanded = expandedLogId === log.id;
                const formattedDate = log.created_at
                  ? new Date(log.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })
                  : 'N/A';

                return (
                  <React.Fragment key={log.id}>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border, #E2EDEB)',
                        background: isExpanded ? 'var(--bg-light, #F0FAF7)' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      <td style={{ padding: '0.875rem 0.5rem 0.875rem 1rem', color: 'var(--text-light, #7A9A9C)' }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted, #4A7275)', whiteSpace: 'nowrap', fontSize: '0.825rem' }}>
                        {formattedDate}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main, #113032)' }}>{log.actor_name}</div>
                        <div style={{ color: 'var(--text-light, #7A9A9C)', fontSize: '0.775rem' }}>{log.actor_role}</div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{
                          background: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          fontFamily: 'monospace'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ color: 'var(--text-main, #113032)', fontWeight: 600 }}>
                          {log.entity_name || log.entity_id || 'System'}
                        </div>
                        <div style={{ color: 'var(--text-muted, #4A7275)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                          {log.entity_type}
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted, #4A7275)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {log.ip_address || 'internal'}
                      </td>
                    </tr>

                    {/* Expandable JSON details row */}
                    {isExpanded && (
                      <tr style={{ background: 'var(--surface-2, #F8FCFB)', borderBottom: '1px solid var(--border, #E2EDEB)' }}>
                        <td colSpan={6} style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ color: 'var(--text-main, #113032)', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Audit Event Payload & Metadata:
                          </div>
                          <pre style={{
                            background: '#0F172A',
                            border: '1px solid var(--border, #E2EDEB)',
                            borderRadius: '8px',
                            padding: '0.875rem',
                            color: '#38bdf8',
                            fontSize: '0.8rem',
                            overflowX: 'auto',
                            margin: 0
                          }}>
                            {JSON.stringify(log.details || {}, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
export default AdminAuditLogPage;
