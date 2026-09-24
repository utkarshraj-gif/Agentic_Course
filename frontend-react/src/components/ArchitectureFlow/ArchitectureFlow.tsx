// src/components/ArchitectureFlow/ArchitectureFlow.tsx
// Production React Flow Architecture & Process Diagram Component with ELK Layout

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  useReactFlow
} from '@xyflow/react';
import type { Node, Edge, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { UserNode } from './nodes/UserNode';
import { ServiceNode } from './nodes/ServiceNode';
import { DatabaseNode } from './nodes/DatabaseNode';
import { getLayoutedElements } from '../../layout/elkLayout';
import { DiagramsApi } from '../../api/diagrams';
import type { DiagramGraph } from '../../api/diagrams';
import './ArchitectureFlow.css';

import {
  RefreshCw,
  X,
  AlertCircle
} from 'lucide-react';

export interface ArchitectureFlowProps {
  initialDiagramId?: string;
  initialGraph?: DiagramGraph;
  height?: string | number;
  showControls?: boolean;
  showMinimap?: boolean;
  showToolbar?: boolean;
  onNodeClick?: (node: Node) => void;
}

// Inner flow canvas component to access useReactFlow hook
const ArchitectureFlowInner: React.FC<ArchitectureFlowProps> = ({
  initialDiagramId = 'agent-architecture',
  initialGraph,
  height = '620px',
  showControls = true,
  showMinimap = true,
  onNodeClick,
}) => {
  const { fitView } = useReactFlow();

  const [diagramId, setDiagramId] = useState<string>(initialDiagramId);
  const initialDir: 'RIGHT' | 'DOWN' = initialGraph?.direction === 'DOWN' ? 'DOWN' : 'RIGHT';
  const [direction, setDirection] = useState<'RIGHT' | 'DOWN'>(initialDir);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    if (initialDiagramId && initialDiagramId !== diagramId) {
      setDiagramId(initialDiagramId);
    }
  }, [initialDiagramId]);

  useEffect(() => {
    if (initialGraph) {
      
      if (initialGraph.direction) {
        setDirection(initialGraph.direction === 'DOWN' ? 'DOWN' : 'RIGHT');
      }
    }
  }, [initialGraph]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Register custom node renderers
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      user: UserNode,
      service: ServiceNode,
      database: DatabaseNode,
    }),
    []
  );



  // Fetch and layout graph dynamically
  const loadDiagram = useCallback(
    async (targetId: string, targetDirection: 'RIGHT' | 'DOWN', overrideGraph?: DiagramGraph) => {
      setLoading(true);
      setError(null);
      setSelectedNode(null);

      try {
        const data = overrideGraph || initialGraph || (await DiagramsApi.getDiagram(targetId));
        

        // 1. Transform generic backend nodes to React Flow format
        const rawNodes: Node[] = data.nodes.map((n) => ({
          id: n.id,
          type: n.type || 'service',
          data: {
            label: n.label,
            subtitle: n.subtitle,
            type: n.type,
            metadata: n.metadata,
          },
          position: { x: 0, y: 0 },
        }));

        // 2. Transform generic backend edges to React Flow format
        const rawEdges: Edge[] = data.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: e.animated ?? false,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#0891b2',
            width: 16,
            height: 16,
          },
          style: {
            stroke: '#0891b2',
            strokeWidth: 1.8,
          },
          data: e.metadata,
        }));

        // 3. Compute dynamic hierarchical layout using ELK.js
        const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
          rawNodes,
          rawEdges,
          targetDirection
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        // 4. Center and fit view smoothly
        setTimeout(() => {
          fitView({ padding: 0.28, duration: 350 });
        }, 150);
      } catch (err: any) {
        console.error('Failed to load diagram:', err);
        setError(err.message || 'Error calculating layout or fetching graph.');
      } finally {
        setLoading(false);
      }
    },
    [initialGraph, fitView, setNodes, setEdges]
  );

  // Trigger load when diagram ID, layout direction, or initialGraph changes
  useEffect(() => {
    loadDiagram(diagramId, direction, initialGraph);
  }, [diagramId, direction, initialGraph, loadDiagram]);



  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    if (onNodeClick) onNodeClick(node);
  };

  return (
    <div className="architecture-flow-wrapper" style={{ height }}>
      {/* Main Flow Canvas */}
      <div className="architecture-flow-canvas">
        {loading && (
          <div className="architecture-flow-loading">
            <RefreshCw size={26} className="architecture-flow-spinner" />
            <span>Calculating graph layout & rendering nodes...</span>
          </div>
        )}

        {error && (
          <div className="architecture-flow-error">
            <AlertCircle size={28} />
            <strong>Unable to render architecture diagram</strong>
            <p style={{ margin: 0, fontSize: '0.84rem' }}>{error}</p>
            <button
              type="button"
              className="architecture-flow-btn"
              onClick={() => loadDiagram(diagramId, direction, initialGraph)}
              style={{ marginTop: '8px' }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && nodes.length === 0 && (
          <div className="architecture-flow-loading">
            <span>No nodes or edges found for diagram.</span>
          </div>
        )}

        {!error && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.28, minZoom: 0.2, maxZoom: 1.0 }}
            nodesDraggable={true}
            elementsSelectable={true}
            minZoom={0.2}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#cbd5e1" gap={16} size={1} />
            {showControls && <Controls showInteractive={false} />}
            {showMinimap && (
              <MiniMap
                nodeColor={(n) => {
                  if (n.type === 'user') return '#059669';
                  if (n.type === 'database') return '#4f46e5';
                  return '#0891b2';
                }}
                nodeStrokeWidth={2}
                zoomable
                pannable
              />
            )}
          </ReactFlow>
        )}

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <aside className="architecture-flow-drawer" role="dialog" aria-label="Node Metadata Inspector">
            <div className="architecture-flow-drawer-header">
              <div>
                <h4 className="architecture-flow-drawer-title">
                  {(selectedNode.data as any)?.label || selectedNode.id}
                </h4>
                <div className="architecture-flow-drawer-meta">
                  Type: <strong>{selectedNode.type?.toUpperCase()}</strong> • ID: <code>{selectedNode.id}</code>
                </div>
              </div>
              <button
                className="architecture-flow-drawer-close"
                onClick={() => setSelectedNode(null)}
                aria-label="Close Inspector"
              >
                <X size={16} />
              </button>
            </div>

            <div className="architecture-flow-drawer-body">
              {(selectedNode.data as any)?.subtitle && (
                <div className="architecture-flow-meta-row">
                  <span className="architecture-flow-meta-key">Role / Spec:</span>
                  <span className="architecture-flow-meta-val">
                    {(selectedNode.data as any).subtitle}
                  </span>
                </div>
              )}

              {Object.entries((selectedNode.data as any)?.metadata || {}).map(([k, v]) => (
                <div key={k} className="architecture-flow-meta-row">
                  <span className="architecture-flow-meta-key">{k}:</span>
                  <span className="architecture-flow-meta-val">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

// Export wrapper ensuring ReactFlowProvider context is always present
export const ArchitectureFlow: React.FC<ArchitectureFlowProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ArchitectureFlowInner {...props} />
    </ReactFlowProvider>
  );
};

export default ArchitectureFlow;
