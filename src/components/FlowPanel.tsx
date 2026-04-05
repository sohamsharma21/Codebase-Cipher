import { useState, useMemo, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, ChevronRight, Route, Zap, Database, Server, Shield, ArrowRight, Layers } from 'lucide-react';
import type { ExecutionFlow, FlowStep, DatabaseInteraction, ArchitectureLayers } from '@/types';

interface FlowPanelProps {
  flows: ExecutionFlow[];
  dbInteractions: DatabaseInteraction[];
  dbFrameworks: string[];
  layers: ArchitectureLayers;
  onSelectFile: (path: string) => void;
  onHighlightFlow: (fileIds: string[]) => void;
}

const stepTypeConfig: Record<FlowStep['type'], { icon: typeof Route; color: string; label: string }> = {
  route: { icon: Route, color: 'hsl(var(--primary))', label: 'Route' },
  handler: { icon: Zap, color: 'hsl(var(--green))', label: 'Handler' },
  service: { icon: Server, color: 'hsl(var(--purple))', label: 'Service' },
  database: { icon: Database, color: 'hsl(var(--orange))', label: 'Database' },
  middleware: { icon: Shield, color: 'hsl(var(--yellow))', label: 'Middleware' },
  response: { icon: ArrowRight, color: 'hsl(var(--green))', label: 'Response' },
  ui: { icon: Layers, color: 'hsl(var(--primary))', label: 'UI' },
};

