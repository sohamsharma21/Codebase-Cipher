import { useMemo } from 'react';
import { Zap, FileWarning, Star, Clock, Database, GitFork, Layers, TrendingUp } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import type { ParsedFunction, PerformanceMetrics } from '@/types';

interface InsightsPanelProps {
  nodes: Node[];
  edges: Edge[];
  functionMap: Record<string, ParsedFunction[]>;
  metrics: PerformanceMetrics | null;
  onSelectFile: (path: string) => void;
}

export default function InsightsPanel({ nodes, edges, functionMap, metrics, onSelectFile }: InsightsPanelProps) {
  // Entry points: files with no incoming edges (nothing imports them) but have outgoing edges
  const entryPoints = useMemo(() => {
    const imported = new Set(edges.map(e => e.target));
    const hasOutgoing = new Set(edges.map(e => e.source));
    return nodes
      .filter(n => !imported.has(n.id) && hasOutgoing.has(n.id))
      .map(n => n.id)
      .slice(0, 10);
  }, [nodes, edges]);

  // Most connected files (hub files)
  const hubFiles = useMemo(() => {
    const counts: Record<string, number> = {};
    edges.forEach(e => {
      counts[e.source] = (counts[e.source] || 0) + 1;
      counts[e.target] = (counts[e.target] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([path, count]) => ({ path, connections: count }));
  }, [edges]);

  // Orphan files (no connections)
  const orphanFiles = useMemo(() => {
    const connected = new Set<string>();
    edges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    return nodes.filter(n => !connected.has(n.id)).map(n => n.id).slice(0, 10);
  }, [nodes, edges]);

  // Function stats
  const fnStats = useMemo(() => {
    let total = 0;
    let maxFns = { file: '', count: 0 };
    for (const [file, fns] of Object.entries(functionMap)) {
      total += fns.length;
      if (fns.length > maxFns.count) maxFns = { file, count: fns.length };
    }
    return { total, maxFns };
  }, [functionMap]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Performance Metrics */}
      {metrics && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-primary" />Performance Metrics
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Analysis Time', value: `${(metrics.duration / 1000).toFixed(1)}s`, icon: Clock },
              { label: 'Files Parsed', value: metrics.filesAnalyzed.toString(), icon: Database },
              { label: 'Graph Nodes', value: metrics.nodesCount.toString(), icon: Layers },
              { label: 'Connections', value: metrics.edgesCount.toString(), icon: GitFork },
            ].map(m => (
              <div key={m.label} className="text-center p-2 rounded-md bg-secondary/50">
                <m.icon className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{m.value}</p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
            <span>🔧 Functions: {metrics.functionsCount}</span>
            <span>🌐 Endpoints: {metrics.endpointsCount}</span>
            {metrics.dbInteractionsCount > 0 && <span>🗄️ DB Ops: {metrics.dbInteractionsCount}</span>}
            {metrics.flowsCount > 0 && <span>🔀 Flows: {metrics.flowsCount}</span>}
            {metrics.cached && <span className="text-primary">⚡ Served from cache</span>}
          </div>
        </div>
      )}

      {/* Entry Points */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-medium text-foreground mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[hsl(var(--green))]" />Entry Points
          <span className="text-[10px] text-muted-foreground ml-auto">{entryPoints.length} found</span>
        </h3>
        {entryPoints.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No clear entry points detected</p>
        ) : (
          <div className="space-y-1">
            {entryPoints.map(f => (
              <button key={f} onClick={() => onSelectFile(f)}
                className="w-full text-left text-[10px] font-mono px-2 py-1 rounded hover:bg-secondary text-foreground truncate transition-colors">
                ⚡ {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hub Files (Most Important) */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-medium text-foreground mb-3 flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-[hsl(var(--orange))]" />Most Important Files
        </h3>
        <div className="space-y-1.5">
          {hubFiles.map((f, i) => (
            <div key={f.path} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
              <button onClick={() => onSelectFile(f.path)}
                className="text-[10px] font-mono text-foreground hover:text-primary truncate flex-1 text-left transition-colors">
                {f.path.split('/').pop()}
              </button>
              <div className="flex items-center gap-1">
                <div className="h-1.5 rounded-full bg-primary/30 w-12 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (f.connections / (hubFiles[0]?.connections || 1)) * 100)}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-4 text-right">{f.connections}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Orphan / Unused Files */}
      {orphanFiles.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-foreground mb-3 flex items-center gap-2">
            <FileWarning className="w-3.5 h-3.5 text-[hsl(var(--orange))]" />Unused Files
            <span className="text-[10px] text-muted-foreground ml-auto">{orphanFiles.length} orphans</span>
          </h3>
          <div className="space-y-1">
            {orphanFiles.map(f => (
              <button key={f} onClick={() => onSelectFile(f)}
                className="w-full text-left text-[10px] font-mono px-2 py-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground truncate transition-colors">
                ⚠️ {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Function Stats */}
      {fnStats.total > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--purple))]" />Function Analysis
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-2 rounded-md bg-secondary/50">
              <p className="text-lg font-bold text-foreground">{fnStats.total}</p>
              <p className="text-muted-foreground">Total Functions</p>
            </div>
            <div className="p-2 rounded-md bg-secondary/50">
              <p className="text-lg font-bold text-foreground">{Object.keys(functionMap).length}</p>
              <p className="text-muted-foreground">Files with Functions</p>
            </div>
          </div>
          {fnStats.maxFns.file && (
            <button onClick={() => onSelectFile(fnStats.maxFns.file)}
              className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              Most complex: <span className="font-mono text-primary">{fnStats.maxFns.file.split('/').pop()}</span> ({fnStats.maxFns.count} functions)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
