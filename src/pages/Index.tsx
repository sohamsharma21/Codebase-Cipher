import { useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from '@xyflow/react';
import { GitBranch, Star, RotateCcw, Download, ClipboardCopy, FileText, Camera, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import LeftPanel from '@/components/LeftPanel';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import { useGitHubAnalysis } from '@/hooks/useGitHubAnalysis';

function GitVizzApp() {
  const navigate = useNavigate();
  const {
    files, nodes: analysisNodes, edges: analysisEdges, endpoints,
    functionMap, repoInfo, loading, progress, isDemo, metrics,
    analyze, loadDemo,
  } = useGitHubAnalysis();

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Sync analysis results into flow state
  useEffect(() => {
    if (analysisNodes.length > 0) {
      setFlowNodes(analysisNodes);
      setFlowEdges(analysisEdges);
    }
  }, [analysisNodes, analysisEdges, setFlowNodes, setFlowEdges]);

  // Bug #4 fix: Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as globalThis.Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // Bug #3 fix: Destructured `analyze` and `loadDemo` are stable useCallback refs from the hook
  const handleAnalyze = useCallback(async (url: string) => {
    setSelectedFile(undefined);
    setFlowNodes([]);
    setFlowEdges([]);
    await analyze(url);
  }, [analyze, setFlowNodes, setFlowEdges]);

  const handleLoadDemo = useCallback(() => {
    setSelectedFile(undefined);
    loadDemo();
  }, [loadDemo]);

  // Bug #14 fix: Always use undefined (not empty string) for "no selection"
  const handleClearSelection = useCallback(() => {
    setSelectedFile(undefined);
  }, []);

  // Bug #15 fix: Reset analysis state instead of full page reload
  const handleNewAnalysis = useCallback(() => {
    setSelectedFile(undefined);
    setFlowNodes([]);
    setFlowEdges([]);
    // Navigate to landing page for a fresh start
    navigate('/');
  }, [setFlowNodes, setFlowEdges, navigate]);

  const hasData = flowNodes.length > 0;
  const repoName = repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : undefined;

  const handleExport = useCallback(async (type: 'json' | 'text' | 'png') => {
    setShowExportMenu(false);
    if (type === 'json') {
      const data = JSON.stringify({ nodes: flowNodes.map(n => ({ id: n.id, data: n.data })), edges: flowEdges.map(e => ({ source: e.source, target: e.target })) }, null, 2);
      navigator.clipboard.writeText(data);
      toast.success('Node list copied to clipboard');
    } else if (type === 'text') {
      const text = `Codebase Cipher Report - ${repoName || 'Unknown'}\n\nFiles: ${flowNodes.length}\nConnections: ${flowEdges.length}\n\nNodes:\n${flowNodes.map(n => `  - ${n.id}`).join('\n')}`;
      navigator.clipboard.writeText(text);
      toast.success('Report copied to clipboard');
    } else if (type === 'png') {
      toast('Capturing graph...');
      try {
        const { default: html2canvas } = await import('html2canvas');
        const canvas = document.querySelector('.react-flow') as HTMLElement;
        if (!canvas) { toast.error('Graph not found'); return; }
        const c = await html2canvas(canvas, { backgroundColor: '#0d1117', scale: 2 });
        const link = document.createElement('a');
        link.download = `codebase-cipher-${repoName?.replace('/', '-') || 'graph'}.png`;
        link.href = c.toDataURL();
        link.click();
        toast.success('Graph exported as PNG');
      } catch {
        toast.error('Failed to capture graph');
      }
    }
  }, [flowNodes, flowEdges, repoName]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="h-12 border-b border-border flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Back to home">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <GitBranch className="w-5 h-5 text-primary" />
          <div>
            <span className="font-bold text-sm text-foreground">Codebase Cipher</span>
            <span className="text-[9px] ml-1.5 px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">v2.0</span>
          </div>
        </div>
        {repoInfo && (
          <>
            <div className="mx-4 h-4 w-px bg-border" />
            <span className="text-xs text-muted-foreground">
              {repoInfo.owner}/{repoInfo.repo}
            </span>
            {repoInfo.stars !== undefined && (
              <span className="ml-2 flex items-center gap-1 text-xs text-[hsl(var(--orange))]">
                <Star className="w-3 h-3" />
                {repoInfo.stars.toLocaleString()}
              </span>
            )}
            {repoInfo.language && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                {repoInfo.language}
              </span>
            )}
          </>
        )}
        {metrics && (
          <span className="ml-3 text-[10px] text-muted-foreground">
            ⚡ {(metrics.duration / 1000).toFixed(1)}s
            {metrics.cached && ' (cached)'}
          </span>
        )}
        <div className="flex-1" />
        {hasData && (
          <div className="flex items-center gap-2">
            <div className="relative" ref={exportMenuRef}>
              <button onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Download className="w-3 h-3" />Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-[200px]">
                  <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary flex items-center gap-2 text-foreground">
                    <ClipboardCopy className="w-3 h-3" />📋 Copy nodes as JSON
                  </button>
                  <button onClick={() => handleExport('text')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary flex items-center gap-2 text-foreground">
                    <FileText className="w-3 h-3" />📄 Export report as text
                  </button>
                  <button onClick={() => handleExport('png')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary flex items-center gap-2 text-foreground">
                    <Camera className="w-3 h-3" />🖼️ Screenshot graph (PNG)
                  </button>
                </div>
              )}
            </div>
            {repoInfo && (
              <a href={`https://github.com/${repoInfo.owner}/${repoInfo.repo}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Star className="w-3 h-3" />Star on GitHub
              </a>
            )}
            <button onClick={handleNewAnalysis}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <RotateCcw className="w-3 h-3" />New Analysis
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel files={files} progress={progress} loading={loading}
          onAnalyze={handleAnalyze} onLoadDemo={handleLoadDemo} onSelectFile={setSelectedFile} selectedFile={selectedFile} />
        <CenterPanel nodes={flowNodes} edges={flowEdges} endpoints={endpoints}
          functionMap={functionMap} metrics={metrics}
          selectedFile={selectedFile}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={setSelectedFile} onClearSelection={handleClearSelection} hasData={hasData} />
        <RightPanel selectedFile={selectedFile} files={files} isDemo={isDemo} repoName={repoName} />
      </div>
    </div>
  );
}

export default function Index() {
  return (
    <ReactFlowProvider>
      <GitVizzApp />
    </ReactFlowProvider>
  );
}
