import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, Code, Copy, ChevronLeft, Bookmark, BookmarkCheck, Clock, Tag, Maximize2, Minimize2, Lock, ArrowRight } from 'lucide-react';
import { ProgressService, DEFAULT_WEEKS } from '../../services/progress/ProgressService';
import { BookmarkService } from '../../services/bookmarks/BookmarkService';
import { LessonQuiz } from './LessonQuiz';
import { LessonAudioPlayer } from './LessonAudioPlayer';
import { getQuizForClass } from '../../data/quizData';
import { LabCompiler } from '../compiler/LabCompiler';
import { renderMermaidDiagrams } from '../../utils/mermaidRenderer';
import { annotateHtmlForTts } from '../../utils/ttsAnnotator';
import type { TtsSentence } from '../../utils/ttsAnnotator';
import { LessonDetailSkeleton } from '../common/Skeleton';

import { API_BASE } from '../../services/api';

interface CodeFile {
  name: string;
  lang: string;
  code: string;
}

interface TocItem {
  text: string;
  id: string;
}

interface ClassDetailData {
  id: number;
  title: string;
  short: string;
  week: number;
  html: string;
  files: CodeFile[];
  toc: string[];
  meta: Record<string, any>;
  diagrams?: string[];
}

const ESTIMATED_TIMES: Record<number, string> = {
  1: '45 min', 2: '50 min', 3: '55 min', 4: '50 min',
  5: '60 min', 6: '60 min', 7: '55 min', 8: '50 min',
  9: '65 min', 10: '55 min', 11: '60 min', 12: '70 min',
  13: '45 min', 14: '50 min', 15: '55 min',
};

