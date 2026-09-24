// components/compiler/LabCompiler.tsx
// Interactive In-Browser Python Lab Compiler & Runner

import { useState, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Play,
  RotateCcw,
  Terminal,
  CheckCircle,
  AlertCircle,
  Clock,
  Copy,
  Check,
  Code2,
  Trash2
} from 'lucide-react';

interface LabCompilerProps {
  labId: string;
  labTitle: string;
  defaultFilename?: string;
  defaultCode?: string;
  onSuccess?: () => void;
}

interface RunResult {
  status: 'success' | 'error' | 'timeout';
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time_ms: number;
}

const API_BASE = 'http://127.0.0.1:8000/api';

export function LabCompiler({ labId, labTitle, defaultFilename, defaultCode, onSuccess }: LabCompilerProps) {
  const [code, setCode] = useState<string>(defaultCode || '');
  const [initialCode, setInitialCode] = useState<string>(defaultCode || '');
  const [filename, setFilename] = useState<string>(defaultFilename || 'main.py');
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep code and filename synchronized when props change (e.g. switching tabs)
  useEffect(() => {
    if (defaultCode !== undefined) {
      setCode(defaultCode);
      setInitialCode(defaultCode);
    }
  }, [defaultCode]);

  useEffect(() => {
    if (defaultFilename) {
      setFilename(defaultFilename);
    }
  }, [defaultFilename]);

  // Fetch starter template from backend if not provided
  useEffect(() => {
    if (!defaultCode) {
      fetch(`${API_BASE}/compiler/templates/${labId}`)
        .then((res) => {
          if (!res.ok) throw new Error('Template not found');
          return res.json();
        })
        .then((data) => {
          setCode(data.code || '');
          setInitialCode(data.code || '');
          if (data.filename) setFilename(data.filename);
        })
        .catch(() => {
          const fallback = `# ${labTitle}\n# Interactive Python Sandbox\n\nprint("Hello from ${labTitle}!")\n`;
          setCode(fallback);
          setInitialCode(fallback);
        });
    }
  }, [labId, defaultCode, labTitle]);

  const handleRunCode = async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true);
    setErrorMsg(null);

    try {
      const response = await fetch(`${API_BASE}/compiler/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: 'python',
          timeout_seconds: 8.0,
        }),
      });

      if (!response.ok) {
        throw new Error(`Compiler API error: ${response.statusText}`);
      }

      const result: RunResult = await response.json();
      setOutput(result);

      if (result.status === 'success' && result.exit_code === 0 && onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      const errString = err instanceof Error ? err.message : 'Failed to connect to compiler service';
      setErrorMsg(errString);
      setOutput({
        status: 'error',
        stdout: '',
        stderr: errString,
        exit_code: 1,
        execution_time_ms: 0,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setCode(initialCode);
    setOutput(null);
    setErrorMsg(null);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearOutput = () => {
    setOutput(null);
    setErrorMsg(null);
  };

  // Support Tab indentation in textarea
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleRunCode();
    }
  };

  // Generate line numbers for editor
  const lineCount = Math.max(code.split('\n').length, 12);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div
      className="lab-compiler-root"
      style={{
        borderRadius: '0',
        border: 'none',
        overflow: 'hidden',
        background: '#0F172A',
        color: '#F8FAFC',
        boxShadow: 'none',
        fontFamily: 'var(--font-mono, monospace)',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        width: '100%',
        minWidth: 0,
      }}
    >
      {/* Editor Header Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.55rem 0.85rem',
          background: '#161B22',
          borderBottom: '1px solid #21262D',
          fontSize: '0.8rem',
          flexWrap: 'wrap',
          gap: '8px',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Code2 size={16} style={{ color: '#07D2E0' }} />
          <span style={{ fontWeight: 600, color: '#F1F5F9' }}>{filename}</span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              background: 'rgba(7, 210, 224, 0.15)',
              color: '#07D2E0',
              padding: '1px 6px',
              borderRadius: '4px',
            }}
          >
            Python 3.12
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleCopy}
            title="Copy Code"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#94A3B8',
              padding: '4px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={13} style={{ color: '#10B981' }} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleReset}
            title="Reset to starter code"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#94A3B8',
              padding: '4px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          <button
            onClick={handleRunCode}
            disabled={isRunning}
            title="Execute Code (Ctrl+Enter)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isRunning ? '#0284C7' : '#07D2E0',
              color: '#0B171B',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: isRunning ? 'wait' : 'pointer',
              boxShadow: '0 2px 8px rgba(7, 210, 224, 0.3)',
            }}
          >
            <Play size={13} fill="#0B171B" />
            <span>{isRunning ? 'Running...' : 'Run Code'}</span>
          </button>
        </div>
      </div>

      {/* Code Textarea with Line Numbers */}
      <div style={{ display: 'flex', position: 'relative', flex: 1, minHeight: '200px', minWidth: 0, overflowY: 'auto' }}>
        {/* Line Numbers Column */}
        <div
          style={{
            userSelect: 'none',
            padding: '0.75rem 0.65rem',
            textAlign: 'right',
            color: '#475569',
            fontSize: '0.8rem',
            lineHeight: '1.6',
            background: '#0B132B',
            borderRight: '1px solid #1E293B',
            fontFamily: 'monospace',
            minWidth: '40px',
            flexShrink: 0,
          }}
        >
          {lineNumbers.map((num) => (
            <div key={num}>{num}</div>
          ))}
        </div>

        {/* Editable Code Editor */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '0.75rem 1rem',
            fontSize: '0.82rem',
            lineHeight: '1.6',
            background: 'transparent',
            color: '#E2E8F0',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontFamily: 'var(--font-mono, monospace)',
            whiteSpace: 'pre',
            tabSize: 4,
          }}
        />
      </div>

      {/* Terminal / Output Console */}
      <div
        style={{
          borderTop: '1px solid #334155',
          background: '#090D16',
          padding: '0.75rem 1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
            paddingBottom: '0.4rem',
            borderBottom: '1px solid #1E293B',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
            <Terminal size={14} style={{ color: '#07D2E0' }} />
            <span style={{ fontWeight: 600, color: '#94A3B8' }}>Terminal Output</span>
            {output && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  background: output.exit_code === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: output.exit_code === 0 ? '#34D399' : '#F87171',
                }}
              >
                {output.exit_code === 0 ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                Exit: {output.exit_code}
              </span>
            )}
            {output?.execution_time_ms !== undefined && (
              <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem' }}>
                <Clock size={11} /> {output.execution_time_ms}ms
              </span>
            )}
          </div>

          {output && (
            <button
              onClick={handleClearOutput}
              title="Clear terminal output"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
              }}
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Console Pre View */}
        <pre
          style={{
            margin: 0,
            padding: '0.5rem',
            borderRadius: '6px',
            background: '#050811',
            minHeight: '75px',
            maxHeight: '180px',
            overflowY: 'auto',
            fontSize: '0.78rem',
            lineHeight: '1.5',
            color: output ? (output.exit_code === 0 ? '#A7F3D0' : '#FCA5A5') : '#475569',
            fontFamily: 'var(--font-mono, monospace)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {isRunning ? (
            <span style={{ color: '#07D2E0' }}>Executing Python script in sandbox...</span>
          ) : output ? (
            output.stdout || output.stderr ? (
              <>
                {output.stdout}
                {output.stderr && <span style={{ color: '#F87171' }}>{output.stderr}</span>}
              </>
            ) : (
              <span style={{ color: '#64748B' }}>[Process finished with no console output]</span>
            )
          ) : errorMsg ? (
            <span style={{ color: '#F87171' }}>{errorMsg}</span>
          ) : (
            <span>Click &quot;Run Code&quot; or press Ctrl+Enter to execute this Python lab.</span>
          )}
        </pre>
      </div>
    </div>
  );
}
