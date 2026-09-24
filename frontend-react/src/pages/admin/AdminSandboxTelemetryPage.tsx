// pages/admin/AdminSandboxTelemetryPage.tsx
// Telemetry on Interactive Agent Sandboxes, Guardrail Blocks & HITL Governance

import { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  UserCheck,
  Zap,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  ChevronRight
} from 'lucide-react';
import { AdminService } from '../../services/admin/AdminService';
import type { SandboxTelemetryData } from '../../services/admin/AdminService';
import { AdminErrorBanner } from '../../components/admin/AdminErrorBanner';
import { AdminIncidentModal } from '../../components/admin/AdminIncidentModal';
import { downloadCsv } from '../../services/admin/exportUtils';

export function AdminSandboxTelemetryPage() {
  const [telemetry, setTelemetry] = useState<SandboxTelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentCategory, setIncidentCategory] = useState<string | null>(null);

  const fetchTelemetry = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const data = await AdminService.getSandboxTelemetry();
      setTelemetry(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load sandbox telemetry:', err);
      if (!telemetry) {
        setError(err.message || 'Failed to establish connection with Agent Sandbox Telemetry daemon.');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [telemetry]);

  useEffect(() => {
    fetchTelemetry();
  }, []);

  // Visibility-aware background polling (every 15s)
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTelemetry(true);
      }
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTelemetry(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLive, fetchTelemetry]);

  const handleExportCsv = () => {
    if (!telemetry) return;
    const headers = [
      'Sandbox Name',
      'Domain',
      'Total Runs',
      'Avg Execution Time',
      'PHI Redactions',
      'Prompt Injections Blocked',
      'RCA Accuracy',
      'A2A Messages',
      'HITL Approved',
      'HITL Escalated',
      'HITL Denied'
    ];
    const rows = telemetry.sandboxes.map(sb => [
      sb.name,
      sb.domain,
      sb.runs,
      sb.avgExecutionTime,
      sb.phiRedactionsCount ?? 0,
      sb.promptInjectionBlocks ?? 0,
      sb.rcaAccuracy ?? 'N/A',
      sb.a2aMessagesExchanged ?? 0,
      sb.hitlDecisions?.approved ?? 0,
      sb.hitlDecisions?.escalated ?? 0,
      sb.hitlDecisions?.denied ?? 0,
    ]);
    downloadCsv('agent_sandboxes_telemetry', headers, rows);
  };

  const openIncidents = (category?: string) => {
    setIncidentCategory(category || null);
    setIncidentModalOpen(true);
  };

  if (loading && !telemetry) {
    return (
      <div className="page page--admin">
        <div className="loading-state">
          <RefreshCw size={20} className="admin-spinner" />
          <span>Connecting to Agent Telemetry Pipeline...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--admin">
      {/* Degraded State Recovery Banner */}
      {error && (
        <AdminErrorBanner
          title="Sandbox Telemetry Unavailable"
          message={error}
          onRetry={() => fetchTelemetry(false)}
        />
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Hands-on Lab Environments
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Monitor interactive lab executions, security guardrail triggers, and human-in-the-loop approval workflows.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Live Stream Toggle */}
          <button
            onClick={() => setIsLive(prev => !prev)}
            className={`btn btn--sm ${isLive ? 'btn--outline' : 'btn--secondary'}`}
            style={{ gap: '6px' }}
            title={isLive ? 'Live 15s polling active' : 'Polling paused'}
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
            {isLive ? 'Live Feed (15s)' : 'Paused'}
          </button>

          <button onClick={() => fetchTelemetry(false)} className="btn btn--outline btn--sm" style={{ gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>

          <button onClick={handleExportCsv} className="btn btn--outline btn--sm" style={{ gap: '6px' }}>
            <Download size={14} /> Export (CSV)
          </button>
        </div>
      </div>

      {/* Global Safety & Run Telemetry - Fluid Responsive Grid */}
      {telemetry && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Total Lab Runs</span>
              <div className="stat-icon-wrap">
                <Cpu size={15} />
              </div>
            </div>
            <div className="stat-value">{telemetry.totalInvocations}</div>
            <div className="stat-meta">
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>4 Sandboxes</span>
              <span style={{ color: 'var(--text-muted)' }}> • Student exercises</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Avg. Execution Time</span>
              <div className="stat-icon-wrap">
                <Zap size={15} />
              </div>
            </div>
            <div className="stat-value">{telemetry.averageLatencyMs} ms</div>
            <div className="stat-meta">
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>Target: &lt;2000ms</span>
              <span style={{ color: 'var(--text-muted)' }}> • Agent pipeline</span>
            </div>
          </div>

          {/* Interactive Guardrail Card with Incident Inspection */}
          <div
            className="stat-card stat-card--interactive"
            onClick={() => openIncidents()}
            style={{ cursor: 'pointer', transition: 'all 0.18s ease' }}
            title="Click to inspect safety guardrail incident logs"
          >
            <div className="stat-card-header">
              <span className="stat-label">Guardrail Interceptions</span>
              <div className="stat-icon-wrap" style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)' }}>
                <ShieldAlert size={15} />
              </div>
            </div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span>{telemetry.securityGuardrailBlocks}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                Audit log <ChevronRight size={12} />
              </span>
            </div>
            <div className="stat-meta">
              <span style={{ color: 'var(--red)', fontWeight: 600 }}>Safety Filters</span>
              <span style={{ color: 'var(--text-muted)' }}> • Injections & PHI intercepted</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Human Approvals</span>
              <div className="stat-icon-wrap">
                <UserCheck size={15} />
              </div>
            </div>
            <div className="stat-value">{telemetry.humanInTheLoopApprovals} / {telemetry.humanInTheLoopDenials}</div>
            <div className="stat-meta">
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>80.8% Approved</span>
              <span style={{ color: 'var(--text-muted)' }}> • Governance gate</span>
            </div>
          </div>
        </div>
      )}

      {/* Sandboxes Breakdown Grid */}
      {telemetry && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {telemetry.sandboxes.map((sb) => (
            <div key={sb.name} className="dashboard-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="dashboard-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--primary-light)',
                      color: 'var(--primary-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Layers size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{sb.name}</h4>
                    <span className="lesson-tag" style={{ marginTop: '2px', display: 'inline-block' }}>{sb.domain}</span>
                  </div>
                </div>
              </div>

              <div className="dashboard-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    background: 'var(--surface-2)',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Invocations</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{sb.runs}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Avg Execution</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{sb.avgExecutionTime}</div>
                  </div>

                  {sb.phiRedactionsCount !== undefined && (
                    <div
                      onClick={() => openIncidents('PHI Detection')}
                      style={{ cursor: 'pointer' }}
                      title="Click to view PHI redaction incident records"
                    >
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        PHI Redactions ↗
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{sb.phiRedactionsCount}</div>
                    </div>
                  )}

                  {sb.promptInjectionBlocks !== undefined && (
                    <div
                      onClick={() => openIncidents('Prompt Injection')}
                      style={{ cursor: 'pointer' }}
                      title="Click to view Prompt Injection incident records"
                    >
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Injections Blocked ↗
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--red)' }}>{sb.promptInjectionBlocks}</div>
                    </div>
                  )}

                  {sb.rcaAccuracy !== undefined && (
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>RCA Accuracy</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--green)' }}>{sb.rcaAccuracy}</div>
                    </div>
                  )}

                  {sb.a2aMessagesExchanged !== undefined && (
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>A2A Messages</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{sb.a2aMessagesExchanged}</div>
                    </div>
                  )}
                </div>

                {sb.hitlDecisions && (
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
                      Human-in-the-Loop Governance:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: 'var(--green)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        <CheckCircle2 size={12} /> {sb.hitlDecisions.approved} Approved
                      </span>
                      <span
                        onClick={() => openIncidents('HITL Escalation')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: 'rgba(245, 158, 11, 0.12)',
                          color: 'var(--amber)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Click to view HITL escalation records"
                      >
                        <AlertTriangle size={12} /> {sb.hitlDecisions.escalated} Escalated ↗
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: 'var(--red)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        ✕ {sb.hitlDecisions.denied} Denied
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incident Audit Modal */}
      <AdminIncidentModal
        isOpen={incidentModalOpen}
        filterCategory={incidentCategory}
        onClose={() => setIncidentModalOpen(false)}
      />
    </div>
  );
}
