// src/services/api.ts
// Central API configuration and user helper

export const API_BASE = 'http://127.0.0.1:8000/api';

export function getCurrentUserId(): string {
  try {
    const raw = localStorage.getItem('velloe_demo_user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.id) return user.id;
    }
  } catch {
    // fallback
  }
  return 'demo-user-001';
}
