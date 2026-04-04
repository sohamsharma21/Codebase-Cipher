import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow, Background, MiniMap, useReactFlow,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange, type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ZoomIn, ZoomOut, Maximize2, Network, Globe, Activity, Filter, X, AlertTriangle, Search, Expand, Shrink, Crosshair } from 'lucide-react';
import CustomNode from './CustomNode';
import ClusterNode from './ClusterNode';
import HealthReport from './HealthReport';
import type { APIEndpoint } from '@/types';
import { detectCircularDeps, calculateHealth, type CycleInfo, type HealthStats } from '@/lib/graphUtils';
import { useClusteredGraph } from '@/hooks/useClusteredGraph';

interface CenterPanelProps {
  nodes: Node[];
  edges: Edge[];
  endpoints: APIEndpoint[];
  selectedFile?: string;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onNodeClick: (path: string) => void;
  hasData: boolean;
}

const nodeTypes = { fileNode: CustomNode, clusterNode: ClusterNode };

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

export default function CenterPanel({ nodes, edges, endpoints, selectedFile, onNodesChange, onEdgesChange, onNodeClick, hasData }: CenterPanelProps) {
  const [activeTab, setActiveTab] = useState<'graph' | 'endpoints' | 'health'>('graph');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [highlightCycles, setHighlightCycles] = useState(false);
  const [graphSearch, setGraphSearch] = useState('');
  const [showGraphSearch, setShowGraphSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const reactFlowInstance = useReactFlow();

  const cycles = useMemo(() => hasData ? detectCircularDeps(nodes, edges) : [], [nodes, edges, hasData]);
  const healthStats = useMemo(() => hasData ? calculateHealth(nodes, edges, cycles) : null, [nodes, edges, cycles, hasData]);

  const cycleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    cycles.forEach(c => c.cycle.forEach(id => ids.add(id)));
    return ids;
  }, [cycles]);

  const cycleEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    cycles.forEach(c => c.edgeIds.forEach(id => ids.add(id)));
    return ids;
  }, [cycles]);

  // Clustered graph
  const clustered = useClusteredGraph(nodes, edges);

  // Search results for graph search
  const searchResults = useMemo(() => {
    if (!graphSearch.trim()) return [];
    const q = graphSearch.toLowerCase();
    return nodes
      .filter(n => n.id.toLowerCase().includes(q))
      .slice(0, 8)
      .map(n => n.id);
  }, [graphSearch, nodes]);

  // Connected nodes to selectedFile
  const connectedNodeIds = useMemo(() => {
    if (!selectedFile) return new Set<string>();
    const ids = new Set<string>();
    ids.add(selectedFile);
    edges.forEach(e => {
      if (e.source === selectedFile) ids.add(e.target);
      if (e.target === selectedFile) ids.add(e.source);
    });
    return ids;
  }, [selectedFile, edges]);

  // Compute which nodes match the current filter
  const matchingNodeIds = useMemo(() => {
    if (filter === 'all') return null;
    const ids = new Set<string>();
    if (filter === 'js') nodes.filter(n => /\.(js|jsx|mjs|cjs)$/.test(n.id)).forEach(n => ids.add(n.id));
    else if (filter === 'ts') nodes.filter(n => /\.(ts|tsx)$/.test(n.id)).forEach(n => ids.add(n.id));
    else if (filter === 'components') nodes.filter(n => /\.(jsx|tsx)$/.test(n.id)).forEach(n => ids.add(n.id));
    else if (filter === 'circular') cycleNodeIds.forEach(id => ids.add(id));
    else if (filter === 'orphan') healthStats?.orphanFiles.forEach(f => ids.add(f));
    else if (filter === 'connected') {
      const counts: Record<string, number> = {};
      edges.forEach(e => { counts[e.source] = (counts[e.source] || 0) + 1; counts[e.target] = (counts[e.target] || 0) + 1; });
      Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([id]) => ids.add(id));
    }
    return ids;
  }, [filter, nodes, edges, cycleNodeIds, healthStats]);

  // Style visible nodes from clustered graph
  const styledNodes = useMemo(() =>
    clustered.visibleNodes.map(n => {
      if (n.type === 'clusterNode') return n;

      const isCycle = cycleNodeIds.has(n.id);
      const dimmedByFilter = matchingNodeIds !== null && !matchingNodeIds.has(n.id);
      const dimmedByCycle = highlightCycles && !isCycle;
      const isFocused = clustered.focusedNode === n.id;
      const isConnected = selectedFile ? connectedNodeIds.has(n.id) : true;
      const dimmedByFocus = selectedFile ? !isConnected : false;

      return {
        ...n,
        selected: n.id === selectedFile,
        style: {
          opacity: dimmedByFilter || dimmedByCycle || dimmedByFocus ? 0.15 : 1,
          transition: 'opacity 0.3s ease, filter 0.3s ease',
          ...(isCycle ? { filter: 'drop-shadow(0 0 8px #f85149)' } : {}),
          ...(isFocused ? { filter: 'drop-shadow(0 0 12px hsl(var(--primary)))' } : {}),
        },
      };
    }),
    [clustered.visibleNodes, selectedFile, cycleNodeIds, matchingNodeIds, highlightCycles, clustered.focusedNode, connectedNodeIds]
  );

  const styledEdges = useMemo(() =>
    clustered.visibleEdges.map(e => {
      const isCycle = cycleEdgeIds.has(e.id);
      const isSelected = e.source === selectedFile || e.target === selectedFile;
      const dimmed = highlightCycles && !isCycle;
      const isConnectedEdge = selectedFile ? (e.source === selectedFile || e.target === selectedFile) : true;
      const dimmedByFocus = selectedFile ? !isConnectedEdge : false;

      return {
        ...e,
        style: {
          stroke: isCycle ? '#f85149' : isSelected ? '#58a6ff' : 'hsl(var(--border))',
          strokeWidth: isCycle ? 2.5 : isSelected ? 2 : 1,
          opacity: dimmed || dimmedByFocus ? 0.08 : 1,
          transition: 'opacity 0.3s ease, stroke 0.3s ease',
        },
        markerEnd: { type: 'arrowclosed' as const, color: isCycle ? '#f85149' : isSelected ? '#58a6ff' : 'hsl(var(--border))' },
      };
    }),
    [clustered.visibleEdges, selectedFile, cycleEdgeIds, highlightCycles]
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === 'clusterNode') {
      clustered.toggleCluster(node.data.clusterId as string);
    } else {
      onNodeClick(node.id);
    }
  }, [onNodeClick, clustered.toggleCluster]);

  const handleSearchSelect = useCallback((fileId: string) => {
    clustered.focusNode(fileId);
    onNodeClick(fileId);
    setGraphSearch('');
    setShowGraphSearch(false);

    // Focus on the node in the graph after a tick (so it's rendered)
    setTimeout(() => {
      const node = reactFlowInstance.getNode(fileId);
      if (node) {
        reactFlowInstance.fitView({ nodes: [{ id: fileId }], padding: 0.5, duration: 400 });
      }
    }, 200);
  }, [clustered, onNodeClick, reactFlowInstance]);

  // Toggle search with Ctrl+F
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

  if (!hasData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-background">
        <div className="w-24 h-24 rounded-full bg-card border border-border flex items-center justify-center">
          <Network className="w-12 h-12 text-primary" />
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

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center px-3 gap-2">
        <button onClick={() => setActiveTab('graph')}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${activeTab === 'graph' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <Network className="w-3 h-3 inline mr-1" />Dependency Graph
        </button>
        <button onClick={() => setActiveTab('endpoints')}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${activeTab === 'endpoints' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <Globe className="w-3 h-3 inline mr-1" />API Endpoints
        </button>
        <button onClick={() => setActiveTab('health')}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${activeTab === 'health' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <Activity className="w-3 h-3 inline mr-1" />Health Report
        </button>

        <div className="flex-1" />

        {activeTab === 'graph' && (
          <>
            {/* Graph search toggle */}
            <button
              onClick={() => { setShowGraphSearch(prev => !prev); setTimeout(() => searchInputRef.current?.focus(), 50); }}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Search nodes (⌘F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Focus mode indicator */}
            {selectedFile && (
              <button
                onClick={() => onNodeClick('')}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary"
                title="Clear focus"
              >
                <Crosshair className="w-3 h-3" />Focus mode <X className="w-3 h-3" />
              </button>
            )}

            {/* Expand/Collapse */}
            <button onClick={clustered.expandAll} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Expand all">
              <Expand className="w-3.5 h-3.5" />
            </button>
            <button onClick={clustered.collapseAll} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Collapse all">
              <Shrink className="w-3.5 h-3.5" />
            </button>

            {/* Filter */}
            <div className="relative">
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
          {styledNodes.length} / {nodes.length} nodes
        </span>
        {activeTab === 'graph' && <ToolbarZoom />}
      </div>

      {/* Graph search bar */}
      {activeTab === 'graph' && showGraphSearch && (
        <div className="relative border-b border-border bg-card/50 backdrop-blur-sm px-3 py-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={graphSearch}
              onChange={e => setGraphSearch(e.target.value)}
              placeholder="Jump to file..."
              className="w-full pl-7 pr-7 py-1.5 text-xs rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
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

      {/* Cycle warning banner */}
      {activeTab === 'graph' && cycles.length > 0 && (
        <button onClick={() => setHighlightCycles(!highlightCycles)}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs border-b transition-colors ${highlightCycles ? 'bg-destructive/20 border-destructive/30 text-destructive' : 'bg-orange/10 border-border text-orange'}`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          ⚠️ {cycles.length} circular {cycles.length === 1 ? 'dependency' : 'dependencies'} detected
          <span className="text-[10px] ml-auto text-muted-foreground">{highlightCycles ? 'Click to reset' : 'Click to highlight'}</span>
        </button>
      )}

      {activeTab === 'graph' ? (
        <div className="flex-1">
          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#21262d" gap={20} size={1} />
            <MiniMap
              nodeColor={(node) => node.type === 'clusterNode' ? 'hsl(var(--primary))' : '#30363d'}
              maskColor="rgba(0,0,0,0.7)"
              style={{ background: '#161b22', borderRadius: 8 }}
            />
          </ReactFlow>
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
      ) : healthStats ? (
        <HealthReport stats={healthStats} cycles={cycles} onSelectFile={onNodeClick} />
      ) : null}
    </div>
  );
}
