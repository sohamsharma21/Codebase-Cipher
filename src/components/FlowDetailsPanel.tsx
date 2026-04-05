import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Database, Route, Server, Layers, Shield, Zap } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import type { NodeRole, DatabaseInteraction, ExecutionFlow } from '@/types';

interface FlowDetailsPanelProps {
  selectedFile: string;
  nodes: Node[];
  edges: Edge[];
  dbInteractions: DatabaseInteraction[];
  executionFlows: ExecutionFlow[];
  onSelectFile: (path: string) => void;
}

const roleConfig: Record<NodeRole, { icon: typeof Route; color: string; label: string }> = {
  entry: { icon: Zap, color: 'hsl(var(--green))', label: 'Entry Point' },
  route: { icon: Route, color: 'hsl(var(--primary))', label: 'API Route' },
  service: { icon: Server, color: 'hsl(var(--purple))', label: 'Service' },
  database: { icon: Database, color: 'hsl(var(--orange))', label: 'Data Layer' },
  middleware: { icon: Shield, color: 'hsl(var(--yellow))', label: 'Middleware' },
  component: { icon: Layers, color: 'hsl(var(--primary))', label: 'UI Component' },
  utility: { icon: Zap, color: 'hsl(var(--muted-foreground))', label: 'Utility' },
  config: { icon: Route, color: 'hsl(var(--muted-foreground))', label: 'Config' },
  model: { icon: Database, color: 'hsl(var(--orange))', label: 'Model' },
  test: { icon: Zap, color: 'hsl(var(--muted-foreground))', label: 'Test' },
};

export default function FlowDetailsPanel({ selectedFile, nodes, edges, dbInteractions, executionFlows, onSelectFile }: FlowDetailsPanelProps) {
  const node = nodes.find(n => n.id === selectedFile);
  const role: NodeRole = (node?.data as any)?.role || 'utility';
  const config = roleConfig[role];
  const Icon = config.icon;

  const incoming = useMemo(() =>
    edges.filter(e => e.target === selectedFile).map(e => ({
      file: e.source,
      edgeType: (e as any).edgeType || 'import',
    })),
    [edges, selectedFile]
  );

  const outgoing = useMemo(() =>
    edges.filter(e => e.source === selectedFile).map(e => ({
      file: e.target,
      edgeType: (e as any).edgeType || 'import',
    })),
    [edges, selectedFile]
  );

  const fileDbOps = useMemo(() =>
    dbInteractions.filter(d => d.file === selectedFile),
    [dbInteractions, selectedFile]
  );

  const relatedFlows = useMemo(() =>
    executionFlows.filter(f => f.steps.some(s => s.file === selectedFile)),
    [executionFlows, selectedFile]
  );

  return (
    <div className="border-t border-border bg-card/50 p-3 space-y-3 max-h-[280px] overflow-y-auto">
      {/* Role badge */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${config.color}20` }}>
          <Icon className="w-3 h-3" style={{ color: config.color }} />
        </div>
        <div>
          <span className="text-xs font-medium" style={{ color: config.color }}>{config.label}</span>
          <span className="text-[10px] text-muted-foreground ml-2">{selectedFile.split('/').pop()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Incoming */}
        <div>
          <h4 className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3" /> Imported by ({incoming.length})
          </h4>
          <div className="space-y-0.5">
            {incoming.slice(0, 6).map((dep, i) => (
              <button key={i} onClick={() => onSelectFile(dep.file)}
                className="w-full text-left text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-secondary text-foreground truncate transition-colors">
                {dep.file.split('/').pop()}
              </button>
            ))}
            {incoming.length === 0 && <span className="text-[10px] text-muted-foreground">None</span>}
          </div>
        </div>

        {/* Outgoing */}
        <div>
          <h4 className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Imports ({outgoing.length})
          </h4>
          <div className="space-y-0.5">
            {outgoing.slice(0, 6).map((dep, i) => (
              <button key={i} onClick={() => onSelectFile(dep.file)}
                className="w-full text-left text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-secondary text-foreground truncate transition-colors">
                {dep.file.split('/').pop()}
              </button>
            ))}
            {outgoing.length === 0 && <span className="text-[10px] text-muted-foreground">None</span>}
          </div>
        </div>
      </div>

      {/* DB Operations */}
      {fileDbOps.length > 0 && (
        <div>
          <h4 className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Database className="w-3 h-3 text-[hsl(var(--orange))]" /> Database Operations ({fileDbOps.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {fileDbOps.map((d, i) => (
              <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[hsl(var(--orange))]/10 text-[hsl(var(--orange))]">
                {d.operation}{d.model ? `(${d.model})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Related Flows */}
      {relatedFlows.length > 0 && (
        <div>
          <h4 className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Route className="w-3 h-3 text-primary" /> Part of Flows ({relatedFlows.length})
          </h4>
          <div className="space-y-0.5">
            {relatedFlows.slice(0, 4).map((f, i) => (
              <div key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/5 text-foreground truncate">
                {f.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
