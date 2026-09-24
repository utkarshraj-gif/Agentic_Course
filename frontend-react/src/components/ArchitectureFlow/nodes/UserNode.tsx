// src/components/ArchitectureFlow/nodes/UserNode.tsx
// User / Client Architecture Node

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { User, Smartphone } from 'lucide-react';

export interface UserNodeData {
  label: string;
  subtitle?: string;
  metadata?: Record<string, any>;
}

export const UserNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as UserNodeData;
  const isMobile = nodeData.metadata?.channel === 'Mobile';

  return (
    <div className={`flow-node flow-node--user ${selected ? 'flow-node--selected' : ''}`}>
      {/* Multi-directional anchor handles */}
      <Handle type="target" position={Position.Top} id="top-target" className="flow-handle" />
      <Handle type="source" position={Position.Top} id="top" className="flow-handle" />

      <Handle type="target" position={Position.Left} id="left-target" className="flow-handle" />
      <Handle type="source" position={Position.Left} id="left" className="flow-handle" />

      <div className="flow-node-inner">
        <div className="flow-node-icon-wrap flow-node-icon-wrap--user">
          {isMobile ? <Smartphone size={16} /> : <User size={16} />}
        </div>
        <div className="flow-node-content">
          <div className="flow-node-type-label">ACTOR / CLIENT</div>
          <div className="flow-node-title">{nodeData.label}</div>
          {nodeData.subtitle && (
            <div className="flow-node-subtitle">{nodeData.subtitle}</div>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Right} id="right-target" className="flow-handle" />
      <Handle type="source" position={Position.Right} id="right" className="flow-handle" />

      <Handle type="target" position={Position.Bottom} id="bottom-target" className="flow-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="flow-handle" />
    </div>
  );
};
