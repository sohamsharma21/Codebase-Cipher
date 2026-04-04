import React, { useState, useEffect } from 'react';
import { Activity, Clock, FileKey, Network, Zap, Cpu, Database } from 'lucide-react';
import type { PerformanceMetrics } from '@/types';

interface TelemetryPanelProps {
  metrics: PerformanceMetrics | null;
}

export default function TelemetryPanel({ metrics }: TelemetryPanelProps) {
  const [llmLatency, setLlmLatency] = useState<number | null>(null);

  useEffect(() => {
    const handleLlmEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ duration: number }>;
      setLlmLatency(customEvent.detail.duration);
    };
    
    window.addEventListener('gitvizz:llm-metrics', handleLlmEvent);
    return () => window.removeEventListener('gitvizz:llm-metrics', handleLlmEvent);
  }, []);

  if (!metrics) return null;

  return (
    <div className="absolute bottom-4 left-4 z-50 bg-background/60 backdrop-blur-md border border-border/50 rounded-xl p-4 shadow-2xl animate-in slide-in-from-bottom-5 duration-500 w-[300px]">
      <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
        <div className="flex items-center gap-2 text-foreground/90">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider">System Telemetry</h3>
        </div>
        {metrics.cached && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
            Cached
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-bold">Parse Time</span>
          </div>
          <span className="text-sm font-mono text-foreground font-semibold">{metrics.duration}ms</span>
        </div>

        <div className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FileKey className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-bold">Files Processed</span>
          </div>
          <span className="text-sm font-mono text-foreground font-semibold">{metrics.filesAnalyzed}</span>
        </div>

        <div className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Database className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-bold">Graph Size</span>
          </div>
          <span className="text-sm font-mono text-foreground font-semibold">
            {metrics.nodesCount + metrics.edgesCount} ent
          </span>
        </div>

        <div className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Network className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-bold">Connections</span>
          </div>
          <span className="text-sm font-mono text-foreground font-semibold">
            {metrics.edgesCount}
          </span>
        </div>
        
        <div className="col-span-2 flex flex-col gap-1 p-2 rounded-lg bg-primary/5 border border-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-primary/80">
              <Cpu className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase font-bold">LLM Latency (Last Request)</span>
            </div>
            <Zap className="w-3 h-3 text-amber-400" />
          </div>
          <span className="text-sm font-mono text-foreground font-semibold">
            {llmLatency ? `${llmLatency}ms` : 'Waiting...'}
          </span>
        </div>
      </div>
    </div>
  );
}
