import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './services/auth/AuthContext';
import { DiagramZoomModal } from './components/common/DiagramZoomModal';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CurriculumPage } from './pages/CurriculumPage';
import { PracticePage } from './pages/PracticePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SkillMapPage } from './pages/SkillMapPage';
import { SearchPage } from './pages/SearchPage';
import { AppLayout } from './components/layout/AppLayout';
import { ClassDetail } from './components/lesson/ClassDetail';
import { CapstoneDetail } from './components/capstone/CapstoneDetail';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NotFoundPage } from './pages/NotFoundPage';

// Admin imports (isolated access via /admin/*)
import { AdminAuthGuard } from './components/admin/AdminAuthGuard';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLearnersPage } from './pages/admin/AdminLearnersPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminActivityPage } from './pages/admin/AdminActivityPage';
import { AdminSandboxTelemetryPage } from './pages/admin/AdminSandboxTelemetryPage';
import { AdminLearnerDetailPage } from './pages/admin/AdminLearnerDetailPage';
import { AdminCoursesPage } from './pages/admin/AdminCoursesPage';
import { AdminCourseBuilderPage } from './pages/admin/AdminCourseBuilderPage';
import { AdminCohortsPage } from './pages/admin/AdminCohortsPage';
import { AdminCohortDetailPage } from './pages/admin/AdminCohortDetailPage';
import { AdminAuditLogPage } from './pages/admin/AdminAuditLogPage';

function PageTitleManager() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = 'Velloe Learns';

    if (path === '/') {
      title = 'Velloe Learns | Master Enterprise AI Agents';
    } else if (path === '/login') {
      title = 'Sign In | Velloe Learns';
    } else if (path === '/admin/login') {
      title = 'Admin Authentication | Velloe Ops';
    } else if (path.startsWith('/admin')) {
      title = 'Command Center | Velloe Ops';
    } else if (path === '/dashboard' || path === '/overview') {
      title = 'Overview | Velloe Learns';
    } else if (path === '/curriculum') {
      title = 'Courses | Velloe Learns';
    } else if (path.startsWith('/curriculum/')) {
      title = 'Enterprise AI Agent Course | Velloe Learns';
    } else if (path.startsWith('/class/')) {
      const id = path.split('/')[2];
      title = `Class ${id} | Velloe Learns`;
    } else if (path === '/practice') {
      title = 'Practice & Labs | Velloe Learns';
    } else if (path === '/projects') {
      title = 'Capstone Projects | Velloe Learns';
    } else if (path.startsWith('/capstones/')) {
      const slug = path.split('/')[2];
      title = `${slug.toUpperCase()} Capstone | Velloe Learns`;
    } else if (path === '/skills') {
      title = 'Skill Map | Velloe Learns';
    } else if (path === '/search') {
      title = 'Search | Velloe Learns';
    }

    document.title = title;
  }, [location]);

  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="app-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  const [zoomDiagram, setZoomDiagram] = useState<{ svgContent: string; title?: string } | null>(null);

  useEffect(() => {
    const handleOpenZoom = (e: Event) => {
      const customEvent = e as CustomEvent<{ svgContent: string; title?: string }>;
      if (customEvent.detail && customEvent.detail.svgContent) {
        setZoomDiagram({
          svgContent: customEvent.detail.svgContent,
          title: customEvent.detail.title,
        });
      }
    };

    window.addEventListener('open_diagram_zoom', handleOpenZoom);
    return () => window.removeEventListener('open_diagram_zoom', handleOpenZoom);
  }, []);

  return (
    <ErrorBoundary>
      <PageTitleManager />
      {zoomDiagram && (
        <DiagramZoomModal
          svgContent={zoomDiagram.svgContent}
          title={zoomDiagram.title}
          onClose={() => setZoomDiagram(null)}
        />
      )}
      <Routes>
        {/* Public learner routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Dedicated Admin Portal - accessible ONLY via /admin/login */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Protected Admin Experience - accessible ONLY via /admin/* */}
        <Route
          path="/admin"
          element={
            <AdminAuthGuard>
              <AdminLayout />
            </AdminAuthGuard>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="courses" element={<AdminCoursesPage />} />
          <Route path="courses/new" element={<AdminCourseBuilderPage />} />
          <Route path="courses/:courseId" element={<AdminCourseBuilderPage />} />
          <Route path="cohorts" element={<AdminCohortsPage />} />
          <Route path="cohorts/:cohortId" element={<AdminCohortDetailPage />} />
          <Route path="learners" element={<AdminLearnersPage />} />
          <Route path="learners/:userId" element={<AdminLearnerDetailPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="sandboxes" element={<AdminSandboxTelemetryPage />} />
          <Route path="audit-log" element={<AdminAuditLogPage />} />
          <Route path="activity" element={<AdminActivityPage />} />
          <Route path="*" element={<NotFoundPage isAdmin />} />
        </Route>

        {/* Protected learner academy routes */}
        <Route
          path="/"
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="overview" element={<DashboardPage />} />
          <Route path="curriculum" element={<CurriculumPage />} />
          <Route path="curriculum/:courseSlug" element={<CurriculumPage />} />
          <Route path="class/:id" element={<ClassDetail />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="capstones/:slug" element={<CapstoneDetail />} />
          <Route path="skills" element={<SkillMapPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
