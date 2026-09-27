// data/courses.ts
// Central registry for enrolled courses in Velloe Learns

export interface Course {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  level: string;
  icon: string;
  description: string;
  short_description?: string;
  enrolled: boolean;
  bannerImage?: string;
  totalWeeks?: number;
  totalClasses?: number;
}

export const ENROLLED_COURSES: Course[] = [
  {
    id: 'enterprise-ai',
    slug: 'enterprise-ai',
    title: 'Enterprise AI Agent Course',
    shortTitle: 'Enterprise AI',
    category: 'Production AI',
    level: 'Advanced',
    icon: '🤖',
    description: 'Master production-grade Agentic AI engineering — LangGraph, DSPy, RAG, multi-agent systems, and enterprise AIOps.',
    enrolled: true,
    bannerImage: '/Agentic_Banner.png',
    totalWeeks: 4,
    totalClasses: 15,
  },
];

export function getEnrolledCourses(): Course[] {
  return ENROLLED_COURSES;
}

export function getCourseBySlug(slug?: string): Course {
  if (!slug) return ENROLLED_COURSES[0];
  const found = ENROLLED_COURSES.find(c => c.slug === slug || c.id === slug);
  return found || ENROLLED_COURSES[0];
}
