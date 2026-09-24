import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, CheckCircle, Clock, ArrowRight, Code2, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { LabCompiler } from '../components/compiler/LabCompiler';

interface Lab {
  id: string;
  title: string;
  objective: string;
  whatYouBuild: string;
  prerequisites: string[];
  classId: number;
  estimatedTime: string;
  skills: string[];
}

const LABS: Lab[] = [
  {
    id: 'lab-01',
    title: 'Build Your First LangGraph Agent',
    objective: 'Create a stateful AI agent using LangGraph that can reason and take multi-step actions.',
    whatYouBuild: 'A working LangGraph agent with tool use and state management.',
    prerequisites: ['Python 3.10+', 'OpenAI API key'],
    classId: 1,
    estimatedTime: '30 min',
    skills: ['LangGraph', 'LangChain', 'OpenAI'],
  },
  {
    id: 'lab-02',
    title: 'Prompt Engineering with DSPy',
    objective: 'Use DSPy to automatically optimize prompts for a classification task.',
    whatYouBuild: 'An optimized prompt pipeline for legal clause triage.',
    prerequisites: ['Class 2 reading', 'OpenAI API key'],
    classId: 2,
    estimatedTime: '35 min',
    skills: ['DSPy', 'OpenAI', 'Prompt Engineering'],
  },
  {
    id: 'lab-03',
    title: 'Build a RAG Pipeline with FAISS',
    objective: 'Embed documents, store them in FAISS, and build a retrieval-augmented QA chain.',
    whatYouBuild: 'A working RAG pipeline for medical policy Q&A.',
    prerequisites: ['Class 3 reading', 'OpenAI API key'],
    classId: 3,
    estimatedTime: '45 min',
    skills: ['FAISS', 'OpenAI embeddings', 'RAG'],
  },
  {
    id: 'lab-04',
    title: 'Hybrid Search with Chroma + BM25',
    objective: 'Implement a hybrid retriever combining dense and sparse search.',
    whatYouBuild: 'A hybrid search system for legal contract retrieval.',
    prerequisites: ['Class 4 reading', 'Chroma installed'],
    classId: 4,
    estimatedTime: '40 min',
    skills: ['Chroma DB', 'FAISS', 'BM25'],
  },
  {
    id: 'lab-05',
    title: 'Connect External Tools to an Agent',
    objective: 'Use OpenAI function calling to equip an agent with real external tools.',
    whatYouBuild: 'An AIOps agent that calls real API tools to investigate incidents.',
    prerequisites: ['Class 5 reading', 'OpenAI API key'],
    classId: 5,
    estimatedTime: '50 min',
    skills: ['OpenAI functions', 'LangGraph', 'Tool Engineering'],
  },
  {
    id: 'lab-06',
    title: 'Persistent Memory with Redis + LangMem',
    objective: 'Add cross-session memory to an agent using LangMem backed by Redis.',
    whatYouBuild: 'A clinical documentation assistant with persistent patient context.',
    prerequisites: ['Class 6 reading', 'Redis running locally'],
    classId: 6,
    estimatedTime: '55 min',
    skills: ['MCP', 'LangMem', 'Redis', 'LangGraph'],
  },
  {
    id: 'lab-07',
    title: 'Evaluate an Agent with LangSmith',
    objective: 'Set up evaluation datasets and run automated evals using LangSmith.',
    whatYouBuild: 'A fully instrumented agent evaluation pipeline.',
    prerequisites: ['Class 7 reading', 'LangSmith API key'],
    classId: 7,
    estimatedTime: '45 min',
    skills: ['LangSmith', 'Opik', 'Evaluation'],
  },
  {
    id: 'lab-08',
    title: 'LLM-as-Judge for Contract QA',
    objective: 'Build an automated quality assessor using a judge LLM.',
    whatYouBuild: 'An error analysis pipeline for legal contract Q&A.',
    prerequisites: ['Class 8 reading', 'OpenAI API key'],
    classId: 8,
    estimatedTime: '40 min',
    skills: ['LangSmith', 'OpenAI', 'Error Analysis'],
  },
];

