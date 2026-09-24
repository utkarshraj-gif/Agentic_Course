// services/progress/ProgressService.ts
// Per-user local cache with automatic NeonDB PostgreSQL backend synchronization

import { API_BASE, getCurrentUserId } from '../api';

export interface QuizResult {
  score: number;
  total: number;
  completedAt: string;
  userAnswers?: Record<string, number>;
}

export interface ActivityItem {
  type: 'lesson_complete' | 'quiz_complete' | 'lab_complete' | 'bookmark' | 'lesson_start' | 'project_start';
  label: string;
  classId?: number;
  timestamp: string;
}

export interface LastVisited {
  classId: number;
  classTitle: string;
  timestamp: string;
}

// User-scoped localStorage key helpers
function userPrefix(userId?: string): string {
  const uid = userId || getCurrentUserId();
  return `velloe_${uid}_`;
}

function key(suffix: string, userId?: string) {
  return `${userPrefix(userId)}progress_${suffix}`;
}

function activityKey(userId?: string) {
  return `${userPrefix(userId)}activity`;
}

function lastVisitedKey(userId?: string) {
  return `${userPrefix(userId)}last_visited`;
}

function readActivity(userId?: string): ActivityItem[] {
  try {
    return JSON.parse(localStorage.getItem(activityKey(userId)) || '[]');
  } catch {
    return [];
  }
}

function appendActivity(item: ActivityItem, userId?: string) {
  const existing = readActivity(userId);
  const updated = [item, ...existing].slice(0, 50); // cap at 50
  localStorage.setItem(activityKey(userId), JSON.stringify(updated));
}

// Background sync helper to safely post to NeonDB backend
function postToBackend(endpoint: string, body: object) {
  try {
    fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(err => {
      console.warn(`[NeonDB Sync] Failed to post to ${endpoint}:`, err);
    });
  } catch (err) {
    console.warn(`[NeonDB Sync] Error scheduling post to ${endpoint}:`, err);
  }
}

export const DEFAULT_WEEKS: Array<{ n: number; title: string; classes: number[] }> = [
  { n: 1, title: 'Foundations & Agent Architectures', classes: [1, 2] },
  { n: 2, title: 'Tool Use & Knowledge Retrieval', classes: [3, 4] },
  { n: 3, title: 'Multi-Agent Collaboration & Protocols', classes: [5, 6] },
  { n: 4, title: 'Memory, State & Orchestration', classes: [7, 8] },
  { n: 5, title: 'Evaluation, Testing & CI/CD', classes: [9, 10] },
  { n: 6, title: 'Deployment, Monitoring & Observability', classes: [11, 12] },
  { n: 7, title: 'Safety, Security & Capstone Deployment', classes: [13, 14, 15] },
];

