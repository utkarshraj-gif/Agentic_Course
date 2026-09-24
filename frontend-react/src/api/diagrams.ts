// src/api/diagrams.ts
// API Client for Dynamic Architecture & Process Flow Graph Definitions

import { API_BASE } from '../services/api';

export interface DiagramNodeData {
  id: string;
  label: string;
  subtitle?: string;
  type: 'user' | 'service' | 'database' | string;
  metadata?: Record<string, any>;
}

export interface DiagramEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  metadata?: Record<string, any>;
}

export interface DiagramGraph {
  id: string;
  name: string;
  direction: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP' | string;
  description?: string;
  nodes: DiagramNodeData[];
  edges: DiagramEdgeData[];
}

export interface DiagramSummary {
  id: string;
  name: string;
  category: string;
  nodeCount: number;
  edgeCount: number;
}

export const DiagramsApi = {
  /**
   * Fetch a full graph definition for interactive rendering
   */
  async getDiagram(diagramId: string = 'agent-architecture'): Promise<DiagramGraph> {
    const res = await fetch(`${API_BASE}/diagrams/${diagramId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to fetch diagram '${diagramId}' (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * List all available architecture diagrams
   */
  async listDiagrams(): Promise<DiagramSummary[]> {
    const res = await fetch(`${API_BASE}/diagrams`);
    if (!res.ok) {
      throw new Error(`Failed to list diagrams (HTTP ${res.status})`);
    }
    return res.json();
  }
};
