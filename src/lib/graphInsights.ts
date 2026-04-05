import { GraphNode, GraphEdge } from './parser';

export interface GraphInsight {
  type: 'entry' | 'hotspot' | 'orphan' | 'core' | 'api';
  title: string;
  description: string;
  files: string[];
  severity: 'low' | 'medium' | 'high';
}

export function generateGraphInsights(nodes: GraphNode[], edges: GraphEdge[]): GraphInsight[] {
  const insights: GraphInsight[] = [];
  
  // 1. Calculate In-Degree and Out-Degree
  const inDegree: Record<string, number> = {};
  const outDegree: Record<string, number> = {};
  
  nodes.forEach(n => {
    inDegree[n.id] = 0;
    outDegree[n.id] = 0;
  });
  
  edges.forEach(e => {
    if (outDegree[e.source] !== undefined) outDegree[e.source]++;
    if (inDegree[e.target] !== undefined) inDegree[e.target]++;
  });

  // 2. Identify Entry Points (Out-degree > 0, In-degree == 0)
  const entryPoints = nodes.filter(n => inDegree[n.id] === 0 && outDegree[n.id] > 0);
  if (entryPoints.length > 0) {
    insights.push({
      type: 'entry',
      title: 'Application Entry Points',
      description: `Discovered ${entryPoints.length} root-level entry point(s). These are the sources of architectural flow.`,
      files: entryPoints.map(n => n.id),
      severity: 'low'
    });
  }

  // 3. Identify Hotspots (High In-degree)
  const sortedByInDegree = [...nodes].sort((a, b) => (inDegree[b.id] || 0) - (inDegree[a.id] || 0));
  // Dynamic threshold: at least 3 connections or top 5% of nodes
  const dThreshold = Math.max(3, Math.floor(nodes.length * 0.05));
  const hotspots = sortedByInDegree.slice(0, 5).filter(n => (inDegree[n.id] || 0) >= dThreshold);
  if (hotspots.length > 0) {
    insights.push({
      type: 'hotspot',
      title: 'Architectural Gravity Hubs',
      description: 'Frequently imported files that act as dependency hubs. Changes here have high blast radius.',
      files: hotspots.map(n => n.id),
      severity: 'high'
    });
  }

  // 4. Identify Orphans (In-degree == 0, excluding entry points and common configs)
  const ignores = ['package.json', 'tsconfig.json', 'README.md', '.gitignore', 'vite.config', 'tailwind.config', 'next.config'];
  const orphans = nodes.filter(n => 
    (inDegree[n.id] || 0) === 0 && 
    (outDegree[n.id] || 0) === 0 && 
    !ignores.some(ig => n.id.toLowerCase().includes(ig.toLowerCase()))
  );
  if (orphans.length > 0) {
    insights.push({
      type: 'orphan',
      title: 'Potential Orphan Files',
      description: 'Nodes with zero incoming or outgoing connections. These might be dead code or newly added fragments.',
      files: orphans.map(n => n.id),
      severity: 'medium'
    });
  }

  // 5. Identify Core Logic (Highest Out-degree)
  const coreModules = [...nodes]
    .sort((a, b) => (outDegree[b.id] || 0) - (outDegree[a.id] || 0))
    .slice(0, 3)
    .filter(n => (outDegree[n.id] || 0) >= 2);

  if (coreModules.length > 0) {
    insights.push({
      type: 'core',
      title: 'Core Business Engines',
      description: 'Internal components driving system logic. These orchestrate multiple sub-dependencies.',
      files: coreModules.map(n => n.id),
      severity: 'low'
    });
  }

  // 6. API Structure Overview
  const apiFiles = nodes.filter(n => 
    n.id.toLowerCase().includes('/api/') || 
    n.id.toLowerCase().includes('routes') || 
    n.id.toLowerCase().includes('controller')
  );
  if (apiFiles.length > 0) {
    insights.push({
      type: 'api',
      title: 'API Surface Area',
      description: `Mapped ${apiFiles.length} endpoint-related modules defining the project's external interface.`,
      files: apiFiles.map(n => n.id),
      severity: 'low'
    });
  }

  return insights;
}
