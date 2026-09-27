// services/adminCourseApi.ts
// API client for Course Management, Course Builder, and dynamic Learner Catalog

import { API_BASE } from './api';

export interface AdminCourseListItem {
  id: string;
  slug: string;
  title: string;
  short_title?: string;
  category: string;
  level: string;
  icon?: string;
  banner_image?: string;
  short_description?: string;
  description: string;
  estimated_duration?: string;
  estimated_hours?: number;
  status: 'draft' | 'published' | 'archived';
  tags?: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  modules_count: number;
  classes_count: number;
  enrolled_count: number;
}

export interface AdminClassItem {
  id: string;
  course_id: string;
  module_id: string;
  class_number: number;
  slug?: string;
  title: string;
  short_title?: string;
  description?: string;
  duration?: string;
  position: number;
  lesson_content?: string;
  topics?: string[];
  learning_objectives?: string[];
  diagrams?: string[];
  code_examples?: { name: string; lang: string; code: string; runnable?: boolean }[];
  quiz?: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
  skills?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface AdminModuleItem {
  id: string;
  course_id: string;
  module_number: number;
  title: string;
  description?: string;
  tools?: string[];
  position: number;
  created_at?: string;
  classes: AdminClassItem[];
}

export interface AdminCourseDetail extends AdminCourseListItem {
  modules: AdminModuleItem[];
}

export interface CourseValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export const adminCourseApi = {
  async listCourses(includeDrafts = true): Promise<AdminCourseListItem[]> {
    const res = await fetch(`${API_BASE}/admin/courses?include_drafts=${includeDrafts}&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store' }
    });
    if (!res.ok) throw new Error(`Failed to fetch courses: ${res.statusText}`);
    const json = await res.json();
    return json.data || [];
  },

  async getCourse(courseId: string): Promise<AdminCourseDetail> {
    const res = await fetch(`${API_BASE}/admin/courses/${courseId}`);
    if (!res.ok) throw new Error(`Failed to fetch course detail: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },

  async createCourse(data: Partial<AdminCourseListItem>): Promise<AdminCourseDetail> {
    const res = await fetch(`${API_BASE}/admin/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create course');
    }
    const json = await res.json();
    return json.data;
  },

  async updateCourse(courseId: string, data: Partial<AdminCourseListItem>): Promise<AdminCourseDetail> {
    const res = await fetch(`${API_BASE}/admin/courses/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update course');
    }
    const json = await res.json();
    return json.data;
  },

  async deleteCourse(courseId: string, archiveOnly = true): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/courses/${courseId}?archive_only=${archiveOnly}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete/archive course');
    return res.json();
  },

  async duplicateCourse(courseId: string): Promise<AdminCourseDetail> {
    const res = await fetch(`${API_BASE}/admin/courses/${courseId}/duplicate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to duplicate course');
    const json = await res.json();
    return json.data;
  },

  async validateCourse(courseId: string): Promise<CourseValidationResult> {
    const res = await fetch(`${API_BASE}/admin/courses/${courseId}/validate`);
    if (!res.ok) throw new Error('Failed to validate course');
    const json = await res.json();
    return json.data;
  },

  async publishCourse(courseId: string): Promise<{ success: boolean; message: string; course?: AdminCourseDetail }> {
    const res = await fetch(`${API_BASE}/admin/courses/${courseId}/publish`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const details = err.detail?.errors?.join(', ') || err.detail?.message || 'Publish validation failed.';
      throw new Error(details);
    }
    return res.json();
  },

  async unpublishCourse(courseId: string): Promise<{ success: boolean; message: string; course?: AdminCourseDetail }> {
    const res = await fetch(`${API_BASE}/admin/courses/${courseId}/unpublish`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to unpublish course');
    return res.json();
  },

  // Modules
  async addModule(courseId: string, data: { title: string; description?: string; tools?: string[]; module_number?: number; position?: number }): Promise<AdminCourseDetail> {
    const res = await fetch(`${API_BASE}/admin/courses/${courseId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add module');
    const json = await res.json();
    return json.data;
  },

  async updateModule(moduleId: string, data: { title?: string; description?: string; tools?: string[] }): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/courses/modules/${moduleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update module');
  },

  async deleteModule(moduleId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/courses/modules/${moduleId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete module');
  },

  // Classes
  async addClass(moduleId: string, data: Partial<AdminClassItem>): Promise<AdminCourseDetail> {
    const res = await fetch(`${API_BASE}/admin/courses/modules/${moduleId}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add class');
    const json = await res.json();
    return json.data;
  },

  async updateClass(classId: string, data: Partial<AdminClassItem>): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/courses/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update class');
  },

  async deleteClass(classId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/courses/classes/${classId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete class');
  },

  // Learner dynamic courses
  async getLearnerCourses() {
    const res = await fetch(`${API_BASE}/curriculum/courses?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store' }
    });
    if (!res.ok) throw new Error('Failed to fetch learner courses');
    const json = await res.json();
    return json.data || [];
  },

  async getCourseOverview(slugOrId: string) {
    const res = await fetch(`${API_BASE}/curriculum/courses/${slugOrId}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store' }
    });
    if (!res.ok) throw new Error(`Failed to load course overview: ${slugOrId}`);
    return res.json();
  }
};
