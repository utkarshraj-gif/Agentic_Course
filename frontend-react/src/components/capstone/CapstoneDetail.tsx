// components/capstone/CapstoneDetail.tsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Code, Copy, ChevronLeft, CheckCircle, Tag } from 'lucide-react';
import { ProgressService } from '../../services/progress/ProgressService';
import { renderMermaidDiagrams } from '../../utils/mermaidRenderer';

const API_BASE = 'http://127.0.0.1:8000/api';

interface CodeFile {
  name: string;
  lang: string;
  code: string;
}

interface CapstoneDetailData {
  slug: string;
  title: string;
  short: string;
  domain: string;
  pattern: string;
  metric: string;
  html: string;
  files: CodeFile[];
  toc: string[];
  folder: string;
  diagrams?: string[];
}

export function CapstoneDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CapstoneDetailData | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setData(null);
    fetch(`${API_BASE}/capstones/${slug}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        if (slug) ProgressService.markProjectStarted(slug, d.title);
        window.dispatchEvent(new Event('progress_updated'));
      })
      .catch(console.error);
  }, [slug]);

  // Render mermaid architecture and workflow diagrams when data changes
  useEffect(() => {
    if (data && data.diagrams && data.diagrams.length > 0 && articleRef.current) {
      const timer = setTimeout(() => {
        renderMermaidDiagrams(articleRef.current, data.diagrams);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data) {
    return <div className="lesson-loading"><div className="lesson-loading-inner">Loading project...</div></div>;
  }

  return (
    <div className="lesson-page">
      {/* Topbar */}
      <div className="lesson-topbar">
        <nav className="lesson-breadcrumb" aria-label="Breadcrumb">
          <Link to="/dashboard">Overview</Link>
          <span aria-hidden="true">/</span>
          <Link to="/projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{data.short}</span>
        </nav>
        <button
          className="lesson-ctrl-btn"
          onClick={() => navigate('/projects')}
          aria-label="Back to projects"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Header */}
      <div className="lesson-header">
        <div className="lesson-header-inner">
          <div className="lesson-header-meta">
            <span className="lesson-tag"><Tag size={12} /> {data.domain}</span>
          </div>
          <h1 className="lesson-title">{data.title}</h1>
          <div className="lesson-capstone-meta">
            <div><strong>Pattern:</strong> {data.pattern}</div>
            <div><strong>Success metric:</strong> {data.metric}</div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="lesson-body">
        {/* TOC */}
        {data.toc && data.toc.length > 0 && (
          <aside className="lesson-toc" aria-label="Project contents">
            <div className="lesson-toc-title">On this page</div>
            <nav>
              {data.toc.map((item, i) => (
                <a key={i} href={`#section-${i}`} className="lesson-toc-item">
                  {item.replace(/^#+\s*/, '')}
                </a>
              ))}
            </nav>
          </aside>
        )}

        <article ref={articleRef} className="lesson-content">
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: data.html }}
          />

          {/* Code viewer */}
          {data.files && data.files.length > 0 && (
            <div className="code-viewer">
              <div className="code-viewer-tabs">
                {data.files.map((f, i) => (
                  <button
                    key={i}
                    className={`code-tab ${activeTab === i ? 'code-tab--active' : ''}`}
                    onClick={() => setActiveTab(i)}
                  >
                    <Code size={13} />
                    {f.name}
                  </button>
                ))}
              </div>
              <div className="code-viewer-body">
                <button
                  className="code-copy-btn"
                  onClick={() => handleCopy(data.files[activeTab].code)}
                  aria-label="Copy code"
                >
                  <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
                </button>
                <pre className="code-block">
                  <code>{data.files[activeTab].code}</code>
                </pre>
              </div>
            </div>
          )}

          {/* Project started confirmation */}
          <div className="lesson-footer lesson-footer--project">
            <div className="lesson-footer-done">
              <CheckCircle size={20} />
              <div>
                <strong>Project tracked</strong>
                <p>This project is now in your progress tracker.</p>
              </div>
              <Link to="/projects" className="btn btn--outline">
                Back to Projects
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
