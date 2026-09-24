// pages/ProjectsPage.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Stethoscope, Scale, Server, Package } from 'lucide-react';
import { ProgressService } from '../services/progress/ProgressService';

const API_BASE = 'http://127.0.0.1:8000/api';

interface CapstoneInfo {
  id: string;
  slug: string;
  title: string;
  short: string;
  domain: string;
  pattern: string;
  metric: string;
  description: string;
  architecture: string[];
}

const DOMAIN_ICONS: Record<string, React.ComponentType<{ size: number }>> = {
  Healthcare: Stethoscope,
  Legal: Scale,
  AIOps: Server,
  Operations: Package,
};

const SKILLS_MAP: Record<string, string[]> = {
  clinical_prior_auth: ['LangGraph', 'RAG', 'Human-in-the-Loop', 'FHIR', 'Guardrails'],
  legal_contract_review: ['LangGraph', 'RAG', 'Map-Reduce', 'LangSmith', 'Chroma'],
  aiops_agents: ['LangGraph', 'Tool Engineering', 'MCP', 'OpenTelemetry', 'A2A'],
  inventory_planner: ['LangGraph', 'Multi-Agent', 'A2A Protocol', 'Docker', 'Azure'],
};

export function ProjectsPage() {
  const [capstones, setCapstones] = useState<CapstoneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/capstones`)
      .then(r => r.json())
      .then(data => {
        setCapstones(data.capstones ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('progress_updated', handler);
    return () => window.removeEventListener('progress_updated', handler);
  }, []);

  void refreshKey;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Capstone Projects</h1>
          <p className="page-subtitle">Production-grade AI systems you'll build as part of the program.</p>
        </div>
      </div>

      {loading && <div className="loading-state">Loading projects...</div>}

      <div className="projects-grid">
        {capstones.map(cap => {
          const started = ProgressService.isProjectStarted(cap.slug);
          const skills = SKILLS_MAP[cap.slug] ?? [];
          const DomainIcon = DOMAIN_ICONS[cap.domain] ?? Package;

          return (
            <div key={cap.slug} className="project-card">
              <div className="project-card-header">
                <div className="project-domain-icon">
                  <DomainIcon size={18} />
                </div>
                <div>
                  <span className="project-domain-tag">{cap.domain}</span>
                  {started && (
                    <span className="project-started-badge">
                      <CheckCircle size={12} /> Started
                    </span>
                  )}
                </div>
              </div>

              <h2 className="project-title">{cap.title}</h2>
              <p className="project-desc">{cap.description}</p>

              <div className="project-meta">
                <div className="project-meta-item">
                  <span className="project-meta-label">Pattern</span>
                  <span className="project-meta-value">{cap.pattern}</span>
                </div>
                <div className="project-meta-item">
                  <span className="project-meta-label">Success metric</span>
                  <span className="project-meta-value">{cap.metric}</span>
                </div>
              </div>

              {skills.length > 0 && (
                <div className="project-skills">
                  <div className="project-skills-label">Skills applied</div>
                  <div className="project-tools">
                    {skills.map(s => <span key={s} className="tool-badge">{s}</span>)}
                  </div>
                </div>
              )}

              {cap.architecture && cap.architecture.length > 0 && (
                <div className="project-arch">
                  <div className="project-arch-label">Architecture</div>
                  <ol className="project-arch-list">
                    {cap.architecture.slice(0, 3).map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                    {cap.architecture.length > 3 && (
                      <li className="project-arch-more">+{cap.architecture.length - 3} more steps</li>
                    )}
                  </ol>
                </div>
              )}

              <Link
                to={`/capstones/${cap.slug}`}
                className="btn btn--outline project-cta"
                onClick={() => ProgressService.markProjectStarted(cap.slug, cap.title)}
              >
                {started ? 'Continue Project' : 'Explore Project'}
                <ArrowRight size={14} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
