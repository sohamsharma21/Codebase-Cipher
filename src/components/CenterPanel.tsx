import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ZoomIn, ZoomOut, Maximize2, Network, Globe } from 'lucide-react';
import CustomNode from './CustomNode';
import type { APIEndpoint } from '@/types';

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

const nodeTypes = { fileNode: CustomNode };

const methodColors: Record<string, string> = {
  GET: '#3fb950',
  POST: '#58a6ff',
  PUT: '#d29922',
  DELETE: '#f85149',
  PATCH: '#bc8cff',
};

export default function CenterPanel({ nodes, edges, endpoints, selectedFile, onNodesChange, onEdgesChange, onNodeClick, hasData }: CenterPanelProps) {
  const [activeTab, setActiveTab] = useState<'graph' | 'endpoints'>('graph');

  const styledEdges = useMemo(() =>
    edges.map(e => ({
      ...e,
      style: {
        stroke: e.source === selectedFile || e.target === selectedFile ? '#58a6ff' : '#30363d',
        strokeWidth: e.source === selectedFile || e.target === selectedFile ? 2 : 1,
      },
      markerEnd: { type: 'arrowclosed' as const, color: e.source === selectedFile || e.target === selectedFile ? '#58a6ff' : '#30363d' },
    })),
    [edges, selectedFile]
  );

  const styledNodes = useMemo(() =>
    nodes.map(n => ({ ...n, selected: n.id === selectedFile })),
    [nodes, selectedFile]
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    onNodeClick(node.id);
  }, [onNodeClick]);

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
        <button
          onClick={() => setActiveTab('graph')}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${activeTab === 'graph' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Network className="w-3 h-3 inline mr-1" />
          Dependency Graph
        </button>
        <button
          onClick={() => setActiveTab('endpoints')}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${activeTab === 'endpoints' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Globe className="w-3 h-3 inline mr-1" />
          API Endpoints
        </button>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{nodes.length} nodes</span>
        <ToolbarZoom />
      </div>

      {/* Content */}
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
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#21262d" gap={20} size={1} />
            <MiniMap
              nodeColor={() => '#30363d'}
              maskColor="rgba(0,0,0,0.7)"
              style={{ background: '#161b22', borderRadius: 8 }}
            />
          </ReactFlow>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {endpoints.length > 0 ? (
            <div className="space-y-2">
              {endpoints.map((ep, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-card border border-border">
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                    style={{ color: methodColors[ep.method], background: `${methodColors[ep.method]}20` }}
                  >
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
      )}
    </div>
  );
}

function ToolbarZoom() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => zoomIn()} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => zoomOut()} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => fitView()} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

import { useState } from 'react';