export function PracticePage() {
  const [filter, setFilter] = useState<'all' | 'not-started' | 'done'>('all');
  const [openCompilerId, setOpenCompilerId] = useState<string | null>(null);
  const [showScratchpad, setShowScratchpad] = useState<boolean>(false);

  // Track lab completions in localStorage
  const isLabDone = (id: string) => localStorage.getItem(`velloe_progress_lab_${id}`) === 'true';
  const markLabDone = (id: string) => {
    localStorage.setItem(`velloe_progress_lab_${id}`, 'true');
    window.dispatchEvent(new Event('progress_updated'));
    setFilter(f => f);
  };

  const toggleCompiler = (labId: string) => {
    setOpenCompilerId(prev => (prev === labId ? null : labId));
  };

  const filtered = LABS.filter(lab => {
    if (filter === 'done') return isLabDone(lab.id);
    if (filter === 'not-started') return !isLabDone(lab.id);
    return true;
  });

  const doneCount = LABS.filter(l => isLabDone(l.id)).length;

  return (
    <div className="page">
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Practice Labs & Interactive Compiler</h1>
          <p className="page-subtitle">
            Hands-on coding labs from the curriculum. Write, execute, and verify code with the built-in Python compiler. {doneCount} of {LABS.length} completed.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`btn btn--sm ${showScratchpad ? 'btn--primary' : 'btn--outline'}`}
            onClick={() => setShowScratchpad(prev => !prev)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={14} />
            {showScratchpad ? 'Hide Scratchpad' : 'Open Scratchpad'}
          </button>
          <div className="filter-tabs">
            {(['all', 'not-started', 'done'] as const).map(f => (
              <button
                key={f}
                className={`filter-tab ${filter === f ? 'filter-tab--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'done' ? 'Completed' : 'Not started'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showScratchpad && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ 
            background: 'var(--bg-white)', 
            border: '1px solid var(--border-strong)', 
            borderRadius: 'var(--radius-lg)', 
            padding: '1.25rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={16} color="var(--primary)" /> Python Lab Scratchpad
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Write any arbitrary Python snippet, test agent logic, or experiment with course concepts.
                </p>
              </div>
              <button 
                className="btn btn--ghost btn--sm"
                onClick={() => setShowScratchpad(false)}
              >
                Close
              </button>
            </div>
            <LabCompiler 
              labId="scratchpad" 
              labTitle="General Python Scratchpad" 
              defaultFilename="scratchpad.py"
              defaultCode={`# Agentic AI Python Playground\n# Test algorithms, prompt construction, and LangGraph mock loops\n\nimport math\nimport json\n\ndef calculate_token_cost(prompt_tokens: int, completion_tokens: int, model: str = "gpt-4o") -> dict:\n    costs = {\n        "gpt-4o": {"input": 5.00 / 1_000_000, "output": 15.00 / 1_000_000},\n        "gpt-4o-mini": {"input": 0.15 / 1_000_000, "output": 0.60 / 1_000_000}\n    }\n    rate = costs.get(model, costs["gpt-4o"])\n    cost = (prompt_tokens * rate["input"]) + (completion_tokens * rate["output"])\n    return {\n        "model": model,\n        "prompt_tokens": prompt_tokens,\n        "completion_tokens": completion_tokens,\n        "total_cost_usd": round(cost, 6)\n    }\n\n# Run test calculation\nresult = calculate_token_cost(1420, 310, "gpt-4o")\nprint("Token Cost Calculation Result:")\nprint(json.dumps(result, indent=2))\n`}
            />
          </div>
        </div>
      )}

      <div className="labs-list">
        {filtered.map(lab => {
          const done = isLabDone(lab.id);
          const isCompilerOpen = openCompilerId === lab.id;

          return (
            <div key={lab.id} className={`lab-card ${done ? 'lab-card--done' : ''}`}>
              <div className="lab-card-header">
                <div className="lab-icon">
                  {done ? <CheckCircle size={18} color="#10B981" /> : <FlaskConical size={18} />}
                </div>
                <div className="lab-card-meta">
                  <span className="lab-class-tag">Class {lab.classId}</span>
                  <span className="lab-time"><Clock size={12} /> {lab.estimatedTime}</span>
                </div>
              </div>

              <h2 className="lab-title">{lab.title}</h2>
              <p className="lab-objective">{lab.objective}</p>

              <div className="lab-build">
                <span className="lab-build-label">What you'll build:</span> {lab.whatYouBuild}
              </div>

              <div className="lab-prereqs">
                <span className="lab-build-label">Prerequisites:</span>
                {lab.prerequisites.map(p => <span key={p} className="tool-badge">{p}</span>)}
              </div>

              <div className="lab-skills">
                {lab.skills.map(s => <span key={s} className="tool-badge">{s}</span>)}
              </div>

              <div className="lab-actions">
                <Link to={`/class/${lab.classId}`} className="btn btn--outline btn--sm">
                  Open Class <ArrowRight size={13} />
                </Link>

                <button
                  className={`btn btn--sm ${isCompilerOpen ? 'btn--primary' : 'btn--outline'}`}
                  onClick={() => toggleCompiler(lab.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Code2 size={13} />
                  {isCompilerOpen ? 'Hide Compiler' : 'Open Lab Compiler'}
                  {isCompilerOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {!done && (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => markLabDone(lab.id)}
                  >
                    <CheckCircle size={13} /> Mark complete
                  </button>
                )}
                {done && <span className="lab-done-badge"><CheckCircle size={13} /> Completed</span>}
              </div>

              {isCompilerOpen && (
                <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <LabCompiler
                    labId={lab.id}
                    labTitle={lab.title}
                    onSuccess={() => markLabDone(lab.id)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
