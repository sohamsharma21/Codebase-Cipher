import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow, Background, MiniMap, useReactFlow,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange, type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ZoomIn, ZoomOut, Maximize2, Network, Globe, Activity, Filter, X, AlertTriangle, Search, Expand, Shrink, Crosshair, Lightbulb, Code2, Loader2, Zap, ArrowLeft } from 'lucide-react';
import CustomNode from './CustomNode';
import ClusterNode from './ClusterNode';
import { WorkflowNode, LaneNode } from './Nodes/RichNodes';
import { SmartEdge } from './Edges/SmartEdges';
import HealthReport from './HealthReport';
import InsightsPanel from './InsightsPanel';
import FunctionCallMap from './FunctionCallMap';
import HighPerformanceGraph from './HighPerformanceGraph';
import TelemetryPanel from './TelemetryPanel';
import type { RepoFile, APIEndpoint, ParsedFunction, PerformanceMetrics, AnalysisProgress } from '@/types';
import { detectCircularDeps, calculateHealth, type CycleInfo, type HealthStats } from '@/lib/graphUtils';
import { useClusteredGraph } from '@/hooks/useClusteredGraph';
import RepoIntelligenceOverlay from './RepoIntelligenceOverlay';
import { supabase } from '@/integrations/supabase/client';

interface CenterPanelProps {
  files: RepoFile[];
  nodes: Node[];
  edges: Edge[];
  endpoints: APIEndpoint[];
  functionMap: Record<string, ParsedFunction[]>;
  metrics: PerformanceMetrics | null;
  selectedFile?: string;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onNodeClick: (path: string) => void;
  onClearSelection: () => void;
  hasData: boolean;
  loading: boolean;
  progress: AnalysisProgress;
  currentFile?: string;
  repoName?: string;
}

const nodeTypes = { fileNode: CustomNode, clusterNode: ClusterNode, workflowNode: WorkflowNode, laneNode: LaneNode };
const edgeTypes = { smartEdge: SmartEdge };

const methodColors: Record<string, string> = {
  GET: '#3fb950', POST: '#58a6ff', PUT: '#d29922', DELETE: '#f85149', PATCH: '#bc8cff',
};

type FilterType = 'all' | 'js' | 'ts' | 'components' | 'circular' | 'orphan' | 'connected';

const filterLabels: Record<FilterType, string> = {
  all: 'All Files', js: 'JavaScript only', ts: 'TypeScript only',
  components: 'Components only', circular: 'Has circular dep', orphan: 'Orphan files', connected: 'Most connected (top 10)',
};

function ToolbarZoom() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => zoomIn()} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button>
      <button onClick={() => zoomOut()} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button>
      <button onClick={() => fitView({ padding: 0.1, duration: 300 })} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Fit view"><Maximize2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

const ROTATING_TIPS = [
  '💡 GitVizz detects circular dependencies automatically',
  '💡 Click any node to get an AI explanation',
  '💡 Use ⌘K / Ctrl+K to search files instantly',
  '💡 Red edges indicate circular dependencies',
  '💡 Hover over a node to see its connections',
  '💡 Use the Health tab to get a codebase score',
];

const ANALYSIS_STEPS = [
  { label: 'Repository connected', threshold: 1 },
  { label: 'File tree fetched', threshold: 2 },
  { label: 'Dependencies parsed', threshold: 3 },
  { label: 'Graph layout computed', threshold: 4 },
  { label: 'Analysis complete', threshold: 5 },
];

const LEGEND_ITEMS = [
  { color: '#f7df1e', label: 'JavaScript' },
  { color: '#3178c6', label: 'TypeScript' },
  { color: '#61dafb', label: 'React Component' },
  { color: '#cc6699', label: 'CSS / SCSS' },
  { color: '#ff6b35', label: 'JSON / Config' },
  { color: '#8b949e', label: 'Other' },
];

