// components/admin/AdminAuthGuard.tsx
// Route protection strictly for Administrator pages

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../services/admin/AdminAuthContext';

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { adminUser, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="admin-loading-screen">
        <div className="admin-spinner" />
        <p>Authenticating Executive Credentials...</p>
      </div>
    );
  }

  if (!adminUser) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