export const ProgressService = {
  /**
   * Hydrates progress from NeonDB into user-scoped local storage on login / startup
   */
  async hydrateFromBackend(userId: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/storage/progress/${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.status !== 'success' || !json.data) return;

      const data = json.data;

      // 1. Lessons
      if (Array.isArray(data.completed_lessons)) {
        data.completed_lessons.forEach((clsId: number) => {
          localStorage.setItem(key(`lesson_${clsId}`, userId), 'true');
        });
      }

      // 2. Quizzes
      if (data.quizzes && typeof data.quizzes === 'object') {
        Object.entries(data.quizzes).forEach(([clsId, quizData]) => {
          const k = key(`quiz_${clsId}`, userId);
          const existingLocal = localStorage.getItem(k);
          let merged: any = quizData;
          if (existingLocal) {
            try {
              const parsed = JSON.parse(existingLocal);
              if (parsed && typeof parsed === 'object') {
                merged = { ...parsed, ...(quizData as object) };
              }
            } catch {
              // ignore
            }
          }
          localStorage.setItem(k, JSON.stringify(merged));
        });
      }

      // 3. Last Visited
      if (data.last_visited) {
        localStorage.setItem(lastVisitedKey(userId), JSON.stringify(data.last_visited));
      }

      // 4. Projects
      if (Array.isArray(data.projects)) {
        data.projects.forEach((slug: string) => {
          localStorage.setItem(key(`project_${slug}_started`, userId), 'true');
        });
      }

      // 5. Activity Log
      if (Array.isArray(data.recent_activity) && data.recent_activity.length > 0) {
        localStorage.setItem(activityKey(userId), JSON.stringify(data.recent_activity));
      }
    } catch (err) {
      console.warn('[NeonDB Sync] Could not hydrate progress from backend:', err);
    }
  },

  // Lessons
  markLessonComplete(classId: number, classTitle: string, userId?: string) {
    const uid = userId || getCurrentUserId();
    localStorage.setItem(key(`lesson_${classId}`, uid), 'true');
    appendActivity({
      type: 'lesson_complete',
      label: `Completed: ${classTitle}`,
      classId,
      timestamp: new Date().toISOString(),
    }, uid);

    postToBackend('/storage/progress/lesson', {
      user_id: uid,
      class_id: classId,
      completed: true,
      class_title: classTitle,
    });
  },

  isLessonComplete(classId: number, userId?: string): boolean {
    const uid = userId || getCurrentUserId();
    return localStorage.getItem(key(`lesson_${classId}`, uid)) === 'true';
  },

  // Quizzes
  saveQuizResult(
    classId: number,
    score: number,
    total: number,
    classTitle: string,
    userAnswers?: Record<string, number>,
    userId?: string
  ) {
    const uid = userId || getCurrentUserId();
    const result: QuizResult = {
      score,
      total,
      completedAt: new Date().toISOString(),
      userAnswers,
    };
    localStorage.setItem(key(`quiz_${classId}`, uid), JSON.stringify(result));
    appendActivity({
      type: 'quiz_complete',
      label: `Knowledge Check: ${classTitle} — ${score}/${total}`,
      classId,
      timestamp: new Date().toISOString(),
    }, uid);

    postToBackend('/storage/progress/quiz', {
      user_id: uid,
      class_id: classId,
      score,
      total,
      class_title: classTitle,
    });
  },

  getQuizResult(classId: number, userId?: string): QuizResult | null {
    try {
      const uid = userId || getCurrentUserId();
      const raw = localStorage.getItem(key(`quiz_${classId}`, uid));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // Course progress
  getCourseProgress(totalClasses: number, userId?: string): { completed: number; total: number; percent: number } {
    let completed = 0;
    for (let i = 1; i <= totalClasses; i++) {
      if (this.isClassCompleted(i, userId)) completed++;
    }
    return {
      completed,
      total: totalClasses,
      percent: totalClasses > 0 ? Math.round((completed / totalClasses) * 100) : 0,
    };
  },

  isClassCompleted(classId: number, userId?: string): boolean {
    const uid = userId || getCurrentUserId();
    return localStorage.getItem(key(`lesson_${classId}`, uid)) === 'true' || Boolean(this.getQuizResult(classId, uid));
  },

  getWeekProgress(weekClasses: number[], userId?: string): number {
    if (!weekClasses || weekClasses.length === 0) return 0;
    const done = weekClasses.filter(id => this.isClassCompleted(id, userId)).length;
    return Math.round((done / weekClasses.length) * 100);
  },

  isWeekCompleted(weekClasses: number[], userId?: string): boolean {
    if (!weekClasses || weekClasses.length === 0) return false;
    return weekClasses.every(id => this.isClassCompleted(id, userId));
  },

  isWeekUnlocked(weekNumber: number, weeks?: Array<{ n: number; classes: number[] }>, userId?: string): boolean {
    if (weekNumber <= 1) return true;
    const weekList = weeks && weeks.length > 0 ? weeks : DEFAULT_WEEKS;
    const targetIdx = weekList.findIndex(w => w.n === weekNumber);
    if (targetIdx <= 0) return true;

    // Prerequisite: All prior weeks (1 to targetIdx - 1) must be completed
    for (let i = 0; i < targetIdx; i++) {
      if (!this.isWeekCompleted(weekList[i].classes, userId)) {
        return false;
      }
    }
    return true;
  },

  isClassUnlocked(classId: number, weeks?: Array<{ n: number; classes: number[] }>, userId?: string): boolean {
    const weekList = weeks && weeks.length > 0 ? weeks : DEFAULT_WEEKS;
    const parentWeek = weekList.find(w => w.classes.includes(classId));
    if (!parentWeek) return true;
    return this.isWeekUnlocked(parentWeek.n, weekList, userId);
  },

  getParentWeek(classId: number, weeks?: Array<{ n: number; title?: string; classes: number[] }>) {
    const weekList = weeks && weeks.length > 0 ? weeks : DEFAULT_WEEKS;
    return weekList.find(w => w.classes.includes(classId)) || null;
  },

  // Last visited
  setLastVisited(classId: number, classTitle: string, userId?: string) {
    const uid = userId || getCurrentUserId();
    const data: LastVisited = { classId, classTitle, timestamp: new Date().toISOString() };
    localStorage.setItem(lastVisitedKey(uid), JSON.stringify(data));
    appendActivity({
      type: 'lesson_start',
      label: `Opened: ${classTitle}`,
      classId,
      timestamp: new Date().toISOString(),
    }, uid);

    postToBackend('/storage/progress/last-visited', {
      user_id: uid,
      class_id: classId,
      class_title: classTitle,
    });
  },

  getLastVisited(userId?: string): LastVisited | null {
    try {
      const uid = userId || getCurrentUserId();
      const raw = localStorage.getItem(lastVisitedKey(uid));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // Activity
  getRecentActivity(userId?: string): ActivityItem[] {
    return readActivity(userId).slice(0, 10);
  },

  // Projects
  markProjectStarted(slug: string, title: string, userId?: string) {
    const uid = userId || getCurrentUserId();
    localStorage.setItem(key(`project_${slug}_started`, uid), 'true');
    appendActivity({
      type: 'project_start',
      label: `Started project: ${title}`,
      timestamp: new Date().toISOString(),
    }, uid);

    postToBackend('/storage/progress/project', {
      user_id: uid,
      slug,
      title,
    });
  },

  isProjectStarted(slug: string, userId?: string): boolean {
    const uid = userId || getCurrentUserId();
    return localStorage.getItem(key(`project_${slug}_started`, uid)) === 'true';
  },
};
