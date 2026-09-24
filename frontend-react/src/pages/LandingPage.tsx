// pages/LandingPage.tsx
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, FlaskConical, Layers, Award } from 'lucide-react';

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Structured Curriculum',
    desc: '12 classes across 7 weeks covering every layer of production Agentic AI — from foundations to multi-agent systems.',
  },
  {
    icon: FlaskConical,
    title: 'Hands-On Labs',
    desc: 'Build real agents against real use cases in healthcare, legal, and infrastructure operations.',
  },
  {
    icon: Layers,
    title: 'Capstone Projects',
    desc: 'Four production-grade projects: Clinical Prior-Auth, Legal Contract Review, AIOps, and Inventory Planner.',
  },
  {
    icon: Award,
    title: 'Skill Tracking',
    desc: 'Track your progress across eight skill areas. Resume exactly where you left off after every session.',
  },
];

const WEEKS = [
  { n: '01', title: 'Foundations of Agentic AI' },
  { n: '02', title: 'Retrieval & RAG' },
  { n: '03', title: 'Tools, Integrations & Memory' },
  { n: '04', title: 'Evaluation & Complex Workflows' },
  { n: '05', title: 'Agentic RAG & Performance' },
  { n: '06', title: 'Production & Multi-Agent Systems' },
  { n: '07', title: 'Enterprise Security & Advanced Deployment' },
];

const TOOLS = [
  'LangChain', 'LangGraph', 'OpenAI', 'FAISS', 'Chroma DB',
  'MCP', 'LangMem', 'Redis', 'LangSmith', 'Opik',
  'vLLM', 'NVIDIA NeMo', 'Docker', 'Azure', 'A2A Protocol',
];

export function LandingPage() {
  return (
    <div className="landing">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-logo">
            <img src="/logo.png" alt="Velloe Logo" className="landing-logo-img" />
            <span>VELLOE Agentic AI Academy</span>
          </div>
          <Link to="/login" className="landing-cta-sm">
            Sign in <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-label">Internal Learning Platform</div>
        <h1 className="landing-hero-title">
          Learn. Build. Deploy.
        </h1>
        <p className="landing-hero-subtitle">
          The VELLOE engineering program for building production-grade
          Agentic AI systems — structured, practical, and enterprise-ready.
        </p>
        <div className="landing-hero-actions">
          <Link to="/login" className="btn btn--primary btn--lg">
            Start Learning <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="btn btn--ghost btn--lg">
            Continue as Demo Learner
          </Link>
        </div>

        {/* Hero stats */}
        <div className="landing-hero-stats">
          {[
            { value: '7', label: 'Weeks' },
            { value: '12', label: 'Classes' },
            { value: '4', label: 'Capstone Projects' },
            { value: '15+', label: 'Tools & Frameworks' },
          ].map(s => (
            <div key={s.label} className="landing-stat">
              <span className="landing-stat-value">{s.value}</span>
              <span className="landing-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="landing-section landing-section--alt">
        <div className="landing-container">
          <h2 className="landing-section-title">Everything you need to build real AI agents</h2>
          <div className="landing-features">
            {FEATURES.map(f => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon">
                  <f.icon size={20} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Curriculum overview */}
      <section className="landing-section">
        <div className="landing-container">
          <h2 className="landing-section-title">Program curriculum</h2>
          <p className="landing-section-sub">
            A structured 7-week program built for engineers who need to deploy Agentic AI in production environments.
          </p>
          <div className="landing-weeks">
            {WEEKS.map((w, i) => (
              <div key={w.n} className="landing-week">
                <div className="landing-week-num">Week {w.n}</div>
                <div className="landing-week-title">{w.title}</div>
                {i < WEEKS.length - 1 && <div className="landing-week-connector" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="landing-section landing-section--alt">
        <div className="landing-container">
          <h2 className="landing-section-title">Frameworks & tools you'll use</h2>
          <div className="landing-tools">
            {TOOLS.map(t => (
              <span key={t} className="landing-tool-badge">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta-section">
        <div className="landing-container landing-cta-inner">
          <div>
            <h2>Ready to build production Agentic AI?</h2>
          </div>
          <Link to="/login" className="btn btn--primary btn--lg">
            Enter the Academy <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-brand">
            <img src="/logo.png" alt="Velloe Logo" className="landing-footer-logo-img" />
            <span>VELLOE Agentic AI Academy</span>
          </div>
          <div className="landing-footer-links">
            <span>Internal use only · VELLOE © 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
