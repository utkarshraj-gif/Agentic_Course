// src/layout/elkLayout.ts
// Automatic hierarchical graph layout calculation using ELK.js (Eclipse Layout Kernel)

import ELK from 'elkjs/lib/elk.bundled.js';
import { Position } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';

// Instantiate reusable ELK engine
const elk = new ELK();

// Sensible default bounding dimensions for each semantic node archetype
export const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  user: { width: 200, height: 74 },
  service: { width: 230, height: 86 },
  database: { width: 210, height: 96 },
  default: { width: 220, height: 80 },
};

export interface LayoutOptions {
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP' | string;
  nodeNodeSpacing?: number;
  layerSpacing?: number;
}

/**
 * Computes deterministic layered layout positions using ELK.
 * Decouples backend topology completely from explicit x/y coordinates.
 */
export async function getLayoutedElements<T extends Record<string, any>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: string = 'RIGHT',
  options?: LayoutOptions
): Promise<{ nodes: Node<T>[]; edges: Edge[] }> {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const isHorizontal = direction === 'RIGHT' || direction === 'LEFT';

  // Configure ELK layered algorithm options
  const elkLayoutOptions: Record<string, string> = {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.spacing.nodeNode': String(options?.nodeNodeSpacing ?? 55),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(options?.layerSpacing ?? 95),
    'elk.spacing.edgeNode': '35',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '30',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
    'elk.edgeRouting': 'SPLINES',
  };

  // Convert React Flow nodes to ELK child nodes with bounding sizes
  const elkNodes = nodes.map((node) => {
    const nodeType = (node.type || 'default') as string;
    const defaults = NODE_DIMENSIONS[nodeType] || NODE_DIMENSIONS.default;
    const width = node.width || (node.data as any)?.width || defaults.width;
    const height = node.height || (node.data as any)?.height || defaults.height;

    return {
      id: node.id,
      width,
      height,
    };
  });

  // Convert edges to ELK directed connections
  const elkEdges = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const graph = {
    id: 'root',
    layoutOptions: elkLayoutOptions,
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    const layoutedGraph = await elk.layout(graph);
    const layoutedChildrenMap = new Map(
      (layoutedGraph.children || []).map((c) => [c.id, c])
    );

    // Map calculated coordinates and handle positions back to React Flow nodes
    const layoutedNodes: Node<T>[] = nodes.map((node) => {
      const elkNode = layoutedChildrenMap.get(node.id);

      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: {
          x: elkNode?.x ?? 0,
          y: elkNode?.y ?? 0,
        },
      };
    });

    // Intelligent handle routing to avoid collisions and display all arrows/loops cleanly
    let backwardCount = 0;
    const layoutedEdges: Edge[] = edges.map((edge) => {
      const srcNode = layoutedChildrenMap.get(edge.source);
      const tgtNode = layoutedChildrenMap.get(edge.target);

      if (!srcNode || !tgtNode) {
        return edge;
      }

      if (isHorizontal) {
        const dx = (tgtNode.x ?? 0) - (srcNode.x ?? 0);
        const dy = (tgtNode.y ?? 0) - (srcNode.y ?? 0);

        // Backward / feedback loop (e.g. J -> M or V -> P)
        if (dx < -30) {
          backwardCount++;
          const useTop = backwardCount % 2 === 1;
          return {
            ...edge,
            sourceHandle: useTop ? 'top' : 'bottom',
            targetHandle: useTop ? 'top-target' : 'bottom-target',
            type: 'smoothstep',
          };
        }

        // Vertical/stacked connection
        if (Math.abs(dx) <= 30 && Math.abs(dy) > 30) {
          return {
            ...edge,
            sourceHandle: dy > 0 ? 'bottom' : 'top',
            targetHandle: dy > 0 ? 'top-target' : 'bottom-target',
            type: 'smoothstep',
          };
        }

        // Standard forward horizontal connection
        return {
          ...edge,
          sourceHandle: 'right',
          targetHandle: 'left-target',
          type: 'smoothstep',
        };
      } else {
        // Vertical layout
        const dy = (tgtNode.y ?? 0) - (srcNode.y ?? 0);
        if (dy < -30) {
          backwardCount++;
          const useRight = backwardCount % 2 === 1;
          return {
            ...edge,
            sourceHandle: useRight ? 'right' : 'left',
            targetHandle: useRight ? 'right-target' : 'left-target',
            type: 'smoothstep',
          };
        }

        return {
          ...edge,
          sourceHandle: 'bottom',
          targetHandle: 'top-target',
          type: 'smoothstep',
        };
      }
    });

    return {
      nodes: layoutedNodes,
      edges: layoutedEdges,
    };
  } catch (error) {
    console.error('[ELK Layout] Layout calculation error:', error);
    // Graceful fallback to simple offset positioning if ELK fails
    const fallbackNodes = nodes.map((node, idx) => ({
      ...node,
      position: { x: (idx % 4) * 260, y: Math.floor(idx / 4) * 120 },
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
    }));
    return { nodes: fallbackNodes, edges };
  }
}
