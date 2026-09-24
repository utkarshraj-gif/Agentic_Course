// src/components/ArchitectureFlow/nodes/DatabaseNode.tsx
// Database & Storage Architecture Node with distinctive cylindrical geometry

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Sparkles, HardDrive } from 'lucide-react';

export interface DatabaseNodeData {
  label: string;
  subtitle?: string;
  metadata?: Record<string, any>;
}

export const DatabaseNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as DatabaseNodeData;
  const isLLM = nodeData.label.toLowerCase().includes('llm') || nodeData.label.toLowerCase().includes('openai');

  return (
    <div className={`flow-node flow-node--database flow-node--cylinder ${selected ? 'flow-node--selected' : ''}`}>
      {/* Multi-directional anchor handles */}
      <Handle type="target" position={Position.Top} id="top-target" className="flow-handle" />
      <Handle type="source" position={Position.Top} id="top" className="flow-handle" />

      <Handle type="target" position={Position.Left} id="left-target" className="flow-handle" />
      <Handle type="source" position={Position.Left} id="left" className="flow-handle" />

      {/* Top cylinder ellipse cap */}
      <div className="cylinder-cap cylinder-cap--top" />

      <div className="flow-node-inner cylinder-body">
        <div className="flow-node-icon-wrap flow-node-icon-wrap--database">
          {isLLM ? <Sparkles size={16} /> : <HardDrive size={16} />}
        </div>
        <div className="flow-node-content">
          <div className="flow-node-type-label">
            {isLLM ? 'MODEL / INFERENCE' : 'DATA STORE / LEDGER'}
          </div>
          <div className="flow-node-title">{nodeData.label}</div>
          {nodeData.subtitle && (
            <div className="flow-node-subtitle">{nodeData.subtitle}</div>
          )}
        </div>
      </div>

      {/* Bottom cylinder curved rim */}
      <div className="cylinder-cap cylinder-cap--bottom" />

      <Handle type="target" position={Position.Right} id="right-target" className="flow-handle" />
      <Handle type="source" position={Position.Right} id="right" className="flow-handle" />

      <Handle type="target" position={Position.Bottom} id="bottom-target" className="flow-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="flow-handle" />
    </div>
  );
};
