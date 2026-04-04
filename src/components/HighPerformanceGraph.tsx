import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import * as d3 from 'd3-force-3d';
import tinycolor from 'tinycolor2';
import { Search, ZoomIn, ZoomOut, Maximize2, Layers, Focus, X, Command, Target, Share2 } from 'lucide-react';

interface Node {
  id: string;
  name: string;
  type: 'file' | 'folder';
  folder?: string;
  val: number;
  depth: number;
  isExpanded?: boolean;
  x?: number;
  y?: number;
}

interface Edge {
  source: string;
  target: string;
}

export default function HighPerformanceGraph({
  rawNodes,
  rawEdges,
  onNodeClick,
}: {
  rawNodes: any[];
  rawEdges: any[];
  onNodeClick: (path: string) => void;
}) {
  const fgRef = useRef<ForceGraphMethods>();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [hoverNode, setHoverNode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Hierarchical clustering logic
  const graphData = useMemo(() => {
    const nodes: Node[] = [];
    const links: Edge[] = [];
    const addedNodes = new Set<string>();

    const processFile = (path: string) => {
      const parts = path.split('/');
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const prevPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const type = i === parts.length - 1 ? 'file' : 'folder';
        const isExpanded = expandedFolders.has(currentPath);

        if (!addedNodes.has(currentPath)) {
          const shouldShow = i === 0 || expandedFolders.has(prevPath);
          if (shouldShow) {
            nodes.push({
              id: currentPath,
              name: part,
              type,
              folder: prevPath,
              depth: i,
              val: type === 'folder' ? 6 : 3,
            });
            addedNodes.add(currentPath);
          }
        }
        if (type === 'folder' && !isExpanded) break;
      }
    };

    rawNodes.forEach(rn => processFile(rn.id));

    rawEdges.forEach(re => {
      const getVisibleNode = (id: string) => {
        if (addedNodes.has(id)) return id;
        const parts = id.split('/');
        for (let i = parts.length - 1; i >= 0; i--) {
          const partial = parts.slice(0, i).join('/');
          if (addedNodes.has(partial)) return partial;
        }
        return null;
      };
      const src = getVisibleNode(re.source);
      const tgt = getVisibleNode(re.target);
      if (src && tgt && src !== tgt) links.push({ source: src, target: tgt });
    });

    return { nodes, links };
  }, [rawNodes, rawEdges, expandedFolders]);

  // Search filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return rawNodes
      .filter(n => n.id.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 10);
  }, [searchQuery, rawNodes]);

  const handleJumpTo = (id: string) => {
    const parts = id.split('/');
    const newExpanded = new Set(expandedFolders);
    for (let i = 1; i < parts.length; i++) {
      newExpanded.add(parts.slice(0, i).join('/'));
    }
    setExpandedFolders(newExpanded);
    setSearchQuery('');
    setShowSearch(false);
    
    // Smooth transition
    setTimeout(() => {
      const node = graphData.nodes.find(n => n.id === id);
      if (node && node.x !== undefined && node.y !== undefined) {
        fgRef.current?.centerAt(node.x, node.y, 1000);
        fgRef.current?.zoom(3, 1000);
      }
    }, 100);
  };

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHovered = hoverNode?.id === node.id;
    const isSelected = selectedNode?.id === node.id;
    const isRelated = !selectedNode || isSelected || 
                      graphData.links.some(l => {
                        const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
                        const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
                        return (s === node.id && t === selectedNode.id) || (t === node.id && s === selectedNode.id);
                      });

    if (focusMode && !isRelated) return;

    const alpha = (hoverNode && !isHovered && !isRelated) ? 0.1 : 1;
    ctx.globalAlpha = alpha;

    // Node Glow (NovaAddin Style)
    if (isSelected || isHovered) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = isSelected ? 'rgba(139, 92, 246, 0.8)' : 'rgba(139, 92, 246, 0.4)';
    }

    // Node Body
    const color = node.type === 'folder' ? '#3b82f6' : '#8b5cf6';
    ctx.fillStyle = isSelected ? '#ffffff' : color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dynamic Labels
    if (globalScale > 2 || isSelected || isHovered) {
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px Inter`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(node.name, node.x, node.y + node.val + 2);
    }
    
    ctx.globalAlpha = 1;
  }, [hoverNode, selectedNode, graphData.links, focusMode]);

  return (
    <div className="relative w-full h-full bg-[#030712] overflow-hidden rounded-2xl border border-white/5 shadow-2xl">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        linkColor={(link: any) => {
          const sId = typeof link.source === 'object' ? link.source.id : link.source;
          const tId = typeof link.target === 'object' ? link.target.id : link.target;
          const isRelated = (!selectedNode && !hoverNode) || 
                           [sId, tId].includes(selectedNode?.id) ||
                           [sId, tId].includes(hoverNode?.id);
          return isRelated ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.03)';
        }}
        linkWidth={(link: any) => {
          const sId = typeof link.source === 'object' ? link.source.id : link.source;
          const tId = typeof link.target === 'object' ? link.target.id : link.target;
          return (selectedNode?.id === sId || selectedNode?.id === tId ? 1.5 : 0.5);
        }}
        linkCurvature={0.25} // Visual Edge Bundling
        linkDirectionalArrowLength={2}
        linkDirectionalArrowRelPos={1}
        onNodeClick={(node: any) => {
          if (node.type === 'folder') {
            setExpandedFolders(prev => {
              const next = new Set(prev);
              if (next.has(node.id)) next.delete(node.id);
              else next.add(node.id);
              return next;
            });
          } else {
            setSelectedNode(node);
            onNodeClick(node.id);
          }
        }}
        onNodeHover={setHoverNode}
        enableNodeDrag={false}
        d3AlphaDecay={0.01}
        cooldownTicks={100}
      />

      {/* Glassmorphic Navbar Overlay */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/[0.03] backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] z-50">
        <div className="flex items-center gap-3 border-r border-white/10 pr-4">
          <Command className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold tracking-wider text-white/90">POWER VIEW</span>
        </div>
        
        <div className="relative flex items-center group">
          <Search className="w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search files (Ctrl+K)" 
            className="bg-transparent border-none outline-none text-xs text-white px-3 w-48 placeholder:text-white/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearch(true)}
          />
          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-12 left-0 w-80 bg-[#0f172a]/95 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              {searchResults.map(res => (
                <button 
                  key={res.id} 
                  onClick={() => handleJumpTo(res.id)}
                  className="w-full text-left px-4 py-2.5 text-[10px] text-white/70 hover:text-white hover:bg-white/5 border-b border-white/[0.02] flex items-center justify-between group"
                >
                  <span className="truncate max-w-[220px] font-mono">{res.id}</span>
                  <Target className="w-3 h-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-4">
          <button onClick={() => fgRef.current?.zoomToFit(800)} className="p-2 hover:bg-white/5 rounded-lg text-white/60 transition-colors" title="Fit View"><Maximize2 className="w-4 h-4" /></button>
          <button onClick={() => {
            const current = fgRef.current?.zoom() || 1;
            fgRef.current?.zoom(current * 1.5, 400);
          }} className="p-2 hover:bg-white/5 rounded-lg text-white/60 transition-colors" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => {
            const current = fgRef.current?.zoom() || 1;
            fgRef.current?.zoom(current * 0.7, 400);
          }} className="p-2 hover:bg-white/5 rounded-lg text-white/60 transition-colors" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={() => setFocusMode(!focusMode)} className={`p-2 rounded-lg transition-all ${focusMode ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-white/60'}`} title="Focus Isolation"><Focus className="w-4 h-4" /></button>
          <button onClick={() => setExpandedFolders(new Set())} className="p-2 hover:bg-white/5 rounded-lg text-white/60 transition-colors" title="Collapse Folders"><Layers className="w-4 h-4" /></button>
          <button className="p-2 hover:bg-white/5 rounded-lg text-white/60 transition-colors" title="Export Graph"><Share2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Selected Metadata Card */}
      {selectedNode && (
        <div className="absolute bottom-6 right-6 w-72 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center justify-between mb-4">
            <div className="px-2 py-0.5 rounded-md bg-primary/20 text-primary text-[10px] font-bold tracking-tighter">FILE NODE</div>
            <button onClick={() => setSelectedNode(null)} className="text-white/20 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <h4 className="text-sm font-bold text-white mb-1 truncate">{selectedNode.name}</h4>
          <p className="text-[10px] font-mono text-white/40 mb-6 truncate">{selectedNode.id}</p>
          <div className="flex gap-2">
            <button className="flex-1 py-2 bg-primary text-white text-[10px] font-bold rounded-xl hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all active:scale-95">Open Code</button>
            <button className="flex-1 py-2 bg-white/5 text-white text-[10px] font-bold rounded-xl hover:bg-white/10 transition-all border border-white/5">Trace Deps</button>
          </div>
        </div>
      )}

      {/* Dynamic Background Blur Accents */}
      <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/10 blur-[150px] pointer-events-none" />
    </div>
  );
}
