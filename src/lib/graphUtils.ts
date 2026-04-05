import type { Node, Edge } from '@xyflow/react';

export interface CycleInfo {
  cycle: string[];
  edgeIds: string[];
}

export function detectCircularDeps(nodes: Node[] = [], edges: Edge[] = []): CycleInfo[] {
  const graph: Record<string, string[]> = {};
  edges.forEach(e => {
    if (!graph[e.source]) graph[e.source] = [];
    graph[e.source].push(e.target);
  });

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];
  // Bug #9 fix: Track seen cycle signatures to prevent duplicates
  const seenCycleKeys = new Set<string>();

  function dfs(node: string, path: string[]) {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of (graph[node] || [])) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (inStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        // Normalize: rotate cycle so the smallest ID comes first
        const minIdx = cycle.indexOf(cycle.reduce((a, b) => a < b ? a : b));
        const normalized = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
        const key = normalized.join('->');
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key);
          cycles.push(cycle);
        }
      }
    }
    inStack.delete(node);
  }

  nodes.forEach(n => {
    if (!visited.has(n.id)) dfs(n.id, []);
  });

  // Map cycles to edge IDs
  return cycles.map(cycle => {
    const edgeIds: string[] = [];
    for (let i = 0; i < cycle.length; i++) {
      const src = cycle[i];
      const tgt = cycle[(i + 1) % cycle.length];
      const edge = edges.find(e => e.source === src && e.target === tgt);
      if (edge) edgeIds.push(edge.id);
    }
    return { cycle, edgeIds };
  });
}

export interface HealthStats {
  totalFiles: number;
  jsFiles: number;
  tsFiles: number;
  configFiles: number;
  circularDeps: number;
  orphanFiles: string[];
  deadFiles: string[];
  avgImports: number;
  largeFiles: number;
  topComplex: { path: string; imports: number }[];
  score: number;
}

export function calculateHealth(nodes: Node[] = [], edges: Edge[] = [], cycles: CycleInfo[] = []): HealthStats {
  const jsFiles = nodes.filter(n => /\.(js|jsx|mjs|cjs)$/.test(n.id)).length;
  const tsFiles = nodes.filter(n => /\.(ts|tsx)$/.test(n.id)).length;
  const configFiles = nodes.filter(n => /\.(json|yaml|yml|toml)$/.test(n.id)).length;

  // Count imports per file (outgoing edges)
  const importCounts: Record<string, number> = {};
  nodes.forEach(n => { importCounts[n.id] = 0; });
  edges.forEach(e => { importCounts[e.source] = (importCounts[e.source] || 0) + 1; });

  const totalImports = Object.values(importCounts).reduce((a, b) => a + b, 0);
  const avgImports = nodes.length > 0 ? totalImports / nodes.length : 0;

  // Orphan files: not imported by anyone and not an entry point (no incoming edges, has no outgoing)
  const imported = new Set(edges.map(e => e.target));
  const hasOutgoing = new Set(edges.map(e => e.source));
  const orphanFiles = nodes
    .filter(n => !imported.has(n.id) && !hasOutgoing.has(n.id))
    .map(n => n.id);

  // Top complex
  const topComplex = Object.entries(importCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, imports]) => ({ path, imports }));

  // Large files placeholder (we don't have line counts, estimate by content)
  const largeFiles = 0;

  // Dead files prediction
  const entryPoints = nodes.filter(n => n.data?.isEntry).map(n => n.id);
  const reachable = new Set<string>();
  const queue = [...entryPoints];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    
    // Find all files that current imports
    const importedNodes = edges
      .filter(e => e.source === current)
      .map(e => e.target);
    queue.push(...importedNodes);
  }
  
  const deadFiles = nodes
    .filter(n => !reachable.has(n.id))
    .filter(n => !n.data?.isConfig) // ignore config files
    .map(n => n.id);

  let score = 100;
  score -= Math.min(cycles.length * 10, 40);
  if (avgImports > 8) score -= 10;
  if (avgImports > 15) score -= 10;
  score -= Math.min(orphanFiles.length * 5, 20);
  score -= Math.min(deadFiles.length * 2, 20); // Dead code penalty
  score -= Math.min(largeFiles * 5, 20);
  score = Math.max(0, score);

  return {
    totalFiles: nodes.length,
    jsFiles,
    tsFiles,
    configFiles,
    circularDeps: cycles.length,
    orphanFiles,
    deadFiles,
    avgImports: Math.round(avgImports * 10) / 10,
    largeFiles,
    topComplex,
    score,
  };
}
