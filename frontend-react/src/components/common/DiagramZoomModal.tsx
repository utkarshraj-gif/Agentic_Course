// components/common/DiagramZoomModal.tsx
// Interactive Lightbox Modal for Enlarge, Pan, and Zoom of Architecture & Workflow Diagrams

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X, Move, Maximize2 } from 'lucide-react';

interface DiagramZoomModalProps {
  svgContent: string;
  title?: string;
  onClose: () => void;
}

export function DiagramZoomModal({
  svgContent,
  title = 'Architecture & Workflow Diagram',
  onClose,
}: DiagramZoomModalProps) {
  const [zoom, setZoom] = useState<number>(1.0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract viewBox or dimensions to determine true diagram aspect ratio
  const svgAspect = useMemo(() => {
    const viewBoxMatch = svgContent.match(
      /viewBox\s*=\s*["']\s*([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.-]+)\s*["']/i
    );
    if (viewBoxMatch) {
      const w = parseFloat(viewBoxMatch[3]);
      const h = parseFloat(viewBoxMatch[4]);
      if (w > 0 && h > 0) {
        return w / h;
      }
    }
    return 1.65; // default fallback aspect ratio (16:10)
  }, [svgContent]);

  // Clean SVG: remove inline max-width/max-height constraints inserted by Mermaid so SVG scales vectorially
  const cleanedSvg = useMemo(() => {
    let cleaned = svgContent;
    // Strip max-width and max-height from style attribute
    cleaned = cleaned.replace(/<svg\b([^>]*?)style="([^"]*)"/i, (_match, before, styleContent) => {
      const newStyle = styleContent
        .replace(/max-width\s*:[^;"]+;?/gi, '')
        .replace(/max-height\s*:[^;"]+;?/gi, '')
        .replace(/width\s*:[^;"]+;?/gi, '')
        .replace(/height\s*:[^;"]+;?/gi, '')
        .trim();
      return `<svg${before}style="${newStyle}; width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; display: block;" preserveAspectRatio="xMidYMid meet"`;
    });

    if (!cleaned.includes('preserveAspectRatio')) {
      cleaned = cleaned.replace(
        /<svg\b/i,
        '<svg preserveAspectRatio="xMidYMid meet" style="width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; display: block;" '
      );
    }
    return cleaned;
  }, [svgContent]);

  // Calculate expansive, viewport-filling dimensions for the diagram card
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 750,
  });

  useEffect(() => {
    const calculateOptimalSize = () => {
      // Use 94% of window width and 88% of available height
      const availWidth = Math.max(window.innerWidth * 0.94, 360);
      const availHeight = Math.max((window.innerHeight - 130) * 0.88, 280);

      let w: number;
      let h: number;

      if (availWidth / availHeight > svgAspect) {
        // Height is the limiting constraint
        h = availHeight;
        w = h * svgAspect;
      } else {
        // Width is the limiting constraint
        w = availWidth;
        h = w / svgAspect;
      }

      // Ensure minimum readable size so small diagrams are enlarged significantly
      w = Math.max(w, Math.min(880, window.innerWidth * 0.92));
      h = Math.max(h, 480);

      setDimensions({
        width: Math.round(w),
        height: Math.round(h),
      });
    };

    calculateOptimalSize();
    window.addEventListener('resize', calculateOptimalSize);
    return () => window.removeEventListener('resize', calculateOptimalSize);
  }, [svgAspect]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 4.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.4));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1.0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleFitScreen = useCallback(() => {
    setZoom(1.0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Keyboard shortcuts: ESC to close, + / - to zoom, 0 or F to reset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0' || e.key.toLowerCase() === 'f') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleZoomIn, handleZoomOut, handleReset]);

  // Lock body scroll while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Mouse wheel zoom
  const handleWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Drag to pan
  const handleMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="diagram-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: 'rgba(5, 12, 16, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Modal Top Bar */}
      <div
        className="diagram-modal-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.75rem',
          background: 'rgba(10, 20, 24, 0.96)',
          borderBottom: '1px solid rgba(7, 210, 224, 0.25)',
          color: '#ffffff',
          userSelect: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(7, 210, 224, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Maximize2 size={18} color="#07d2e0" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.01em', color: '#f8fafc' }}>
              {title}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#07d2e0', fontWeight: 600 }}>
              Architecture & Workflow Canvas • Vector Enlarge Mode
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Quick presets */}
          <button
            onClick={handleFitScreen}
            title="100% Fit"
            style={{
              background: zoom === 1.0 ? 'rgba(7, 210, 224, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${zoom === 1.0 ? '#07d2e0' : 'rgba(255, 255, 255, 0.15)'}`,
              color: zoom === 1.0 ? '#07d2e0' : '#ffffff',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            100% Fit
          </button>

          <button
            onClick={() => setZoom(1.5)}
            title="150% Zoom"
            style={{
              background: zoom === 1.5 ? 'rgba(7, 210, 224, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${zoom === 1.5 ? '#07d2e0' : 'rgba(255, 255, 255, 0.15)'}`,
              color: zoom === 1.5 ? '#07d2e0' : '#ffffff',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            150%
          </button>

          <button
            onClick={() => setZoom(2.0)}
            title="200% Zoom"
            style={{
              background: zoom === 2.0 ? 'rgba(7, 210, 224, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${zoom === 2.0 ? '#07d2e0' : 'rgba(255, 255, 255, 0.15)'}`,
              color: zoom === 2.0 ? '#07d2e0' : '#ffffff',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            200%
          </button>

          <div style={{ width: '1px', height: '22px', background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

          {/* Stepper Zoom */}
          <button
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <ZoomOut size={15} />
          </button>

          <span
            style={{
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              color: '#07d2e0',
              minWidth: '55px',
              textAlign: 'center',
              fontWeight: 700,
            }}
          >
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            title="Zoom In (+)"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <ZoomIn size={15} />
          </button>

          <button
            onClick={handleReset}
            title="Reset Zoom & Pan (0 or F)"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>

          <div style={{ width: '1px', height: '22px', background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

          <button
            onClick={onClose}
            title="Close Lightbox (ESC)"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              borderRadius: '6px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
              transition: 'background 0.2s',
            }}
          >
            <X size={15} /> Close
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleReset}
        style={{
          flex: 1,
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'relative',
          padding: '1.5rem',
          userSelect: 'none',
        }}
      >
        {/* Transform Container with SVG Card */}
        <div
          className="diagram-zoom-card"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
            willChange: 'transform',
            background: '#ffffff',
            padding: '2.5rem 3rem',
            borderRadius: '16px',
            boxShadow:
              '0 25px 70px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(7, 210, 224, 0.35), 0 0 35px rgba(7, 210, 224, 0.15)',
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            maxWidth: 'none',
            maxHeight: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
            boxSizing: 'border-box',
          }}
          dangerouslySetInnerHTML={{ __html: cleanedSvg }}
        />
      </div>

      {/* Modal Bottom Footer / Interactive Guide */}
      <div
        style={{
          padding: '0.75rem 1.75rem',
          background: 'rgba(10, 20, 24, 0.96)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'rgba(255, 255, 255, 0.65)',
          fontSize: '0.8rem',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0' }}>
            <Move size={14} color="#07d2e0" /> Drag with mouse to pan
          </span>
          <span>•</span>
          <span style={{ color: '#e2e8f0' }}>Scroll mouse wheel to zoom in / out</span>
          <span>•</span>
          <span style={{ color: '#e2e8f0' }}>Double-click anywhere to center</span>
          <span>•</span>
          <span style={{ color: '#07d2e0', fontWeight: 600 }}>
            Canvas Size: {dimensions.width} × {dimensions.height}px
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>
            Shortcut: <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>ESC</kbd> to exit
          </span>
        </div>
      </div>
    </div>
  );
}
