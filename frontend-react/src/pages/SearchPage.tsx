// pages/SearchPage.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight, BookOpen } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

interface ClassModule {
  id: number;
  week: number;
  short: string;
  title: string;
  description: string;
  topics: string[];
}

interface SearchResult {
  type: 'class';
  id: number;
  title: string;
  subtitle: string;
  path: string;
  matchedOn: string;
}

function searchClasses(classes: ClassModule[], query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const cls of classes) {
    const matchTitle = cls.short.toLowerCase().includes(q) || cls.title.toLowerCase().includes(q);
    const matchDesc = cls.description?.toLowerCase().includes(q);
    const matchTopic = cls.topics?.some(t => t.toLowerCase().includes(q));

    if (matchTitle || matchDesc || matchTopic) {
      let matchedOn = 'title';
      if (!matchTitle && matchDesc) matchedOn = 'description';
      if (!matchTitle && !matchDesc && matchTopic) {
        const topic = cls.topics.find(t => t.toLowerCase().includes(q));
        matchedOn = `topic: ${topic}`;
      }

      results.push({
        type: 'class',
        id: cls.id,
        title: cls.short,
        subtitle: `Week ${cls.week} · ${cls.description?.slice(0, 100) ?? ''}`,
        path: `/class/${cls.id}`,
        matchedOn,
      });
    }
  }
  return results;
}

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [allClasses, setAllClasses] = useState<ClassModule[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/curriculum/list`)
      .then(r => r.json())
      .then(setAllClasses)
      .catch(console.error);
  }, []);

  useEffect(() => {
    setResults(searchClasses(allClasses, query));
  }, [query, allClasses]);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Search</h1>
        <p className="page-subtitle">Search across classes, topics, tools, and concepts.</p>
      </div>

      <div className="search-box-wrap">
        <div className="search-box">
          <Search size={18} className="search-box-icon" />
          <input
            type="search"
            className="search-box-input"
            placeholder="Try: LangGraph, RAG, evaluation, MCP..."
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
            {['LangGraph', 'RAG', 'Evaluation', 'Memory', 'Guardrails', 'MCP', 'vLLM', 'A2A'].map(s => (
              <button key={s} className="search-chip" onClick={() => setQuery(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {query.trim() !== '' && (
        <div className="search-results">
          {results.length === 0 ? (
            <div className="search-empty">
              <p>No results for <strong>"{query}"</strong>.</p>
              <p>Try a different keyword — class title, tool name, or concept.</p>
            </div>
          ) : (
            <>
              <p className="search-results-count">{results.length} result{results.length !== 1 ? 's' : ''} for "<strong>{query}</strong>"</p>
              <div className="search-result-list">
                {results.map(r => (
                  <Link key={r.id} to={r.path} className="search-result-item">
                    <div className="search-result-icon"><BookOpen size={16} /></div>
                    <div className="search-result-body">
                      <div className="search-result-title">{r.title}</div>
                      <div className="search-result-sub">{r.subtitle}</div>
                      <div className="search-result-match">Matched on {r.matchedOn}</div>
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
