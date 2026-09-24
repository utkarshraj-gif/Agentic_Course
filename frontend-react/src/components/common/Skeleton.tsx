// src/components/common/Skeleton.tsx
// High-fidelity Shimmer Skeleton Loading Components for Lessons and Admin Panels

import React from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  variant = 'rectangular',
  className = '',
  style = {},
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'circular':
        return 'skeleton-circle';
      case 'text':
        return 'skeleton-rounded';
      case 'rectangular':
      default:
        return 'skeleton-rounded';
    }
  };

  const computedStyle: React.CSSProperties = {
    width,
    height,
    ...style,
  };

  return (
    <div
      className={`skeleton-shimmer ${getVariantClass()} ${className}`}
      style={computedStyle}
      aria-hidden="true"
    />
  );
};

/**
 * Skeleton Loader for Learner Profile & Telemetry Dossier (AdminLearnerDetailPage)
 */
export const LearnerDetailSkeleton: React.FC = () => {
  return (
    <div className="page page--admin" aria-busy="true" aria-label="Loading learner dossier">
      {/* Top Back Link Skeleton */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Skeleton width="180px" height="32px" />
      </div>

      {/* Hero Header Skeleton */}
      <div className="skeleton-learner-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Skeleton variant="circular" width="64px" height="64px" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton width="240px" height="24px" />
            <Skeleton width="320px" height="16px" />
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <Skeleton width="90px" height="22px" />
              <Skeleton width="110px" height="22px" />
              <Skeleton width="80px" height="22px" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Skeleton width="150px" height="38px" />
          <Skeleton width="130px" height="38px" />
        </div>
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="skeleton-kpi-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width="110px" height="14px" />
              <Skeleton variant="circular" width="28px" height="28px" />
            </div>
            <Skeleton width="80px" height="28px" />
            <Skeleton width="140px" height="12px" />
          </div>
        ))}
      </div>

      {/* 2-Column Split Content Skeleton */}
      <div className="skeleton-split-layout">
        {/* Left Column: Progress Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="skeleton-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <Skeleton width="180px" height="20px" />
              <Skeleton width="80px" height="20px" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3, 4, 5, 6].map((row) => (
                <div
                  key={row}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Skeleton variant="circular" width="24px" height="24px" />
                    <div>
                      <Skeleton width="180px" height="16px" style={{ marginBottom: '4px' }} />
                      <Skeleton width="100px" height="12px" />
                    </div>
                  </div>
                  <Skeleton width="70px" height="22px" />
                  <Skeleton width="50px" height="16px" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Activity & Sandbox Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="skeleton-card">
            <Skeleton width="160px" height="20px" style={{ marginBottom: '1rem' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: 'flex', gap: '12px' }}>
                  <Skeleton variant="circular" width="28px" height="28px" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <Skeleton width="90%" height="14px" />
                    <Skeleton width="45%" height="12px" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="skeleton-card">
            <Skeleton width="140px" height="20px" style={{ marginBottom: '1rem' }} />
            <Skeleton width="100%" height="60px" style={{ marginBottom: '10px' }} />
            <Skeleton width="100%" height="60px" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton Loader for Lesson / Class Detail Pages (ClassDetail.tsx)
 */
export const LessonDetailSkeleton: React.FC<{ classId?: number | string }> = ({ classId }) => {
  return (
    <div className="lesson-page" aria-busy="true" aria-label={`Loading class ${classId || ''}`}>
      {/* Topbar Skeleton */}
      <div className="lesson-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="220px" height="20px" />
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width="34px" height="34px" variant="circular" />
          <Skeleton width="34px" height="34px" variant="circular" />
        </div>
      </div>

      <div style={{ padding: '0 2rem 3rem', maxWidth: '1100px', margin: '0 auto' }}>
        {/* Lesson Header Card Skeleton */}
        <div style={{ padding: '2rem 0', borderBottom: '1px solid var(--border, #e2e8f0)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Skeleton width="120px" height="24px" />
            <Skeleton width="90px" height="24px" />
          </div>
          <Skeleton width="70%" height="38px" style={{ marginBottom: '14px' }} />
          <Skeleton width="40%" height="18px" />
        </div>

        {/* Lesson Audio Player Bar Skeleton */}
        <div
          style={{
            padding: '1rem 1.25rem',
            background: '#ffffff',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '10px',
            marginBottom: '2.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <Skeleton variant="circular" width="36px" height="36px" />
            <Skeleton width="45%" height="16px" />
          </div>
          <Skeleton width="120px" height="30px" />
        </div>

        {/* Prose Content Skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Skeleton width="250px" height="26px" style={{ marginBottom: '0.5rem' }} />
          <Skeleton width="100%" height="16px" />
          <Skeleton width="96%" height="16px" />
          <Skeleton width="92%" height="16px" />
          <Skeleton width="60%" height="16px" />

          {/* Architecture Diagram Skeleton Card */}
          <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
            <Skeleton width="200px" height="24px" style={{ marginBottom: '1rem' }} />
            <div className="skeleton-diagram-box">
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', opacity: 0.6 }}>
                <Skeleton width="140px" height="60px" />
                <Skeleton width="30px" height="2px" />
                <Skeleton width="160px" height="60px" />
                <Skeleton width="30px" height="2px" />
                <Skeleton width="140px" height="60px" />
              </div>
            </div>
          </div>

          <Skeleton width="100%" height="16px" />
          <Skeleton width="94%" height="16px" />
          <Skeleton width="85%" height="16px" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton Loader for Admin Data Tables (e.g. Learners List, Telemetry, Activity)
 */
export const AdminTableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 6,
  columns = 6,
}) => {
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table className="skeleton-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton width="80%" height="14px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c}>
                  {c === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Skeleton variant="circular" width="30px" height="30px" />
                      <div style={{ flex: 1 }}>
                        <Skeleton width="120px" height="14px" style={{ marginBottom: '4px' }} />
                        <Skeleton width="80px" height="11px" />
                      </div>
                    </div>
                  ) : (
                    <Skeleton width={c === columns - 1 ? '60px' : '75%'} height="14px" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Skeleton Loader for Admin Dashboard Overview
 */
export const AdminDashboardSkeleton: React.FC = () => {
  return (
    <div className="page page--admin" aria-busy="true" aria-label="Loading dashboard metrics">
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Skeleton width="280px" height="30px" style={{ marginBottom: '8px' }} />
          <Skeleton width="420px" height="16px" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width="110px" height="34px" />
          <Skeleton width="130px" height="34px" />
        </div>
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="skeleton-kpi-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width="110px" height="14px" />
              <Skeleton variant="circular" width="28px" height="28px" />
            </div>
            <Skeleton width="90px" height="28px" />
            <Skeleton width="140px" height="12px" />
          </div>
        ))}
      </div>

      {/* 2-Column Main Section Skeleton */}
      <div className="skeleton-split-layout">
        <div className="skeleton-card" style={{ height: '360px' }}>
          <Skeleton width="180px" height="20px" style={{ marginBottom: '1rem' }} />
          <Skeleton width="100%" height="280px" />
        </div>
        <div className="skeleton-card" style={{ height: '360px' }}>
          <Skeleton width="160px" height="20px" style={{ marginBottom: '1rem' }} />
          <Skeleton width="100%" height="280px" />
        </div>
      </div>
    </div>
  );
};
