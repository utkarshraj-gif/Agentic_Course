// pages/admin/AdminLoginPage.tsx
// Administrator Login matching the Learner Login UI

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Lock, ShieldCheck, KeyRound } from 'lucide-react';
import { useAdminAuth } from '../../services/admin/AdminAuthContext';

export function AdminLoginPage() {
  const [email, setEmail] = useState('admin@velloe.ai');
  const [password, setPassword] = useState('velloe@admin2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { adminLogin, loginAsDemoAdmin } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid administrator email.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter the security access key.');
      return;
    }

    setLoading(true);
    setError('');
    const res = await adminLogin(email.trim(), password.trim());
    setLoading(false);

    if (res.success) {
      navigate('/admin/dashboard');
    } else {
      setError(res.error || 'Authentication rejected. Verify admin credentials.');
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    setError('');
    await loginAsDemoAdmin();
    setLoading(false);
    navigate('/admin/dashboard');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <img src="/logo.png" alt="Velloe Logo" className="login-brand-img" />
          <div>
            <div className="login-brand-name">VELLOE</div>
            <div className="login-brand-sub">Enterprise Administration</div>
          </div>
        </div>

        <div className="login-divider" />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span className="lesson-tag" style={{ background: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
            <ShieldCheck size={12} /> Enterprise Portal
          </span>
        </div>
        <h1 className="login-title">Administrator Sign In</h1>
        <p className="login-subtitle">Sign in to manage employee cohorts, track progress, and review certifications.</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="admin-email" className="login-label">Admin Email</label>
            <div className="login-input-wrap">
              <Mail size={16} className="login-input-icon" />
              <input
                id="admin-email"
                type="email"
                className="login-input"
                placeholder="admin@velloe.ai"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="admin-pass" className="login-label">Security Access Key</label>
            <div className="login-input-wrap">
              <Lock size={16} className="login-input-icon" />
              <input
                id="admin-pass"
                type="password"
                className="login-input"
                placeholder="••••••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            {error && <p className="login-error" role="alert">{error}</p>}
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Admin Portal'} <ArrowRight size={16} />
          </button>
        </form>

        <div className="login-or">
          <span>or</span>
        </div>

        <button
          className="btn btn--outline btn--full"
          onClick={handleDemo}
          disabled={loading}
          type="button"
        >
          <KeyRound size={16} />
          <span>One-Click Enterprise Admin Demo</span>
        </button>

        <p className="login-terms" style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Authorized administrator credentials only. All activity is audited.
        </p>
      </div>
    </div>
  );
}