function parseToc(toc: string[]): TocItem[] {
  return toc.map((item, i) => ({
    text: item.replace(/^#+\s*/, ''),
    id: `s${i}`,
  }));
}

export function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const classId = Number(id);

  const [data, setData] = useState<ClassDetailData | null>(null);
  const [ttsSentences, setTtsSentences] = useState<TtsSentence[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showCompiler, setShowCompiler] = useState(false);
  const [activeTocId, setActiveTocId] = useState<string>('');
  const articleRef = useRef<HTMLElement>(null);

  const scrollToTarget = (e: React.MouseEvent, targetId: string, itemIndex?: number) => {
    e.preventDefault();
    let targetEl = document.getElementById(targetId);

    // Fallback: If not found directly by ID, search inside articleRef
    if (!targetEl && articleRef.current) {
      if (typeof itemIndex === 'number') {
        const headings = articleRef.current.querySelectorAll('h2');
        if (headings[itemIndex]) {
          targetEl = headings[itemIndex] as HTMLElement;
        }
      }
      if (!targetEl && targetId === 'knowledge-check') {
        targetEl = (document.getElementById('knowledge-check') ||
          articleRef.current.querySelector('.quiz-section')) as HTMLElement;
      }
    }

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveTocId(targetId);
      try {
        window.history.replaceState(null, '', `#${targetId}`);
      } catch (_) {}
    }
  };

  // Track active section as the user scrolls
  useEffect(() => {
    if (!data || !articleRef.current) return;

    const sections = articleRef.current.querySelectorAll('h2, #knowledge-check, #code-lab-section');
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            setActiveTocId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0,
      }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [data]);

  // Support direct URL hash linking on load
  useEffect(() => {
    if (data && window.location.hash) {
      const hash = window.location.hash.replace('#', '');
      const timer = setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActiveTocId(hash);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [data]);

  // Exit fullscreen compiler on Escape
  useEffect(() => {
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && showCompiler) {
        setShowCompiler(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showCompiler]);

  const handleToggleCompiler = () => {
    setShowCompiler(prev => !prev);
  };

  // Render mermaid architecture and workflow diagrams when data changes
  useEffect(() => {
    if (data && data.diagrams && data.diagrams.length > 0 && articleRef.current) {
      const timer = setTimeout(() => {
        renderMermaidDiagrams(articleRef.current, data.diagrams);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const isClassLocked = !ProgressService.isClassUnlocked(classId);
  const parentWeek = ProgressService.getParentWeek(classId);
  const prevWeekNum = parentWeek ? parentWeek.n - 1 : 1;
  const prevWeek = DEFAULT_WEEKS.find(w => w.n === prevWeekNum);
  const firstIncompletePrereq = prevWeek?.classes.find(id => !ProgressService.isClassCompleted(id)) || 1;

  useEffect(() => {
    if (isClassLocked) return;
    setData(null);
    setTtsSentences([]);
    setActiveTab(0);
    fetch(`${API_BASE}/curriculum/classes/${classId}`)
      .then(res => res.json())
      .then(d => {
        const { annotatedHtml, sentences } = annotateHtmlForTts(d.html, classId, d.short || d.title);
        d.html = annotatedHtml;
        setTtsSentences(sentences);
        setData(d);
        document.title = `Class ${classId}: ${d.short || d.title} | Velloe Learns`;
        const completed = ProgressService.isClassCompleted(classId);
        setIsCompleted(completed);
        setIsBookmarked(BookmarkService.isBookmarked(classId));
        // Track last visited
        ProgressService.setLastVisited(classId, d.short || d.title);
        window.dispatchEvent(new Event('progress_updated'));
      })
      .catch(console.error);
  }, [classId, isClassLocked]);

  // Synchronize completion in real-time when quiz is submitted
  useEffect(() => {
    const handleProgressUpdate = () => {
      const completed = ProgressService.isClassCompleted(classId);
      setIsCompleted(completed);
    };
    window.addEventListener('progress_updated', handleProgressUpdate);
    return () => window.removeEventListener('progress_updated', handleProgressUpdate);
  }, [classId]);

  const handleBookmark = () => {
    if (!data) return;
    const nowBookmarked = BookmarkService.toggle(classId, data.short || data.title);
    setIsBookmarked(nowBookmarked);
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quiz = getQuizForClass(classId);

  if (isClassLocked) {
    return (
      <div className="lesson-page">
        <div className="lesson-topbar">
          <nav className="lesson-breadcrumb" aria-label="Breadcrumb">
            <Link to="/dashboard">Overview</Link>
            <span aria-hidden="true">/</span>
            <Link to="/curriculum">Courses</Link>
            <span aria-hidden="true">/</span>
            <span className="current" aria-current="page">Class {String(classId).padStart(2, '0')} (Locked)</span>
          </nav>
        </div>

        <div className="lesson-locked-container">
          <div className="lesson-locked-card">
            <div className="lesson-locked-badge">
              <Lock size={32} />
            </div>
            <h2 className="lesson-locked-title">Class {String(classId).padStart(2, '0')} is Locked</h2>
            <p className="lesson-locked-subtitle">
              Prerequisite Required: Complete Week {prevWeekNum} First
            </p>
            <div className="lesson-locked-callout">
              <p>
                This class is part of <strong>Week {parentWeek?.n}: {parentWeek?.title}</strong>.
              </p>
              <p>
                To maintain a progressive learning path, all lessons and knowledge checks in{' '}
                <strong>Week {prevWeekNum} ({prevWeek?.title})</strong> must be completed before you can access this class.
              </p>
            </div>
            <div className="lesson-locked-actions">
              <Link to={`/class/${firstIncompletePrereq}`} className="btn btn--primary">
                Resume with Class {String(firstIncompletePrereq).padStart(2, '0')} <ArrowRight size={14} />
              </Link>
              <Link to="/curriculum" className="btn btn--outline">
                View Courses
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return <LessonDetailSkeleton classId={classId} />;
  }

  const tocItems = parseToc(data.toc ?? []);

  return (
    <div className="lesson-page">
      {/* Breadcrumb + controls */}
      <div className="lesson-topbar">
        <nav className="lesson-breadcrumb" aria-label="Breadcrumb">
          <Link to="/dashboard">Overview</Link>
          <span aria-hidden="true">/</span>
          <Link to="/curriculum">Courses</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Class {classId}</span>
        </nav>
        <div className="lesson-controls">
          <button
            className={`lesson-ctrl-btn ${isBookmarked ? 'lesson-ctrl-btn--active' : ''}`}
            onClick={handleBookmark}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this lesson'}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
          <button
            className="lesson-ctrl-btn"
            onClick={() => navigate('/curriculum')}
            aria-label="Back to curriculum"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* Lesson header */}
      <div className="lesson-header">
        <div className="lesson-header-inner">
          <div className="lesson-header-meta">
            <span className="lesson-tag"><Tag size={12} /> Week {data.week}</span>
            <span className="lesson-tag"><Clock size={12} /> {ESTIMATED_TIMES[classId] ?? '45 min'}</span>
            {isCompleted && (
              <span className="lesson-tag lesson-tag--done">
                <CheckCircle size={12} /> Completed
              </span>
            )}
          </div>
          <h1 className="lesson-title">{data.title}</h1>
          <div className="lesson-meta-breakdown">
            {data.meta?.domain && (
              <div className="lesson-meta-row">
                <span className="lesson-meta-label">Domain Example:</span>
                <span className="lesson-domain-highlight">{data.meta.domain}</span>
              </div>
            )}
            {data.meta?.tools && data.meta.tools.length > 0 && (
              <div className="lesson-meta-row">
                <span className="lesson-meta-label">Tools & Frameworks:</span>
                <div className="lesson-tools">
                  {data.meta.tools.map((t: string) => (
                    <span key={t} className="tool-badge">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Audio Briefing Player (Text-to-Speech) */}
          <LessonAudioPlayer
            classId={classId}
            title={data.title}
            htmlContent={data.html}
            preParsedSentences={ttsSentences}
            contentRef={articleRef}
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div
        className="lesson-body"
        style={{ minWidth: 0, width: '100%', maxWidth: '100%' }}
      >
        {/* TOC sidebar */}
        {tocItems.length > 0 && (
          <aside className="lesson-toc" aria-label="Lesson contents">
            <div className="lesson-toc-title">On this page</div>
            <nav>
              {tocItems.map((item, idx) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`lesson-toc-item ${activeTocId === item.id ? 'lesson-toc-item--active active' : ''}`}
                  onClick={(e) => scrollToTarget(e, item.id, idx)}
                >
                  {item.text}
                </a>
              ))}
            </nav>
            {isCompleted ? (
              <div className="lesson-toc-done">
                <CheckCircle size={14} /> Lesson complete
              </div>
            ) : (
              <a
                href="#knowledge-check"
                className={`lesson-toc-pending ${activeTocId === 'knowledge-check' ? 'active' : ''}`}
                onClick={(e) => scrollToTarget(e, 'knowledge-check')}
              >
                Complete quiz to finish
              </a>
            )}
          </aside>
        )}

        {/* Main content */}
        <article
          ref={articleRef}
          className="lesson-content"
          style={{ minWidth: 0, width: '100%', maxWidth: '100%' }}
        >
          {showCompiler && (!data.files || data.files.length === 0) && (
            <div
              id="code-lab-section"
              style={{
                marginBottom: '24px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                background: 'var(--bg-white)',
              }}
            >
              <LabCompiler
                labId={classId <= 8 ? `lab-0${classId}` : `class-${classId}`}
                labTitle={`Class ${classId} Lab: ${data.short || data.title}`}
              />
            </div>
          )}

          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: data.html }}
          />

          {/* Code viewer + Compiler: side-by-side in parallel */}
          {data.files && data.files.length > 0 && (
            <div
              id="code-lab-section"
              className="code-viewer"
              aria-label="Code and Lab Compiler"
              style={showCompiler ? {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                margin: 0,
                borderRadius: 0,
                height: '100vh',
                width: '100vw',
                background: '#0D1117',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: 'none',
              } : {
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                margin: '2rem 0',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
              }}
            >
              {/* Header bar with file tabs on left and controls on right */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: showCompiler ? '#161B22' : 'var(--bg-light, #F8FAFC)',
                  borderBottom: showCompiler ? '1px solid #30363D' : '1px solid var(--border, #CBD5E1)',
                  paddingRight: '1rem',
                  paddingLeft: showCompiler ? '0.5rem' : '0',
                  flexWrap: 'wrap',
                  gap: '8px',
                  flexShrink: 0,
                }}
              >
                <div className="code-viewer-tabs" style={{ borderBottom: 'none', background: 'transparent' }}>
                  {data.files.map((f, i) => (
                    <button
                      key={i}
                      className={`code-tab ${activeTab === i ? 'code-tab--active' : ''}`}
                      onClick={() => setActiveTab(i)}
                      style={showCompiler ? {
                        color: activeTab === i ? '#58A6FF' : '#8B949E',
                        background: activeTab === i ? '#0D1117' : 'transparent',
                        borderBottomColor: activeTab === i ? '#58A6FF' : 'transparent',
                      } : undefined}
                    >
                      <Code size={13} />
                      {f.name}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                  <button
                    className="btn btn--sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 14px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: showCompiler ? '#DC2626' : 'var(--primary, #059669)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: showCompiler ? '0 2px 8px rgba(220, 38, 38, 0.3)' : '0 2px 8px rgba(5, 150, 105, 0.3)',
                    }}
                    onClick={handleToggleCompiler}
                    aria-label="Toggle Fullscreen Lab Compiler"
                    title={showCompiler ? "Exit Fullscreen Compiler (Esc)" : "Open Parallel Compiler Workspace"}
                  >
                    {showCompiler ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span>{showCompiler ? 'Exit Fullscreen Compiler (Esc)' : 'Show Parallel Compiler'}</span>
                  </button>

                  <button
                    className="btn btn--sm btn--ghost"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      color: showCompiler ? '#C9D1D9' : undefined,
                    }}
                    onClick={() => handleCopy(data.files[activeTab].code)}
                    aria-label="Copy reference code"
                  >
                    <Copy size={13} />
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
              </div>

              {/* Side-by-side parallel container: code on left, compiler on right */}
              <div
                style={{
                  display: showCompiler ? 'grid' : 'block',
                  gridTemplateColumns: showCompiler ? 'minmax(0, 1fr) minmax(0, 1fr)' : '100%',
                  height: showCompiler ? 'calc(100vh - 46px)' : 'auto',
                  flex: showCompiler ? 1 : undefined,
                  background: '#0D1117',
                  minWidth: 0,
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}
              >
                {/* Left pane: Reference Code */}
                <div
                  style={{
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: showCompiler ? '2px solid #21262D' : 'none',
                    background: '#0D1117',
                    height: showCompiler ? '100%' : 'auto',
                    maxHeight: showCompiler ? '100%' : 'none',
                    overflow: 'hidden',
                  }}
                >
                  {showCompiler && (
                    <div
                      style={{
                        padding: '0.55rem 0.85rem',
                        background: '#161B22',
                        borderBottom: '1px solid #21262D',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#8B949E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Code size={13} color="#58A6FF" /> Reference Code: {data.files[activeTab]?.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(88, 166, 255, 0.12)',
                          color: '#58A6FF',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        Read-only
                      </span>
                    </div>
                  )}
                  <pre
                    className="code-block"
                    style={{
                      margin: 0,
                      padding: '1.25rem',
                      overflowX: 'auto',
                      overflowY: showCompiler ? 'auto' : 'visible',
                      flex: showCompiler ? 1 : undefined,
                      height: showCompiler ? '100%' : 'auto',
                      background: 'transparent',
                    }}
                  >
                    <code>{data.files[activeTab].code}</code>
                  </pre>
                </div>

                {/* Right pane: Compiler (parallel on right) */}
                {showCompiler && (
                  <div
                    style={{
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#0F172A',
                      height: '100%',
                      overflowY: 'auto',
                    }}
                  >
                    <LabCompiler
                      key={`${classId}-${data.files[activeTab]?.name || activeTab}`}
                      labId={classId <= 8 ? `lab-0${classId}` : `class-${classId}`}
                      labTitle={`Class ${classId} Lab: ${data.short || data.title}`}
                      defaultFilename={data.files[activeTab]?.name || 'main.py'}
                      defaultCode={data.files[activeTab]?.code}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Knowledge Check */}
          {quiz && (
            <LessonQuiz
              key={quiz.classId}
              quiz={quiz}
              classTitle={data.short || data.title}
              onQuizCompleted={() => setIsCompleted(true)}
            />
          )}

          {/* Completion footer */}
          <div className="lesson-footer">
            {!isCompleted ? (
              <div className="lesson-footer-prompt">
                <div className="lesson-footer-prompt-content">
                  <p className="lesson-footer-prompt-title">Complete the Knowledge Check above to finish this lesson</p>
                  <p className="lesson-footer-prompt-sub">Submit your attempt on the quiz above to automatically mark this class as completed.</p>
                </div>
                <a
                  href="#knowledge-check"
                  className="btn btn--primary"
                  onClick={(e) => scrollToTarget(e, 'knowledge-check')}
                >
                  Go to Knowledge Check
                </a>
              </div>
            ) : (
              <div className="lesson-footer-done">
                <CheckCircle size={20} />
                <div>
                  <strong>Lesson completed</strong>
                  <p>Knowledge Check submitted · Your progress has been saved.</p>
                </div>
                {classId < 15 ? (
                  <Link to={`/class/${classId + 1}`} className="btn btn--primary">
                    Next class ({classId + 1}) <ChevronLeft size={14} style={{ transform: 'rotate(180deg)' }} />
                  </Link>
                ) : (
                  <Link to="/curriculum" className="btn btn--primary">
                    🎓 Course Completed — Courses <ChevronLeft size={14} style={{ transform: 'rotate(180deg)' }} />
                  </Link>
                )}
              </div>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
