'use client';

import React, { useMemo } from 'react';
import ReactFlow, { Background, Node, Edge } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

type Todo = {
  id: number;
  title: string;
  dependencies?: Todo[] | null;
};

type GraphProps = {
  todos: Todo[]; 
  targetId?: string;
  nodeWidth?: number;
  nodeHeight?: number;
};

export const TodoGraph: React.FC<GraphProps> = ({
  todos,
  targetId,
  nodeWidth = 150,
  nodeHeight = 50,
}) => {
  const nodes: Node[] = useMemo(
    () =>
      todos.map((t) => ({
        id: t.id.toString(),
        data: { label: t.title },
        position: { x: 0, y: 0 },
      })),
    [todos]
  );

  const edges: Edge[] = useMemo(
    () =>
      todos.flatMap((todo) =>
        (todo.dependencies ?? []).map((dep) => ({
          id: `e${dep.id}-${todo.id}`,
          source: dep.id.toString(),
          target: todo.id.toString(),
        }))
      ),
    [todos]
  );

  // adjacency map + topo sort (Kahn)
  const { topoOrder, adj } = useMemo(() => {
    const adj = new Map<string, string[]>(); // u -> [v,...]
    const inDegree = new Map<string, number>();

    // initialize
    nodes.forEach((n) => {
      adj.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    edges.forEach((e) => {
      const u = e.source;
      const v = e.target;
      adj.get(u)!.push(v);
      inDegree.set(v, (inDegree.get(v) ?? 0) + 1);
    });

    // queue of zero in-degree nodes
    const q: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) q.push(id);
    });

    const topoOrder: string[] = [];
    while (q.length) {
      const u = q.shift()!;
      topoOrder.push(u);
      const neighbours = adj.get(u) ?? [];
      for (const v of neighbours) {
        inDegree.set(v, (inDegree.get(v) ?? 0) - 1);
        if ((inDegree.get(v) ?? 0) === 0) q.push(v);
      }
    }

    const hasCycle = topoOrder.length !== nodes.length;
    return { topoOrder, hasCycle, adj };
  }, [nodes, edges]);

  // longest path / earliest-start computation (based on topo order)
  const { earliestStart, predecessor, criticalNodeIds, criticalEdgeIds } = useMemo(() => {
    const duration = (_id: string) => 1;

    const ES = new Map<string, number>();
    const pred = new Map<string, string | null>();

    nodes.forEach((n) => ES.set(n.id, Number.NEGATIVE_INFINITY));

    const incoming = new Map<string, number>();
    nodes.forEach((n) => incoming.set(n.id, 0));
    edges.forEach((e) => incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1));

    incoming.forEach((count, id) => {
      if (count === 0) ES.set(id, 0);
    });

    // relax edges in topo order
    for (const u of topoOrder) {
      const uES = ES.get(u) ?? Number.NEGATIVE_INFINITY;
      const neighbours = adj.get(u) ?? [];
      for (const v of neighbours) {
        const cand = uES === Number.NEGATIVE_INFINITY ? Number.NEGATIVE_INFINITY : uES + duration(u);
        if (cand > (ES.get(v) ?? Number.NEGATIVE_INFINITY)) {
          ES.set(v, cand);
          pred.set(v, u);
        }
      }
    }

    // backtrack from targetId to find critical path
    const criticalNodeIds = new Set<string>();
    const criticalEdgeIds = new Set<string>();

    if (targetId && ES.has(targetId)) {
      const targetES = ES.get(targetId) ?? Number.NEGATIVE_INFINITY;
      if (targetES !== Number.NEGATIVE_INFINITY) {
        let cur: string | null | undefined = targetId;
        while (cur) {
          criticalNodeIds.add(cur);
          const p = pred.get(cur);
          if (p) {
            criticalEdgeIds.add(`e${p}-${cur}`);
            cur = p;
          } else break;
        }
      }
    }

    const earliestStartObj: Record<string, number> = {};
    ES.forEach((v, k) => {
      earliestStartObj[k] = v === Number.NEGATIVE_INFINITY ? Number.NEGATIVE_INFINITY : v;
    });

    const predecessorObj: Record<string, string | null> = {};
    pred.forEach((v, k) => {
      predecessorObj[k] = v ?? null;
    });

    return {
      earliestStart: earliestStartObj,
      predecessor: predecessorObj,
      criticalNodeIds,
      criticalEdgeIds,
    };
  }, [topoOrder, adj, edges, nodes, targetId]);

  const laidOutNodes = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', ranksep: 40, nodesep: 20 });

    nodes.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
    edges.forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);

    return nodes.map((n) => {
      const raw: any = g.node(n.id);
      const pos = raw ?? { x: 0, y: 0 };
      const es = earliestStart[n.id] ?? 0;
      const isCritical = criticalNodeIds.has(n.id);

      return {
        ...n,
        position: { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 },
        data: { label: `${(n.data?.label ?? '')}` },
        className: isCritical ? 'border-2 border-red-600 bg-red-50' : undefined,
        style: {
          ...(n.style ?? {}),
          boxShadow: isCritical ? '0 4px 12px rgba(220, 38, 38, 0.15)' : undefined,
        },
      };
    });
  }, [nodes, edges, earliestStart, criticalNodeIds, nodeWidth, nodeHeight]);

  const styledEdges: Edge[] = useMemo(() => {
    return edges.map((e) => {
      const isCritical = criticalEdgeIds.has(e.id);
      return {
        ...e,
        style: {
          stroke: isCritical ? '#dc2626' : '#999',
          strokeWidth: isCritical ? 3 : 1.5,
        },
        animated: isCritical,
      };
    });
  }, [edges, criticalEdgeIds]);

  // If cycle detected, show a fallback
  if (topoOrder.length === 0 || topoOrder.length !== nodes.length) {
    return (
      <div className="h-72 w-full border rounded p-4">
        <div className="text-sm text-red-600 mb-2">
          Cycle detected or graph invalid — cannot compute critical path.
        </div>
        <div style={{ height: 300 }}>
          <ReactFlow nodes={laidOutNodes} edges={styledEdges} fitView>
            <Background />
          </ReactFlow>
        </div>
      </div>
    );
  }

  return (
    <div className="h-96 w-full border rounded">
      <ReactFlow nodes={laidOutNodes} edges={styledEdges} fitView>
        <Background />
      </ReactFlow>
    </div>
  );
};

export default TodoGraph;
