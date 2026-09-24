// services/admin/AdminAuthContext.tsx
// Isolated Administrator Authentication State

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { API_BASE } from '../api';

export interface AdminUser {
  adminId: string;
  name: string;
  email: string;
  role: string;
  token: string;
  permissions: string[];
}

export interface AdminAuthContextValue {
  adminUser: AdminUser | null;
  isLoading: boolean;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsDemoAdmin: () => Promise<void>;
  adminLogout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

const ADMIN_STORAGE_KEY = 'velloe_admin_session';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AdminUser;
        setAdminUser(parsed);
      } catch {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const adminLogin = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.detail || 'Invalid admin credentials' };
      }

      const body = await res.json();
      const user = body.data as AdminUser;
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(user));
      setAdminUser(user);
      return { success: true };
    } catch {
      // Local fallback in case network issues during demo
      if (email.toLowerCase().includes('admin') && password === 'velloe@admin2026') {
        const fallbackAdmin: AdminUser = {
          adminId: 'adm_local',
          name: 'Enterprise Administrator',
          email,
          role: 'Super Admin',
          token: 'velloe_adm_token_local',
          permissions: ['all_eyes', 'view_learners', 'view_analytics', 'view_audit']
        };
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(fallbackAdmin));
        setAdminUser(fallbackAdmin);
        return { success: true };
      }
      return { success: false, error: 'Connection failed. Please check backend server.' };
    }
  };

  const loginAsDemoAdmin = async () => {
    await adminLogin('admin@velloe.ai', 'velloe@admin2026');
  };

  const adminLogout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setAdminUser(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        isLoading,
        adminLogin,
        loginAsDemoAdmin,
        adminLogout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return ctx;
}
