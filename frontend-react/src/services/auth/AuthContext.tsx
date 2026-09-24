// services/auth/AuthContext.tsx
// Clean auth abstraction with NeonDB user synchronization and progress hydration

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logout: () => void;
}

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { API_BASE } from '../api';
import { ProgressService } from '../progress/ProgressService';
import { BookmarkService } from '../bookmarks/BookmarkService';

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'velloe_demo_user';

function buildUserFromEmail(email: string): AuthUser {
  const namePart = email.split('@')[0];
  const name = namePart.charAt(0).toUpperCase() + namePart.slice(1).replace(/[._]/g, ' ');
  return {
    id: `user-${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    name,
    email,
  };
}

async function syncUserWithBackend(user: AuthUser) {
  try {
    await fetch(`${API_BASE}/storage/users/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
      }),
    });
    // Hydrate progress and bookmarks for this user from NeonDB
    await Promise.allSettled([
      ProgressService.hydrateFromBackend(user.id),
      BookmarkService.hydrateFromBackend(user.id),
    ]);
  } catch (err) {
    console.warn('[NeonDB Auth Sync] Could not sync user with backend:', err);
  }
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        setUser(parsed);
        // Async background sync
        syncUserWithBackend(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string) => {
    const newUser = buildUserFromEmail(email);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    setUser(newUser);
    await syncUserWithBackend(newUser);
  };

  const loginAsDemo = async () => {
    const demoUser: AuthUser = {
      id: 'demo-user-001',
      name: 'Demo Learner',
      email: 'demo@velloe.tech',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser));
    setUser(demoUser);
    await syncUserWithBackend(demoUser);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginAsDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside DemoAuthProvider');
  return ctx;
}
