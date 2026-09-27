// components/common/ErrorBoundary.tsx
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          style={{
            minHeight: '70vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            background: 'var(--bg-light, #F0FAF7)',
          }}
        >
          <div
            style={{
              maxWidth: '540px',
              width: '100%',
              background: 'var(--bg-white, #FFFFFF)',
              border: '1px solid var(--border, #E2EDEB)',
              borderRadius: '16px',
              padding: '2.5rem 2rem',
              boxShadow: '0 8px 30px rgba(17, 48, 50, 0.08)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={28} />
            </div>

            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: 'var(--text-main, #113032)',
                marginBottom: '0.6rem',
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: '0.92rem',
                color: 'var(--text-muted, #4A7275)',
                lineHeight: 1.55,
                marginBottom: '1.75rem',
              }}
            >
              An unexpected error occurred in this module. Your progress is saved. You can try reloading or return to your overview dashboard.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginBottom: '1.5rem',
              }}
            >
              <button
                type="button"
                onClick={this.handleReset}
                className="btn btn--primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <RefreshCw size={15} /> Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="btn btn--outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Home size={15} /> Back to Overview
              </button>
            </div>

            {this.state.error && (
              <div style={{ textAlign: 'left', marginTop: '1rem', borderTop: '1px solid var(--border, #E2EDEB)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #4A7275)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
                </button>

                {this.state.showDetails && (
                  <pre
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      background: 'var(--surface-2, #F8FCFB)',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      color: '#EF4444',
                      overflowX: 'auto',
                      maxHeight: '140px',
                    }}
                  >
                    {this.state.error.toString()}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
