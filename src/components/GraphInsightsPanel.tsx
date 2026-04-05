import React, { useMemo } from 'react';
import { generateGraphInsights } from '@/lib/graphInsights';
import { AlertCircle, Target, TrendingUp, Layers, Code, Zap } from 'lucide-react';

interface AnyNode { id: string; [key: string]: any; }
interface AnyEdge { id: string; source: string; target: string; [key: string]: any; }

interface GraphInsightsPanelProps {
  nodes: AnyNode[];
  edges: AnyEdge[];
}

const IconMap: Record<string, any> = {
  entry: Target,
  hotspot: TrendingUp,
  orphan: AlertCircle,
  core: Layers,
  api: Code,
};

const ColorMap: Record<string, string> = {
  low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  high: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

export default function GraphInsightsPanel({ nodes, edges }: GraphInsightsPanelProps) {
  const insights = useMemo(() => generateGraphInsights(
    nodes.map(n => ({ id: n.id, type: n.type || 'file', data: n.data || { label: n.id, filePath: n.id }, ...n })),
    edges.map(e => ({ id: e.id, source: e.source, target: e.target, ...e }))
  ), [nodes, edges]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-48">
        <Zap className="w-8 h-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No graph data yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Analyze a repository to see insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Graph Intelligence</h2>
      </div>

      {insights.map((insight, idx) => {
        const Icon = IconMap[insight.type] || Zap;
        return (
          <div key={idx} className="bg-card border border-border p-3 rounded-lg hover:border-primary/30 transition-all group shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`p-1.5 rounded-md ${ColorMap[insight.severity]}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-foreground/90 group-hover:text-primary transition-colors">{insight.title}</h3>
            </div>
            
            <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
              {insight.description}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {insight.files.map(file => (
                <div key={file} className="text-[9px] font-mono px-2 py-0.5 rounded bg-secondary/50 text-muted-foreground border border-border/50 truncate max-w-[200px]">
                  {file.split('/').pop()}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