export default function FlowPanel({ flows, dbInteractions, dbFrameworks, layers, onSelectFile, onHighlightFlow }: FlowPanelProps) {
  const [selectedFlow, setSelectedFlow] = useState<number | null>(null);
  const [animatingStep, setAnimatingStep] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'flows' | 'db' | 'architecture'>('flows');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flow = selectedFlow !== null ? flows[selectedFlow] : null;

  // Animate flow steps
  useEffect(() => {
    if (isPlaying && flow) {
      intervalRef.current = setInterval(() => {
        setAnimatingStep(prev => {
          const next = prev + 1;
          if (next >= flow.steps.length) {
            setIsPlaying(false);
            return -1;
          }
          return next;
        });
      }, 800);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
  }, [isPlaying, flow]);

  // Highlight flow files on graph
  useEffect(() => {
    if (flow && animatingStep >= 0) {
      const files = flow.steps.slice(0, animatingStep + 1).map(s => s.file);
      onHighlightFlow([...new Set(files)]);
    } else if (flow) {
      onHighlightFlow(flow.steps.map(s => s.file));
    } else {
      onHighlightFlow([]);
    }
  }, [flow, animatingStep, onHighlightFlow]);

  const handlePlay = () => {
    setAnimatingStep(0);
    setIsPlaying(true);
  };

  const handleStep = () => {
    if (!flow) return;
    setAnimatingStep(prev => {
      const next = prev + 1;
      return next >= flow.steps.length ? -1 : next;
    });
  };

  // Group DB interactions by framework
  const dbByFramework = useMemo(() => {
    const map: Record<string, DatabaseInteraction[]> = {};
    dbInteractions.forEach(d => {
      if (!map[d.framework]) map[d.framework] = [];
      map[d.framework].push(d);
    });
    return map;
  }, [dbInteractions]);

  const tabs = [
    { id: 'flows' as const, label: 'Execution Flows', count: flows.length },
    { id: 'db' as const, label: 'Database', count: dbInteractions.length },
    { id: 'architecture' as const, label: 'Architecture', count: 0 },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Sub-tabs */}
      <div className="flex border-b border-border px-3 py-1 gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${activeTab === t.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label} {t.count > 0 && <span className="ml-1 opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {activeTab === 'flows' && (
        <div className="p-3 space-y-3">
          {flows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-8">No execution flows detected. Try analyzing a project with API endpoints.</p>
          ) : (
            <>
              {/* Flow list */}
              {selectedFlow === null ? (
                <div className="space-y-1.5">
                  {flows.map((f, i) => (
                    <button key={i} onClick={() => setSelectedFlow(i)}
                      className="w-full text-left p-2.5 rounded-lg bg-card border border-border hover:border-primary/40 transition-all group">
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                          f.type === 'api' ? 'bg-primary/20 text-primary' : 'bg-[hsl(var(--green))]/20 text-[hsl(var(--green))]'
                        }`}>
                          {f.type === 'api' ? '→' : '⚡'}
                        </div>
                        <span className="text-xs font-medium text-foreground truncate flex-1">{f.name}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 ml-7">
                        <span className="text-[10px] text-muted-foreground">{f.trigger}</span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">{f.steps.length} steps</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {/* Flow detail */}
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => { setSelectedFlow(null); setAnimatingStep(-1); setIsPlaying(false); onHighlightFlow([]); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground">← Back</button>
                    <span className="text-xs font-medium text-foreground flex-1 truncate">{flow?.name}</span>
                    <button onClick={handlePlay} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Animate">
                      {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    </button>
                    <button onClick={handleStep} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Step">
                      <SkipForward className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Flow steps */}
                  <div className="space-y-0">
                    {flow?.steps.map((step, i) => {
                      const config = stepTypeConfig[step.type];
                      const Icon = config.icon;
                      const isActive = animatingStep === i;
                      const isPast = animatingStep > i;
                      const isFuture = animatingStep >= 0 && animatingStep < i;

                      return (
                        <div key={i} className="relative">
                          {i > 0 && (
                            <div className="absolute left-[13px] -top-1 w-px h-2" style={{
                              background: isPast ? config.color : 'hsl(var(--border))',
                              transition: 'background 0.3s',
                            }} />
                          )}
                          <button onClick={() => onSelectFile(step.file)}
                            className={`w-full text-left flex items-start gap-2.5 p-2 rounded-lg transition-all ${
                              isActive ? 'bg-primary/10 ring-1 ring-primary/30 scale-[1.02]' : 'hover:bg-secondary/50'
                            }`}
                            style={{ opacity: isFuture ? 0.3 : 1, transition: 'opacity 0.3s, transform 0.3s' }}>
                            <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: `${config.color}20` }}>
                              <Icon className="w-3 h-3" style={{ color: config.color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-medium" style={{ color: config.color }}>{config.label}</div>
                              <div className="text-xs text-foreground truncate">{step.action}</div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate">{step.file.split('/').pop()}</div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'db' && (
        <div className="p-3 space-y-3">
          {dbInteractions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-8">No database interactions detected.</p>
          ) : (
            <>
              {/* DB Framework summary */}
              {dbFrameworks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {dbFrameworks.map(fw => (
                    <span key={fw} className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--orange))]/15 text-[hsl(var(--orange))] font-medium">
                      {fw}
                    </span>
                  ))}
                </div>
              )}

              {Object.entries(dbByFramework).map(([fw, interactions]) => (
                <div key={fw} className="bg-card border border-border rounded-lg p-3">
                  <h4 className="text-xs font-medium text-foreground mb-2 flex items-center gap-2">
                    <Database className="w-3 h-3 text-[hsl(var(--orange))]" />
                    {fw}
                    <span className="text-[10px] text-muted-foreground ml-auto">{interactions.length} operations</span>
                  </h4>
                  <div className="space-y-1">
                    {interactions.slice(0, 20).map((d, i) => (
                      <button key={i} onClick={() => onSelectFile(d.file)}
                        className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary/50 transition-colors">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          d.operation.match(/create|insert|add|save/) ? 'bg-[hsl(var(--green))]/15 text-[hsl(var(--green))]' :
                          d.operation.match(/delete|destroy|remove/) ? 'bg-destructive/15 text-destructive' :
                          d.operation.match(/update|upsert/) ? 'bg-[hsl(var(--orange))]/15 text-[hsl(var(--orange))]' :
                          'bg-primary/15 text-primary'
                        }`}>
                          {d.operation}
                        </span>
                        {d.model && <span className="text-[10px] font-mono text-foreground">{d.model}</span>}
                        <span className="text-[10px] text-muted-foreground ml-auto font-mono">{d.file.split('/').pop()}:{d.line}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === 'architecture' && (
        <div className="p-3 space-y-3">
          {[
            { key: 'frontend' as const, label: 'Frontend / UI', icon: Layers, color: 'var(--primary)' },
            { key: 'backend' as const, label: 'Backend / API', icon: Server, color: 'var(--green)' },
            { key: 'database' as const, label: 'Data Layer', icon: Database, color: 'var(--orange)' },
            { key: 'middleware' as const, label: 'Middleware', icon: Shield, color: 'var(--purple)' },
            { key: 'config' as const, label: 'Configuration', icon: Route, color: 'var(--yellow)' },
          ].map(layer => {
            const files = layers[layer.key] || [];
            if (files.length === 0) return null;
            const Icon = layer.icon;
            return (
              <div key={layer.key} className="bg-card border border-border rounded-lg p-3">
                <h4 className="text-xs font-medium text-foreground mb-2 flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" style={{ color: `hsl(${layer.color})` }} />
                  {layer.label}
                  <span className="text-[10px] text-muted-foreground ml-auto">{files.length} files</span>
                </h4>
                <div className="space-y-0.5">
                  {files.slice(0, 15).map(f => (
                    <button key={f} onClick={() => onSelectFile(f)}
                      className="w-full text-left text-[10px] font-mono px-2 py-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground truncate transition-colors">
                      {f}
                    </button>
                  ))}
                  {files.length > 15 && (
                    <span className="text-[10px] text-muted-foreground px-2">+{files.length - 15} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
