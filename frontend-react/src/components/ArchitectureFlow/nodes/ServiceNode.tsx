// src/components/ArchitectureFlow/nodes/ServiceNode.tsx
// Core Microservice / Agent Controller / Tool Architecture Node

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Cpu,
  Bot,
  Layers,
  FileText,
  ShieldCheck,
  Clock,
  Settings
} from 'lucide-react';

export interface ServiceNodeData {
  label: string;
  subtitle?: string;
  metadata?: Record<string, any>;
}

function getServiceIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes('controller') || l.includes('agent') || l.includes('sre')) return <Bot size={16} />;
  if (l.includes('tool') || l.includes('registry')) return <Layers size={16} />;
  if (l.includes('policy') || l.includes('catalogue')) return <FileText size={16} />;
  if (l.includes('member') || l.includes('eligibility') || l.includes('security')) return <ShieldCheck size={16} />;
  if (l.includes('turnaround') || l.includes('sla')) return <Clock size={16} />;
  if (l.includes('operator') || l.includes('k8s')) return <Cpu size={16} />;
  return <Settings size={16} />;
}

export const ServiceNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as ServiceNodeData;
  const icon = getServiceIcon(nodeData.label);

  return (
    <div className={`flow-node flow-node--service ${selected ? 'flow-node--selected' : ''}`}>
      {/* Multi-directional anchor handles */}
      <Handle type="target" position={Position.Top} id="top-target" className="flow-handle" />
      <Handle type="source" position={Position.Top} id="top" className="flow-handle" />

      <Handle type="target" position={Position.Left} id="left-target" className="flow-handle" />
      <Handle type="source" position={Position.Left} id="left" className="flow-handle" />

      <div className="flow-node-inner">
        <div className="flow-node-icon-wrap flow-node-icon-wrap--service">
          {icon}
        </div>
        <div className="flow-node-content">
          <div className="flow-node-type-label">SERVICE / AGENT</div>
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
