// services/bookmarks/BookmarkService.ts
// Per-user local cache with NeonDB PostgreSQL backend synchronization

import { API_BASE, getCurrentUserId } from '../api';

export interface Bookmark {
  classId: number;
  classTitle: string;
  addedAt: string;
}

function bookmarkKey(userId?: string): string {
  const uid = userId || getCurrentUserId();
  return `velloe_${uid}_bookmarks`;
}

export const BookmarkService = {
  /**
   * Hydrates bookmarks from NeonDB backend into user-scoped localStorage
   */
  async hydrateFromBackend(userId: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/storage/bookmarks/${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.bookmarks)) {
        localStorage.setItem(bookmarkKey(userId), JSON.stringify(json.bookmarks));
      }
    } catch (err) {
      console.warn('[NeonDB Sync] Could not hydrate bookmarks from backend:', err);
    }
  },

  getAll(userId?: string): Bookmark[] {
    try {
      return JSON.parse(localStorage.getItem(bookmarkKey(userId)) || '[]');
    } catch {
      return [];
    }
  },

  isBookmarked(classId: number, userId?: string): boolean {
    return this.getAll(userId).some(b => b.classId === classId);
  },

  add(classId: number, classTitle: string, userId?: string) {
    const uid = userId || getCurrentUserId();
    const all = this.getAll(uid);
    if (!this.isBookmarked(classId, uid)) {
      all.unshift({ classId, classTitle, addedAt: new Date().toISOString() });
      localStorage.setItem(bookmarkKey(uid), JSON.stringify(all));
    }

    try {
      fetch(`${API_BASE}/storage/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uid,
          class_id: classId,
          class_title: classTitle,
        }),
      }).catch(err => {
        console.warn('[NeonDB Sync] Failed to post bookmark:', err);
      });
    } catch (err) {
      console.warn('[NeonDB Sync] Error calling bookmark API:', err);
    }
  },

  remove(classId: number, userId?: string) {
    const uid = userId || getCurrentUserId();
    const updated = this.getAll(uid).filter(b => b.classId !== classId);
    localStorage.setItem(bookmarkKey(uid), JSON.stringify(updated));

    try {
      fetch(`${API_BASE}/storage/bookmarks/${encodeURIComponent(uid)}/${classId}`, {
        method: 'DELETE',
      }).catch(err => {
        console.warn('[NeonDB Sync] Failed to delete bookmark:', err);
      });
    } catch (err) {
      console.warn('[NeonDB Sync] Error deleting bookmark from API:', err);
    }
  },

  toggle(classId: number, classTitle: string, userId?: string): boolean {
    const uid = userId || getCurrentUserId();
    if (this.isBookmarked(classId, uid)) {
      this.remove(classId, uid);
      return false;
    } else {
      this.add(classId, classTitle, uid);
      return true;
    }
  },
};
