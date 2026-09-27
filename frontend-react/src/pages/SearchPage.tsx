// pages/SearchPage.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight, BookOpen, Layers, Map, GraduationCap } from 'lucide-react';
import { API_BASE } from '../services/api';
import { ENROLLED_COURSES } from '../data';

interface ClassModule {
  id: number;
  week: number;
  short: string;
  title: string;
  description: string;
  topics: string[];
}

interface SearchResult {
  type: 'course' | 'class' | 'capstone' | 'skill';
  id: string | number;
  title: string;
  subtitle: string;
  path: string;
  matchedOn: string;
}

const STATIC_CAPSTONES = [
  { slug: 'aiops_agents', title: 'Autonomous AIOps Incident Responder', desc: 'Real-time telemetry triage, root-cause diagnosis, and automated mitigation with LangGraph & MCP.' },
  { slug: 'clinical_prior_auth', title: 'Clinical Prior Authorization Engine', desc: 'HIPAA-aware policy document RAG, clinical data extraction, and justification generator.' },
  { slug: 'inventory_planner', title: 'Supply Chain & Inventory Planner', desc: 'Multi-agent demand forecasting, ERP integration, and automated purchase requisition.' },
  { slug: 'legal_contract_review', title: 'Legal Contract Review & Risk Analyzer', desc: 'Multi-clause redlining, regulatory compliance validation, and executive risk scoring.' },
];

const STATIC_SKILLS = [
  { name: 'Foundations & Agent Design', desc: 'Core agent concepts, prompt engineering, system design' },
  { name: 'Retrieval & RAG', desc: 'Embeddings, vector search, hybrid retrieval, RAG pipelines' },
  { name: 'Tool Engineering', desc: 'Function calling, MCP, external integrations' },
  { name: 'Memory & State', desc: 'In-context, external, and semantic memory; LangGraph state' },
  { name: 'Evaluation', desc: 'LangSmith, Opik, LLM-as-Judge, error analysis' },
  { name: 'Agentic RAG & Performance', desc: 'Agentic retrieval loops, fine-tuning, inference optimization' },
  { name: 'Production & Observability', desc: 'OpenTelemetry, guardrails, observability pipelines' },
  { name: 'Multi-Agent Systems', desc: 'A2A protocol, coordination, deployment' },
  { name: 'AI Security & Red Teaming', desc: 'Prompt injection defense, jailbreak mitigation, security audits' },
  { name: 'Model Economics & Deployment', desc: 'Open-source vs proprietary tradeoffs, vLLM cost modeling, HITL production systems' },
];

function runUnifiedSearch(classes: ClassModule[], query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  // 1. Search Courses
  for (const course of ENROLLED_COURSES) {
    if (course.title.toLowerCase().includes(q) || course.description.toLowerCase().includes(q) || course.category.toLowerCase().includes(q)) {
      results.push({
        type: 'course',
        id: `course-${course.id}`,
        title: course.title,
        subtitle: `${course.category} · ${course.description.slice(0, 95)}...`,
        path: `/curriculum/${course.slug}`,
        matchedOn: 'Course Program',
      });
    }
  }

  // 2. Search Classes
  for (const cls of classes) {
    const matchTitle = cls.short.toLowerCase().includes(q) || cls.title.toLowerCase().includes(q);
    const matchDesc = cls.description?.toLowerCase().includes(q);
    const matchTopic = cls.topics?.some(t => t.toLowerCase().includes(q));

    if (matchTitle || matchDesc || matchTopic) {
      let matchedOn = 'Class Title';
      if (!matchTitle && matchDesc) matchedOn = 'Description';
      if (!matchTitle && !matchDesc && matchTopic) {
        const topic = cls.topics.find(t => t.toLowerCase().includes(q));
        matchedOn = `Topic: ${topic}`;
      }

      results.push({
        type: 'class',
        id: `class-${cls.id}`,
        title: cls.id === 0 ? cls.short : `Class ${cls.id}: ${cls.short}`,
        subtitle: cls.week === 0 ? `Prerequisites · ${cls.description?.slice(0, 95) ?? ''}...` : `Week ${cls.week} · ${cls.description?.slice(0, 95) ?? ''}...`,
        path: `/class/${cls.id}`,
        matchedOn,
      });
    }
  }

  // 3. Search Capstones
  for (const cap of STATIC_CAPSTONES) {
    if (cap.title.toLowerCase().includes(q) || cap.desc.toLowerCase().includes(q)) {
      results.push({
        type: 'capstone',
        id: `capstone-${cap.slug}`,
        title: cap.title,
        subtitle: `Capstone Project · ${cap.desc.slice(0, 95)}...`,
        path: `/capstones/${cap.slug}`,
        matchedOn: 'Capstone Project',
      });
    }
  }

  // 4. Search Skills
  for (const skill of STATIC_SKILLS) {
    if (skill.name.toLowerCase().includes(q) || skill.desc.toLowerCase().includes(q)) {
      results.push({
        type: 'skill',
        id: `skill-${skill.name}`,
        title: skill.name,
        subtitle: `Competency Area · ${skill.desc}`,
        path: '/skills',
        matchedOn: 'Skill Competency',
      });
    }
  }

  return results;
}

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [allClasses, setAllClasses] = useState<ClassModule[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/curriculum/list`)
      .then(r => r.json())
      .then(data => {
        setAllClasses(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Could not fetch classes for search:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setResults(runUnifiedSearch(allClasses, query));
  }, [query, allClasses]);

  const renderIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'course': return <GraduationCap size={16} color="var(--primary)" />;
      case 'class': return <BookOpen size={16} color="var(--text-muted)" />;
      case 'capstone': return <Layers size={16} color="#8B5CF6" />;
      case 'skill': return <Map size={16} color="#10B981" />;
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Search</h1>
        <p className="page-subtitle">Search across programs, classes, topics, capstones, and competency skills.</p>
      </div>

      <div className="search-box-wrap">
        <div className="search-box">
          <Search size={18} className="search-box-icon" />
          <input
            type="search"
            className="search-box-input"
            placeholder="Try: LangGraph, RAG, DSPy, AIOps, Guardrails, Evaluation..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {query.trim() === '' && (
        <div className="search-suggestions">
          <p className="search-suggestions-label">Suggested searches</p>
          <div className="search-chips">
            {['LangGraph', 'RAG', 'DSPy', 'Evaluation', 'Memory', 'Guardrails', 'MCP', 'AIOps', 'HITL'].map(s => (
              <button key={s} className="search-chip" onClick={() => setQuery(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {query.trim() !== '' && (
        <div className="search-results">
          {loading ? (
            <div className="loading-state">Searching catalog...</div>
          ) : results.length === 0 ? (
            <div className="search-empty">
              <p>No results found for <strong>"{query}"</strong>.</p>
              <p>Try searching for a tool (e.g. LangGraph, FAISS), concept (e.g. RAG, Eval), or capstone domain.</p>
            </div>
          ) : (
            <>
              <p className="search-results-count">{results.length} result{results.length !== 1 ? 's' : ''} for "<strong>{query}</strong>"</p>
              <div className="search-result-list">
                {results.map(r => (
                  <Link key={r.id} to={r.path} className="search-result-item">
                    <div className="search-result-icon">{renderIcon(r.type)}</div>
                    <div className="search-result-body">
                      <div className="search-result-title">{r.title}</div>
                      <div className="search-result-sub">{r.subtitle}</div>
                      <div className="search-result-match">{r.matchedOn}</div>
                    </div>
                    <ArrowRight size={14} className="search-result-arrow" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

