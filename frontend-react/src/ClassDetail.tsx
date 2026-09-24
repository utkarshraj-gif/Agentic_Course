import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Code, Copy, ChevronLeft } from 'lucide-react';


const API_BASE = 'http://127.0.0.1:8000/api';

interface CodeFile {
  name: string;
  lang: string;
  code: string;
}

interface ClassDetailData {
  id: number;
  title: string;
  short: string;
  html: string;
  files: CodeFile[];
  meta: Record<string, any>;
}

export const ClassDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ClassDetailData | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setData(null);
    fetch(`${API_BASE}/curriculum/classes/${id}`)
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.error(err));
  }, [id]);

  const handleComplete = () => {
    localStorage.setItem(`class_${id}_completed`, 'true');
    // Dispatch event to update sidebar
    window.dispatchEvent(new Event('progress_updated'));
    navigate('/');
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data) return <div className="main-content">Loading class details...</div>;

  return (
    <div className="main-content" style={{ padding: '0' }}>
      {/* Header */}
      <div style={{ padding: '2rem 4rem', backgroundColor: 'var(--color-bg-light)', borderBottom: '1px solid var(--color-border)' }}>
        <button 
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1rem', padding: 0 }}
        >
          <ChevronLeft size={16} /> Back to Dashboard
        </button>
        <span className="course-tag">{data.meta?.week}</span>
        <h1 style={{ margin: '0.5rem 0', fontSize: '2.2rem' }}>{data.title}</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '1.1rem' }}>
          <strong>Domain Example:</strong> {data.meta?.domain}
        </p>
      </div>

      <div style={{ padding: '3rem 4rem', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Prose */}
        <div 
          className="prose" 
          dangerouslySetInnerHTML={{ __html: data.html }} 
          style={{ fontSize: '1.05rem', lineHeight: '1.8' }}
        />

        {/* Code Viewer */}
        {data.files && data.files.length > 0 && (
          <div style={{ marginTop: '3rem', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', backgroundColor: 'var(--color-bg-light)', borderBottom: '1px solid var(--color-border)' }}>
              {data.files.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: activeTab === i ? 'var(--color-bg-white)' : 'transparent',
                    border: 'none',
                    borderBottom: activeTab === i ? '2px solid var(--color-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontWeight: activeTab === i ? 600 : 400,
                    color: activeTab === i ? 'var(--color-text-main)' : 'var(--color-text-muted)'
                  }}
                >
                  <Code size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  {f.name}
                </button>
              ))}
            </div>
            
            <div style={{ position: 'relative', backgroundColor: '#0d1117', padding: '1rem', overflowX: 'auto' }}>
              <button 
                onClick={() => handleCopy(data.files[activeTab].code)}
                style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
              >
                <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
              </button>
              <pre style={{ margin: 0, color: '#c9d1d9', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
                <code>{data.files[activeTab].code}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center' }}>
          <button className="button" onClick={handleComplete}>
            <CheckCircle size={18} /> Mark as Complete & Return
          </button>
        </div>
      </div>
    </div>
  );
};
