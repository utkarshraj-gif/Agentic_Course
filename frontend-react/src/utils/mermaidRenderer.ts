// utils/mermaidRenderer.ts
// Renders Architecture and Process Flow Diagrams embedded in lesson HTML
// Uses interactive @xyflow/react + ELK for architecture flows and Mermaid for sequence flows.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { ArchitectureFlow } from '../components/ArchitectureFlow/ArchitectureFlow';
import type { DiagramGraph, DiagramNodeData, DiagramEdgeData } from '../api/diagrams';

declare global {
  interface Window {
    mermaid?: any;
  }
}

let mermaidLoadedPromise: Promise<void> | null = null;
let isMermaidInitialized = false;

function loadMermaidScript(): Promise<void> {
  if (window.mermaid) {
    return Promise.resolve();
  }
  if (mermaidLoadedPromise) {
    return mermaidLoadedPromise;
  }

  mermaidLoadedPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="mermaid"]');
    if (existing) {
      if (window.mermaid) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (err) => reject(err));
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return mermaidLoadedPromise;
}

function initMermaid() {
  if (isMermaidInitialized || !window.mermaid) return;

  try {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#e0f7f8',
        primaryTextColor: '#113032',
        primaryBorderColor: '#07d2e0',
        lineColor: '#07d2e0',
        secondaryColor: '#f0fdfa',
        tertiaryColor: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        nodeBorder: '#07d2e0',
        mainBkg: '#f0fdfa',
        clusterBkg: '#f8fcfa',
        clusterBorder: '#ccebe8',
        titleColor: '#113032',
        edgeLabelBackground: '#ffffff',
        actorBkg: '#f0fdfa',
        actorBorder: '#07d2e0',
        actorTextColor: '#113032',
        signalColor: '#07d2e0',
        signalTextColor: '#113032',
        labelBoxBkgColor: '#f0fdfa',
        labelBoxBorderColor: '#07d2e0',
        labelTextColor: '#113032',
        loopTextColor: '#113032',
        noteBkgColor: '#fefce8',
        noteBorderColor: '#facc15',
        noteTextColor: '#854d0e',
      },
      securityLevel: 'loose',
    });
    isMermaidInitialized = true;
  } catch (err) {
    console.error('Failed to initialize Mermaid:', err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let seq = 0;

/**
 * Parses Mermaid flowchart code into a generic graph schema for ELK + React Flow
 */
export function parseMermaidFlowchart(diagCode: string): DiagramGraph {
  const nodesMap = new Map<string, DiagramNodeData>();
  const edges: DiagramEdgeData[] = [];
  let edgeSeq = 0;

  const directionMatch = diagCode.match(/flowchart\s+(LR|RL|TD|TB|BT)/i);
  const rawDir = directionMatch ? directionMatch[1].toUpperCase() : 'LR';
  const direction = rawDir === 'TD' || rawDir === 'TB' ? 'DOWN' : 'RIGHT';

  // 1. Database cylinders: id[(content)]
  const dbRegex = /([A-Za-z0-9_]+)\[\(([\s\S]*?)\)\]/g;
  let m: RegExpExecArray | null;
  while ((m = dbRegex.exec(diagCode)) !== null) {
    const rawContent = m[2].replace(/<br\s*\/?>/gi, '\n').replace(/['"]/g, '').trim();
    const lines = rawContent.split('\n').map((s) => s.trim()).filter(Boolean);
    nodesMap.set(m[1], {
      id: m[1],
      label: lines[0] || m[1],
      subtitle: lines.slice(1).join(' · ') || undefined,
      type: 'database',
      metadata: {},
    });
  }

  // 2. Decision diamonds: id{content}
  const diamondRegex = /([A-Za-z0-9_]+)\{([\s\S]*?)\}/g;
  while ((m = diamondRegex.exec(diagCode)) !== null) {
    if (!nodesMap.has(m[1])) {
      const rawContent = m[2].replace(/<br\s*\/?>/gi, '\n').replace(/['"]/g, '').trim();
      const lines = rawContent.split('\n').map((s) => s.trim()).filter(Boolean);
      nodesMap.set(m[1], {
        id: m[1],
        label: lines[0] || m[1],
        subtitle: lines.slice(1).join(' · ') || undefined,
        type: 'service',
        metadata: { isDecision: true },
      });
    }
  }

  // 3. Standard nodes: id[content]
  const rectRegex = /([A-Za-z0-9_]+)\[([^()\[\]]*?)\]/g;
  while ((m = rectRegex.exec(diagCode)) !== null) {
    if (!nodesMap.has(m[1])) {
      const rawContent = m[2].replace(/<br\s*\/?>/gi, '\n').replace(/['"]/g, '').trim();
      const lines = rawContent.split('\n').map((s) => s.trim()).filter(Boolean);
      const label = lines[0] || m[1];
      const isUser = /user|clinic|doctor|clinician|human|analyst|operator|client/i.test(label);
      nodesMap.set(m[1], {
        id: m[1],
        label: label,
        subtitle: lines.slice(1).join(' · ') || undefined,
        type: isUser ? 'user' : 'service',
        metadata: {},
      });
    }
  }

  // Filter out comments and subgraphs before edge parsing
  const edgeLines = diagCode
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !l.startsWith('subgraph') && l !== 'end' && !l.startsWith('%%') && !l.startsWith('classDef'));

  const cleanText = edgeLines.join('\n');

  // 4. Edges with labels: A -->|label| B or A -.->|label| B or A ==>|label| B
  const edgeLabeledRegex = /([A-Za-z0-9_]+)(?:\[.*?\]|\(.*?\)|[\(\{].*?[\)\}])?\s*(-->|-\.->|==>)\s*(?:\|([^|]*)\|)\s*([A-Za-z0-9_]+)/g;
  while ((m = edgeLabeledRegex.exec(cleanText)) !== null) {
    const src = m[1];
    const tgt = m[4];
    const lbl = (m[3] || '').trim();
    if (!nodesMap.has(src)) nodesMap.set(src, { id: src, label: src, type: 'service' });
    if (!nodesMap.has(tgt)) nodesMap.set(tgt, { id: tgt, label: tgt, type: 'service' });
    edges.push({
      id: `e_${++edgeSeq}`,
      source: src,
      target: tgt,
      label: lbl,
      animated: m[2].includes('-.->'),
    });
  }

  // 5. Plain edges: A --> B or A -.-> B or A ==> B
  const edgePlainRegex = /([A-Za-z0-9_]+)(?:\[.*?\]|\(.*?\)|[\(\{].*?[\)\}])?\s*(-->|-\.->|==>)\s*(?!(?:\|[^|]*\|))\s*([A-Za-z0-9_]+)/g;
  while ((m = edgePlainRegex.exec(cleanText)) !== null) {
    const src = m[1];
    const tgt = m[3];
    if (src.toLowerCase() === 'flowchart' || src.toLowerCase() === 'subgraph' || src.toLowerCase() === 'graph') continue;
    if (!nodesMap.has(src)) nodesMap.set(src, { id: src, label: src, type: 'service' });
    if (!nodesMap.has(tgt)) nodesMap.set(tgt, { id: tgt, label: tgt, type: 'service' });
    edges.push({
      id: `e_${++edgeSeq}`,
      source: src,
      target: tgt,
      animated: m[2].includes('-.->'),
    });
  }

  return {
    id: `class-flow-${Date.now()}`,
    name: 'System Architecture Flow',
    direction,
    nodes: Array.from(nodesMap.values()),
    edges,
  };
}

export async function renderMermaidDiagrams(
  container: HTMLElement | null,
  diagrams?: string[]
): Promise<void> {
  if (!container || !diagrams || diagrams.length === 0) return;

  const elements = container.querySelectorAll<HTMLElement>('.mmd');
  if (elements.length === 0) return;

  for (const el of Array.from(elements)) {
    const idx = Number(el.dataset.d);
    const diagCode = diagrams[idx];
    if (!diagCode) continue;

    const trimmed = diagCode.trim();
    const isFlowchart =
      trimmed.startsWith('flowchart') ||
      trimmed.startsWith('graph');

    // ========================================================
    // 1. INTERACTIVE REACT FLOW + ELK DIAGRAM FOR FLOWCHARTS
    // ========================================================
    if (isFlowchart) {
      if (el.dataset.rendered === 'flow' && (el as any)._lastDiagCode === diagCode) continue;
      el.dataset.rendered = 'flow';
      (el as any)._lastDiagCode = diagCode;

      // Re-style wrapper container so React Flow fills it cleanly
      el.classList.remove('loading');
      el.classList.add('mmd--interactive-flow');
      el.style.padding = '0';
      el.style.border = 'none';
      el.style.background = 'transparent';
      el.style.cursor = 'default';
      el.style.boxShadow = 'none';
      el.style.display = 'block';
      el.style.width = '100%';
      el.style.minHeight = '520px';
      el.innerHTML = '';

      let root = (el as any)._reactRoot;
      if (!root) {
        root = createRoot(el);
        (el as any)._reactRoot = root;
      }

      // Parse each class's own diagram code dynamically!
      const parsedGraph = parseMermaidFlowchart(diagCode);
      root.render(
        createElement(ArchitectureFlow, {
          initialGraph: parsedGraph,
          height: '520px',
          showControls: true,
          showMinimap: true,
          showToolbar: false, // Never force the admin toolbar in lesson view
        })
      );
      continue;
    }

    // ========================================================
    // 2. MERMAID FOR SEQUENCE / STATE / OTHER DIAGRAMS
    // ========================================================
    if (el.querySelector('svg')) continue;

    try {
      await loadMermaidScript();
      initMermaid();
    } catch (err) {
      console.warn('Could not load Mermaid library:', err);
      el.innerHTML = `<pre style="font-family:monospace;font-size:0.8rem;padding:1rem;border-radius:8px;overflow-x:auto;">${escapeHtml(diagCode)}</pre>`;
      continue;
    }

    el.classList.add('loading');
    const id = `mmd-${Date.now()}-${++seq}`;

    try {
      const { svg } = await window.mermaid.render(id, diagCode);
      el.innerHTML = svg;
      el.classList.remove('loading');

      // Add enlarge & zoom badge for sequence diagrams
      const badge = document.createElement('div');
      badge.className = 'mmd-zoom-badge';
      badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Click to enlarge & zoom`;
      el.appendChild(badge);

      el.style.cursor = 'zoom-in';
      el.title = 'Click to open enlarged view with pan and zoom';
      el.onclick = (e) => {
        e.stopPropagation();
        let headingText = 'Process Flow Diagram';
        let prev = el.previousElementSibling;
        while (prev) {
          if (/^H[1-4]$/i.test(prev.tagName)) {
            headingText = prev.textContent?.trim() || headingText;
            break;
          }
          prev = prev.previousElementSibling;
        }

        const svgEl = el.querySelector('svg');
        if (svgEl) {
          window.dispatchEvent(
            new CustomEvent('open_diagram_zoom', {
              detail: {
                svgContent: svgEl.outerHTML,
                title: headingText,
              },
            })
          );
        }
      };
    } catch (err) {
      console.warn('Mermaid rendering failed for diagram', idx, err);
      el.classList.remove('loading');
      el.innerHTML = `
        <div style="width:100%;text-align:left;">
          <pre style="font-family:monospace;font-size:0.8rem;background:var(--surface-2,#f8fcfb);padding:1rem;border-radius:8px;overflow-x:auto;">${escapeHtml(diagCode)}</pre>
        </div>
      `;
      const errEl = document.getElementById('d' + id);
      if (errEl) errEl.remove();
    }
  }
}
