// components/admin/AdminErrorBanner.tsx
// Standard degraded state alert with active reconnection trigger

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AdminErrorBannerProps {
  title?: string;
  message?: string;
  onRetry: () => void;
}

export function AdminErrorBanner({
  title = 'Service Communication Disrupted',
  message = 'Failed to load telemetry or operational metrics. The backend service may be temporarily unreachable or undergoing maintenance.',
  onRetry,
}: AdminErrorBannerProps) {
  return (
    <div className="admin-error-banner" role="alert">
      <div className="admin-error-banner-icon">
        <AlertTriangle size={20} />
      </div>
      <div className="admin-error-banner-body">
        <div className="admin-error-banner-title">{title}</div>
        <p className="admin-error-banner-desc">{message}</p>
      </div>
      <button onClick={onRetry} className="btn btn--sm btn--primary admin-error-retry-btn">
        <RefreshCw size={13} /> Reconnect
      </button>
    </div>
  );
}
