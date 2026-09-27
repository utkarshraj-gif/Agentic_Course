// pages/NotFoundPage.tsx
import { Link } from 'react-router-dom';
import { Compass, ArrowRight, LayoutDashboard, BookOpen } from 'lucide-react';

interface NotFoundPageProps {
  isAdmin?: boolean;
}

export function NotFoundPage({ isAdmin = false }: NotFoundPageProps) {
  return (
    <div
      className="page"
      style={{
        minHeight: '75vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          background: 'var(--bg-white, #FFFFFF)',
          border: '1px solid var(--border, #E2EDEB)',
          borderRadius: '18px',
          padding: '3rem 2rem',
          boxShadow: '0 8px 32px rgba(17, 48, 50, 0.06)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(7, 210, 224, 0.12)',
            color: 'var(--primary, #07D2E0)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <Compass size={32} />
        </div>

        <span
          style={{
            display: 'block',
            fontSize: '0.82rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--primary, #07D2E0)',
            marginBottom: '0.4rem',
          }}
        >
          404 · Resource Not Found
        </span>

        <h1
          style={{
            fontSize: '1.65rem',
            fontWeight: 800,
            color: 'var(--text-main, #113032)',
            marginBottom: '0.75rem',
            lineHeight: 1.25,
          }}
        >
          Page does not exist
        </h1>

        <p
          style={{
            fontSize: '0.92rem',
            color: 'var(--text-muted, #4A7275)',
            lineHeight: 1.6,
            marginBottom: '2rem',
          }}
        >
          {isAdmin
            ? "The administrative screen you are trying to reach doesn't exist or may have been restricted. Return to your command center."
            : "The lesson, course, or route you are looking for doesn't exist or has been moved. Check the course syllabus or return to your overview."}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {isAdmin ? (
            <Link to="/admin/dashboard" className="btn btn--primary">
              <LayoutDashboard size={15} /> Back to Command Center
            </Link>
          ) : (
            <>
              <Link to="/dashboard" className="btn btn--primary">
                <LayoutDashboard size={15} /> Go to Overview
              </Link>
              <Link to="/curriculum" className="btn btn--outline">
                <BookOpen size={15} /> Browse Courses <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
