import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Mail, Home } from 'lucide-react';
import { useAuth } from '../services/auth/AuthContext';

export function LoginPage() {
  const { login, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid work email.');
      return;
    }
    setLoading(true);
    await login(email.trim());
    navigate('/dashboard');
  };

  const handleDemo = async () => {
    setLoading(true);
    await loginAsDemo();
    navigate('/dashboard');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Back to Home Button */}
        <Link to="/" className="login-back-home" title="Back to Landing Page">
          <Home size={15} />
          <span>Back to Home</span>
        </Link>

        {/* Brand */}
        <div className="login-brand">
          <img src="/logo.png" alt="Velloe Logo" className="login-brand-img" />
          <div>
            <div className="login-brand-name">VELLOE</div>
            <div className="login-brand-sub">Learns</div>
          </div>
        </div>

        <div className="login-divider" />

        <h1 className="login-title">Sign in to continue</h1>
        <p className="login-subtitle">Continue your learning journey.</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="email" className="login-label">Work email</label>
            <div className="login-input-wrap">
              <Mail size={16} className="login-input-icon" />
              <input
                id="email"
                type="email"
                className="login-input"
                placeholder="you@velloe.tech"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                autoComplete="email"
                autoFocus
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
            Continue <ArrowRight size={16} />
          </button>
        </form>

        <div className="login-or">
          <span>or</span>
        </div>

        <button
          className="btn btn--outline btn--full"
          onClick={handleDemo}
          disabled={loading}
        >
          Continue as Demo Learner
        </button>
      </div>

      {/* Background decoration */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg-grid" />
      </div>
    </div>
  );
}