function GraphLegend() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        background: 'rgba(13,17,23,0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #30363d',
        borderRadius: 10,
        padding: collapsed ? '6px 12px' : '10px 14px',
        minWidth: 148,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#e6edf3', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Legend</span>
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}
        >
          {collapsed ? '[+]' : '[−]'}
        </button>
      </div>
      {!collapsed && (
        <>
          {LEGEND_ITEMS.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#8b949e' }}>{item.label}</span>
            </div>
          ))}
          <div style={{ height: 1, background: '#21262d', margin: '6px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <div style={{ width: 20, height: 2, background: '#30363d', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#8b949e' }}>Normal import</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <div style={{ width: 20, height: 2, background: '#58a6ff', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#8b949e' }}>Core dependency</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <div style={{ width: 20, height: 2, background: '#f85149', flexShrink: 0, borderTop: '2px dashed #f85149', borderBottom: 'none' }} />
            <span style={{ fontSize: 10, color: '#8b949e' }}>Circular dep ⚠️</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 11 }}>⭐</span>
            <span style={{ fontSize: 10, color: '#8b949e' }}>Entry point</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function CenterPanel({ files, nodes, edges, endpoints, functionMap, metrics, selectedFile, onNodesChange, onEdgesChange, onNodeClick, onClearSelection, hasData, loading, progress, currentFile, repoName }: CenterPanelProps) {
  const [activeTab, setActiveTab] = useState<'graph' | 'endpoints' | 'health' | 'insights' | 'functions' | 'advanced_graph'>('graph');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [highlightCycles, setHighlightCycles] = useState(false);
  const [graphSearch, setGraphSearch] = useState('');
  const [showGraphSearch, setShowGraphSearch] = useState(false);
  const [edgeExpl, setEdgeExpl] = useState<{ src?: string; tgt?: string; text: string; loading: boolean; x: number; y: number } | null>(null);
  const [graphMode, setGraphMode] = useState<'workflow' | 'dependency' | 'request' | 'data'>('workflow');
  const [tracerState, setTracerState] = useState<{ active: boolean, currentNodes: string[], selection?: string, running: boolean } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  const cycles = useMemo(() => hasData ? detectCircularDeps(nodes, edges) : [], [nodes, edges, hasData]);
  const healthStats = useMemo(() => hasData ? calculateHealth(nodes, edges, cycles) : null, [nodes, edges, cycles, hasData]);

  const cycleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    (cycles || []).forEach(c => c.cycle.forEach(id => ids.add(id)));
    return ids;
  }, [cycles]);

  // Keyboard Shortcuts: Escape, F, 1/2/3/4
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch(e.key.toLowerCase()) {
        case 'escape':
          onClearSelection();
          break;
        case 'f':
          if (activeTab === 'graph' || activeTab === 'advanced_graph') {
            reactFlowInstance.fitView({ duration: 800 });
          }
          break;
        case '1':
          setActiveTab('graph');
          break;
        case '2':
          setActiveTab('endpoints');
          break;
        case '3':
          setActiveTab('health');
          break;
        case '4':
          setActiveTab('insights');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, reactFlowInstance, onClearSelection]);

  const cycleEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    (cycles || []).forEach(c => c.edgeIds.forEach(id => ids.add(id)));
    return ids;
  }, [cycles]);

  // Request Tracer Animation loop
  useEffect(() => {
    if (!tracerState?.running) return;
    
    const currentFrontier = tracerState.currentNodes;
    const nextFrontier = new Set<string>();
    
    edges.forEach(e => {
      if (currentFrontier.includes(e.source) && !tracerState.currentNodes.includes(e.target)) {
         nextFrontier.add(e.target);
      }
    });

    if (nextFrontier.size === 0) {
      setTracerState(prev => prev ? { ...prev, running: false } : null);
      return;
    }

    const timer = setTimeout(() => {
       setTracerState(prev => prev ? { ...prev, currentNodes: [...prev.currentNodes, ...Array.from(nextFrontier)] } : null);
    }, 1000);

    return () => clearTimeout(timer);
  }, [tracerState, edges]);

  // Auto-start tracer on load and enforce tight view bounds
  useEffect(() => {
    if (hasData && nodes.length > 0 && !loading) {
      setGraphMode('request');
      const apiRoutes = nodes.filter(n => n.data.entityType === 'API_ROUTE');
      if (apiRoutes.length > 0) {
        const firstRoute = apiRoutes[0].id;
        setTracerState({ active: true, selection: firstRoute, currentNodes: [firstRoute], running: true });
      } else {
        const entryNodes = nodes.filter(n => n.data.entityType === 'ENTRY_POINT');
        if (entryNodes.length > 0) {
           const firstEntry = entryNodes[0].id;
           setTracerState({ active: true, selection: firstEntry, currentNodes: [firstEntry], running: true });
        }
      }
      
      // Auto-fit perfectly after small delay (to allow rendering)
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.05, duration: 800 });
      }, 300);
    }
  }, [hasData, loading, nodes.length, reactFlowInstance]);

  const clustered = useClusteredGraph(nodes, edges);

  // Bug #4 fix: Close filter dropdown on outside click
  useEffect(() => {
    if (!showFilterDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as globalThis.Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterDropdown]);

  const searchResults = useMemo(() => {
    if (!graphSearch.trim()) return [];
    const q = graphSearch.toLowerCase();
    return nodes
      .filter(n => n.id.toLowerCase().includes(q))
      .slice(0, 8)
      .map(n => n.id);
  }, [graphSearch, nodes]);

  const connectedNodeIds = useMemo(() => {
    if (!selectedFile) return new Set<string>();
    const ids = new Set<string>();
    ids.add(selectedFile);
    (edges || []).forEach(e => {
      if (e.source === selectedFile) ids.add(e.target);
      if (e.target === selectedFile) ids.add(e.source);
    });
    return ids;
  }, [selectedFile, edges]);

  const matchingNodeIds = useMemo(() => {
    if (filter === 'all') return null;
    const ids = new Set<string>();
    const nodeArr = nodes || [];
    const edgeArr = edges || [];

    if (filter === 'js') nodeArr.filter(n => /\.(js|jsx|mjs|cjs)$/.test(n.id)).forEach(n => ids.add(n.id));
    else if (filter === 'ts') nodeArr.filter(n => /\.(ts|tsx)$/.test(n.id)).forEach(n => ids.add(n.id));
    else if (filter === 'components') nodeArr.filter(n => /\.(jsx|tsx)$/.test(n.id)).forEach(n => ids.add(n.id));
    else if (filter === 'circular') (cycleNodeIds || []).forEach(id => ids.add(id));
    else if (filter === 'orphan') (healthStats?.orphanFiles || []).forEach(f => ids.add(f));
    else if (filter === 'connected') {
      const counts: Record<string, number> = {};
      edgeArr.forEach(e => { counts[e.source] = (counts[e.source] || 0) + 1; counts[e.target] = (counts[e.target] || 0) + 1; });
      Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([id]) => ids.add(id));
    }
    return ids;
  }, [filter, nodes, edges, cycleNodeIds, healthStats]);

  const styledNodes = useMemo(() =>
    clustered.visibleNodes.map(n => {
      if (n.type === 'clusterNode') return n;
      const isCycle = cycleNodeIds.has(n.id);
      const dimmedByFilter = matchingNodeIds !== null && !matchingNodeIds.has(n.id);
      const dimmedByCycle = highlightCycles && !isCycle;
      const isFocused = clustered.focusedNode === n.id;
      const isConnected = selectedFile ? connectedNodeIds.has(n.id) : true;
      const dimmedByFocus = selectedFile ? !isConnected : false;
      
      let modeOpacity = 1;
      if (tracerState?.active) {
        if (!tracerState.currentNodes.includes(n.id) && n.type !== 'laneNode') modeOpacity = 0.15;
      } else if (graphMode === 'request' && n.type !== 'laneNode') {
        if (n.data.entityType !== 'API_ROUTE') modeOpacity = 0.15;
      } else if (graphMode === 'data' && n.type !== 'laneNode') {
        if (n.data.entityType !== 'DATABASE' && n.data.entityType !== 'MODEL') modeOpacity = 0.15;
      }

      return {
        ...n,
        selected: n.id === selectedFile,
        style: {
          opacity: dimmedByFilter || dimmedByCycle || dimmedByFocus ? 0.15 : modeOpacity,
          transition: 'opacity 0.3s ease, filter 0.3s ease',
          ...(isCycle ? { filter: 'drop-shadow(0 0 8px #f85149)' } : {}),
          ...(isFocused ? { filter: 'drop-shadow(0 0 12px hsl(var(--primary)))' } : {}),
          ...(tracerState?.currentNodes.includes(n.id) ? { filter: 'drop-shadow(0 0 16px #58a6ff)' } : {}),
        },
      };
    }),
    [clustered.visibleNodes, selectedFile, cycleNodeIds, matchingNodeIds, highlightCycles, clustered.focusedNode, connectedNodeIds, graphMode, tracerState]
  );

  const styledEdges = useMemo(() =>
    clustered.visibleEdges.map(e => {
      const isCycle = cycleEdgeIds.has(e.id);
      const isSelected = e.source === selectedFile || e.target === selectedFile;
      const dimmed = highlightCycles && !isCycle;
      const isConnectedEdge = selectedFile ? (e.source === selectedFile || e.target === selectedFile) : true;
      const dimmedByFocus = selectedFile ? !isConnectedEdge : false;
      
      let modeOpacity = 1;
      if (tracerState?.active && !tracerState.currentNodes.includes(e.source) && !tracerState.currentNodes.includes(e.target)) modeOpacity = 0.08;

      return {
        ...e,
        style: {
          stroke: isCycle ? '#f85149' : isSelected ? '#58a6ff' : e.style?.stroke || 'hsl(var(--border))',
          strokeWidth: isCycle ? 2.5 : isSelected ? 2 : e.style?.strokeWidth || 1,
          opacity: dimmed || dimmedByFocus ? 0.08 : modeOpacity,
          transition: 'opacity 0.3s ease, stroke 0.3s ease',
          ...e.style,
        },
        markerEnd: { type: 'arrowclosed' as const, color: isCycle ? '#f85149' : isSelected ? '#58a6ff' : (typeof e.markerEnd === 'object' ? (e.markerEnd as any).color : 'hsl(var(--border))') },
      };
    }),
    [clustered.visibleEdges, selectedFile, cycleEdgeIds, highlightCycles, tracerState]
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === 'clusterNode') {
      clustered.toggleCluster(node.data.clusterId as string);
    } else {
      onNodeClick(node.id);
    }
  }, [onNodeClick, clustered.toggleCluster]);

  const handleEdgeClick = useCallback(async (e: React.MouseEvent, edge: Edge) => {
    e.stopPropagation();
    
    setEdgeExpl({ src: edge.source, tgt: edge.target, text: '', loading: true, x: e.clientX, y: e.clientY });
    
    const srcFile = files.find(f => f.path === edge.source);
    const tgtFile = files.find(f => f.path === edge.target);
    
    if (!srcFile || !tgtFile) {
      setEdgeExpl(prev => prev ? { ...prev, loading: false, text: "Files not found in local cache." } : null);
      return;
    }
    
    try {
      const prompt = `Explain why these two files are connected in one paragraph. Focus on the import purpose.
Source File (${srcFile.path}):
${srcFile.content?.slice(0, 500) || 'no content'}

Target File (${tgtFile.path}):
${tgtFile.content?.slice(0, 500) || 'no content'}`;
      
      const { data, error } = await supabase.functions.invoke('chat-with-code', {
        body: { messages: [{ role: 'user', content: prompt }] }
      });
      
      if (error) throw error;
      
      const explanation = data.content || data.reply || "No explanation returned.";
      setEdgeExpl(prev => prev ? { ...prev, loading: false, text: explanation } : null);
    } catch (err) {
      setEdgeExpl(prev => prev ? { ...prev, loading: false, text: "Failed to generate explanation." } : null);
    }
  }, [files]);

  const handleSearchSelect = useCallback((fileId: string) => {
    clustered.focusNode(fileId);
    onNodeClick(fileId);
    setGraphSearch('');
    setShowGraphSearch(false);
    setTimeout(() => {
      const node = reactFlowInstance.getNode(fileId);
      if (node) {
        reactFlowInstance.fitView({ nodes: [{ id: fileId }], padding: 0.5, duration: 400 });
      }
    }, 200);
  }, [clustered, onNodeClick, reactFlowInstance]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && activeTab === 'graph' && hasData) {
        e.preventDefault();
        setShowGraphSearch(prev => !prev);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, hasData]);

  // Rotating tips
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setTipIndex(i => (i + 1) % ROTATING_TIPS.length), 3000);
    return () => clearInterval(t);
  }, [loading]);

  if (loading) {
    const pct = Math.round((progress.step / 5) * 100);
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d1117', padding: 32, gap: 0 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 6 }}>🔍 Analyzing Repository</div>
          {repoName && (
            <div style={{ fontSize: 13, color: '#58a6ff', fontFamily: 'monospace' }}>
              github.com/{repoName}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ width: 420, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#484f58', fontWeight: 600 }}>Progress</span>
            <span style={{ fontSize: 11, color: pct >= 100 ? '#3fb950' : '#58a6ff', fontWeight: 700 }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: '#21262d', borderRadius: 99, overflow: 'hidden', border: '1px solid #30363d' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(5, pct)}%`,
                background: pct >= 100
                  ? 'linear-gradient(90deg,#1f6feb,#3fb950)'
                  : 'linear-gradient(90deg,#1f6feb,#388bfd)',
                borderRadius: 99,
                transition: 'width 0.8s ease-out',
                boxShadow: '0 0 10px rgba(31,111,235,0.5)',
              }}
            />
          </div>
        </div>

        {/* Steps checklist */}
        <div style={{ width: 420, marginBottom: 24 }}>
          {ANALYSIS_STEPS.map(step => {
            const done = progress.step > step.threshold;
            const active = progress.step === step.threshold;
            return (
              <div
                key={step.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '5px 0',
                  borderLeft: active ? '2px solid #58a6ff' : '2px solid transparent',
                  paddingLeft: active ? 10 : 12,
                  marginLeft: -12,
                  transition: 'all 0.3s ease',
                  animation: active ? 'fadeSlideIn 0.3s ease' : undefined,
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>
                  {done ? '✅' : active ? '⏳' : '⬜'}
                </span>
                <span style={{
                  fontSize: 12,
                  color: done ? '#3fb950' : active ? '#58a6ff' : '#484f58',
                  fontWeight: active ? 600 : 400,
                  transition: 'color 0.3s',
                }}>
                  {step.label}
                </span>
                {active && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#58a6ff', animation: 'pulse 1s infinite', marginLeft: 4 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Currently reading card */}
        {currentFile && (
          <div
            style={{
              width: 420,
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 24,
              fontFamily: 'monospace',
            }}
          >
            <div style={{ fontSize: 10, color: '#484f58', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📄 Currently reading:</div>
            <div style={{ fontSize: 12, color: '#58a6ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentFile}</div>
          </div>
        )}

        {/* Rotating tip */}
        <div
          style={{
            width: 420,
            background: '#161b22',
            border: '1px dashed #30363d',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 11,
            color: '#6e7681',
            lineHeight: 1.6,
          }}
        >
          {ROTATING_TIPS[tipIndex]}
        </div>

        <style>{`
          @keyframes fadeSlideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        `}</style>
      </div>
    );
  }

  // Check if repo has no JS/TS nodes (Python-only, etc.)
  const hasNoJsFiles = hasData && nodes.length === 0;

  if (!hasData && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-background">
        <div className="w-48 h-48 rounded-2xl flex items-center justify-center overflow-hidden border border-border/50 shadow-2xl bg-card/30">
          <img src="/logo.jpg" alt="Codebase Cipher Logo" className="w-full h-full object-cover" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Paste a GitHub URL to begin</h2>
          <p className="text-sm text-muted-foreground max-w-md">Transform any public repository into an interactive visual map with AI-powered explanations</p>
        </div>
        <div className="flex gap-6 mt-4">
          {[
            { icon: '🕸️', title: 'Dependency Mapping', desc: 'Visualize file relationships' },
            { icon: '🤖', title: 'AI Explanations', desc: 'Understand any file instantly' },
            { icon: '🔍', title: 'API Discovery', desc: 'Find all REST endpoints' },
          ].map(f => (
            <div key={f.title} className="text-center p-4 rounded-lg bg-card border border-border max-w-[160px]">
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="text-xs font-medium text-foreground">{f.title}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'graph' as const, label: 'Graph', icon: Network },
    { id: 'advanced_graph' as const, label: 'Power View', icon: Maximize2 },
    { id: 'endpoints' as const, label: 'APIs', icon: Globe },
    { id: 'functions' as const, label: 'Functions', icon: Code2 },
    { id: 'insights' as const, label: 'Insights', icon: Lightbulb },
    { id: 'health' as const, label: 'Health', icon: Activity },
  ];

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center px-3 gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${activeTab === t.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-3 h-3" />{t.label}
          </button>
        ))}

        <div className="flex-1 ml-4 flex gap-1">
          {activeTab === 'graph' && (
            <div className="bg-[#161b22] border border-[#30363d] rounded flex text-[10px] overflow-hidden shadow-sm">
              <button onClick={() => setGraphMode('workflow')} className={`px-2.5 py-1 ${graphMode === 'workflow' ? 'bg-[#58a6ff] text-white font-bold' : 'text-[#8b949e] hover:bg-[#30363d]'}`}>Workflow</button>
              <button onClick={() => setGraphMode('dependency')} className={`px-2.5 py-1 ${graphMode === 'dependency' ? 'bg-[#58a6ff] text-white font-bold' : 'text-[#8b949e] hover:bg-[#30363d]'}`}>Dependency</button>
              <button onClick={() => setGraphMode('request')} className={`px-2.5 py-1 ${graphMode === 'request' ? 'bg-[#58a6ff] text-white font-bold' : 'text-[#8b949e] hover:bg-[#30363d]'}`}>Request Flow</button>
              <button onClick={() => setGraphMode('data')} className={`px-2.5 py-1 ${graphMode === 'data' ? 'bg-[#58a6ff] text-white font-bold' : 'text-[#8b949e] hover:bg-[#30363d]'}`}>Data Flow</button>
            </div>
          )}
        </div>

        {activeTab === 'graph' && (
          <>
            <button
              onClick={() => { setShowGraphSearch(prev => !prev); setTimeout(() => searchInputRef.current?.focus(), 50); }}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Search nodes (⌘F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Bug #14 fix: use onClearSelection (sets undefined) instead of onNodeClick('') */}
            {selectedFile && (
              <button onClick={onClearSelection}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary" title="Clear focus">
                <Crosshair className="w-3 h-3" />Focus <X className="w-3 h-3" />
              </button>
            )}

            <button onClick={clustered.expandAll} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Expand all">
              <Expand className="w-3.5 h-3.5" />
            </button>
            <button onClick={clustered.collapseAll} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Collapse all">
              <Shrink className="w-3.5 h-3.5" />
            </button>

            <div className="relative" ref={filterDropdownRef}>
              {filter !== 'all' ? (
                <button onClick={() => setFilter('all')} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  {filterLabels[filter]} <X className="w-3 h-3" />
                </button>
              ) : (
                <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <Filter className="w-3.5 h-3.5" />
                </button>
              )}
              {showFilterDropdown && (
                <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-[180px]">
                  {(Object.keys(filterLabels) as FilterType[]).map(f => (
                    <button key={f} onClick={() => { setFilter(f); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors ${filter === f ? 'text-primary' : 'text-foreground'}`}>
                      {filterLabels[f]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
          {activeTab === 'graph' ? `${styledNodes.length} / ${nodes.length} nodes` : `${nodes.length} files`}
        </span>
        {activeTab === 'graph' && <ToolbarZoom />}
      </div>

      {/* Graph search bar */}
      {activeTab === 'graph' && showGraphSearch && (
        <div className="relative border-b border-border bg-card/50 backdrop-blur-sm px-3 py-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input ref={searchInputRef} type="text" value={graphSearch} onChange={e => setGraphSearch(e.target.value)}
              placeholder="Jump to file..."
              className="w-full pl-7 pr-7 py-1.5 text-xs rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            {graphSearch && (
              <button onClick={() => setGraphSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="absolute left-3 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-[300px] max-h-[200px] overflow-y-auto">
              {searchResults.map(id => (
                <button key={id} onClick={() => handleSearchSelect(id)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-foreground font-mono truncate">
                  {id}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cycle warning */}
      {activeTab === 'graph' && cycles.length > 0 && (
        <button onClick={() => setHighlightCycles(!highlightCycles)}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs border-b transition-colors ${highlightCycles ? 'bg-destructive/20 border-destructive/30 text-destructive' : 'bg-[hsl(var(--orange))]/10 border-border text-[hsl(var(--orange))]'}`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          ⚠️ {cycles.length} circular {cycles.length === 1 ? 'dependency' : 'dependencies'} detected
          <span className="text-[10px] ml-auto text-muted-foreground">{highlightCycles ? 'Click to reset' : 'Click to highlight'}</span>
        </button>
      )}

      {activeTab === 'graph' ? (
        hasNoJsFiles ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="text-5xl mb-2">📭</div>
            <h3 className="text-lg font-semibold text-foreground">No JavaScript or TypeScript files found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              GitVizz currently supports JS/TS codebases. Support for Python, Go, and other languages is coming soon.
            </p>
          </div>
        ) : (
        <div className="flex-1 relative">
          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={() => setEdgeExpl(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.05 }}
            minZoom={0.01}
            maxZoom={4}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
          >
            <Background color="#161b22" gap={24} size={1} style={{ background: '#0d1117' }} />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'clusterNode') return 'hsl(var(--primary))';
                const ext = (node.data?.filePath as string || '').split('.').pop() || '';
                const colors: Record<string, string> = {
                  js: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
                  css: '#cc6699', scss: '#cc6699', json: '#ff6b35',
                };
                return colors[ext] || '#484f58';
              }}
              maskColor="rgba(0,0,0,0.75)"
              style={{
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: 8,
                width: 180,
                height: 120,
              }}
              position="bottom-right"
            />
            <GraphLegend />
            {/* Watermark */}
            <div className="absolute bottom-1.5 right-3 text-[10px] text-[#484f58] font-semibold opacity-50 z-[100] pointer-events-none select-none">
              Made with GitVizz
            </div>
            
            {/* Tracer Controller Panel */}
            {graphMode === 'request' && (
              <div className="absolute top-4 right-4 z-50 bg-[#0d1117]/95 border border-[#58a6ff]/50 rounded-lg shadow-xl p-4 w-[280px] backdrop-blur-md">
                <div className="flex items-center gap-2 mb-3 text-[#58a6ff]">
                  <Globe className="w-4 h-4" />
                  <h3 className="font-bold text-xs uppercase tracking-widest">Trace Request</h3>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
                  Select an API route to simulate a payload travelling through the codebase workflow lanes.
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto mb-3 pr-1">
                  {nodes.filter(n => n.data.entityType === 'API_ROUTE').map((n) => {
                    const isActive = tracerState?.selection === n.id;
                    return (
                      <button key={n.id} onClick={() => setTracerState({ active: true, selection: n.id, currentNodes: [n.id], running: true })}
                        className={`w-full text-left px-2 py-1.5 text-[10px] font-mono rounded cursor-pointer transition-colors border flex items-center justify-between
                        ${isActive ? 'bg-[#58a6ff]/20 border-[#58a6ff] text-white' : 'bg-[#161b22] border-[#30363d] text-muted-foreground hover:border-[#58a6ff]/30'}`}>
                        <div className="truncate flex-1">{((n.data as any)?.routes?.[0]?.path) || n.data.label}</div>
                        {isActive && tracerState?.running && <span className="w-2 h-2 rounded-full bg-[#58a6ff] animate-ping" />}
                      </button>
                    )
                  })}
                  {nodes.filter(n => n.data.entityType === 'API_ROUTE').length === 0 && (
                    <div className="text-[10px] italic text-[#8b949e]">No API Routes detected.</div>
                  )}
                </div>
                {tracerState?.active && (
                  <button onClick={() => setTracerState(null)} className="w-full py-1.5 rounded bg-[#f85149]/20 hover:bg-[#f85149]/30 text-[#f85149] text-[10px] font-bold transition-colors">
                    End Trace Simulation
                  </button>
                )}
              </div>
            )}

            {/* Edge Explanation Popup */}
            {edgeExpl && (
              <div 
                className="fixed z-[9999] bg-[#0d1117] border border-[#30363d] rounded-lg shadow-2xl p-4 w-[320px] pointer-events-auto"
                style={{ left: Math.min(edgeExpl.x + 10, window.innerWidth - 350), top: Math.min(edgeExpl.y + 10, window.innerHeight - 200) }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1.5 text-[hsl(var(--orange))]">
                    <Zap className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Connection Explained</h3>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setEdgeExpl(null); }} className="text-muted-foreground hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="flex items-center gap-2 mb-3 text-[10px] bg-[#161b22] border border-[#30363d] rounded px-2 py-1.5 overflow-hidden">
                  <span className="truncate flex-1 text-[#8b949e]" title={edgeExpl.src}>{edgeExpl.src?.split('/').pop()}</span>
                  <ArrowLeft className="w-3 h-3 text-muted-foreground rotate-180 shrink-0" />
                  <span className="truncate flex-1 text-[#e6edf3]" title={edgeExpl.tgt}>{edgeExpl.tgt?.split('/').pop()}</span>
                </div>
                
                <div className="text-xs text-[#c9d1d9] leading-relaxed">
                  {edgeExpl.loading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground italic">Analyzing relationship...</span>
                    </div>
                  ) : (
                    edgeExpl.text
                  )}
                </div>
              </div>
            )}
          </ReactFlow>
        </div>
        )
      ) : activeTab === 'advanced_graph' ? (
        <div className="flex-1">
          <HighPerformanceGraph rawNodes={nodes} rawEdges={edges} onNodeClick={onNodeClick} />
        </div>
      ) : activeTab === 'endpoints' ? (
        <div className="flex-1 overflow-y-auto p-4">
          {endpoints.length > 0 ? (
            <div className="space-y-2">
              {endpoints.map((ep, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-card border border-border">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                    style={{ color: methodColors[ep.method], background: `${methodColors[ep.method]}20` }}>
                    {ep.method}
                  </span>
                  <span className="text-xs font-mono text-foreground">{ep.path}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{ep.file}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground mt-20">No API endpoints detected</div>
          )}
        </div>
      ) : activeTab === 'functions' ? (
        <FunctionCallMap functionMap={functionMap} onSelectFile={onNodeClick} />
      ) : activeTab === 'insights' ? (
        <InsightsPanel nodes={nodes} edges={edges} functionMap={functionMap} metrics={metrics} onSelectFile={onNodeClick} />
      ) : healthStats ? (
        <HealthReport stats={healthStats} cycles={cycles} onSelectFile={onNodeClick} />
      ) : null}

      {/* Floating System Telemetry - Only visible on map views */}
      {(activeTab === 'graph' || activeTab === 'advanced_graph') && (
        <TelemetryPanel metrics={metrics} />
      )}

      {/* Repository Intelligence Overlay */}
      <RepoIntelligenceOverlay 
        repoName={repoName || ''}
        files={files} 
        nodes={nodes}
        edges={edges}
        endpoints={endpoints}
        hasData={hasData}
        loading={loading}
      />
    </div>
  );
}
