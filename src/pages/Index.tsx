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
  const analysis = useGitHubAnalysis();
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [selectedFile, setSelectedFile] = useState<string>();
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (analysis.nodes.length > 0) {
      setFlowNodes(analysis.nodes);
      setFlowEdges(analysis.edges);
    }
  }, [analysis.nodes, analysis.edges, setFlowNodes, setFlowEdges]);

  const handleAnalyze = useCallback(async (url: string) => {
    setSelectedFile(undefined);
    setFlowNodes([]);
    setFlowEdges([]);
    await analysis.analyze(url);
  }, [analysis.analyze, setFlowNodes, setFlowEdges]);

  const handleLoadDemo = useCallback(() => {
    setSelectedFile(undefined);
    analysis.loadDemo();
  }, [analysis.loadDemo]);

  const hasData = flowNodes.length > 0;
  const repoName = analysis.repoInfo ? `${analysis.repoInfo.owner}/${analysis.repoInfo.repo}` : undefined;

  const handleExport = useCallback(async (type: 'json' | 'text' | 'png') => {
    setShowExportMenu(false);
    if (type === 'json') {
      const data = JSON.stringify({ nodes: flowNodes.map(n => ({ id: n.id, data: n.data })), edges: flowEdges.map(e => ({ source: e.source, target: e.target })) }, null, 2);
      navigator.clipboard.writeText(data);
      toast.success('Node list copied to clipboard');
    } else if (type === 'text') {
      const text = `GitVizz Health Report - ${repoName || 'Unknown'}\n\nFiles: ${flowNodes.length}\nConnections: ${flowEdges.length}\n\nNodes:\n${flowNodes.map(n => `  - ${n.id}`).join('\n')}`;
      navigator.clipboard.writeText(text);
      toast.success('Health report copied to clipboard');
    } else if (type === 'png') {
      toast('Capturing graph...');
      try {
        const { default: html2canvas } = await import('html2canvas');
        const canvas = document.querySelector('.react-flow') as HTMLElement;
        if (!canvas) { toast.error('Graph not found'); return; }
        const c = await html2canvas(canvas, { backgroundColor: '#0d1117', scale: 2 });
        const link = document.createElement('a');
        link.download = `gitvizz-${repoName?.replace('/', '-') || 'graph'}.png`;
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
          <GitBranch className="w-5 h-5 text-primary" />
          <div>
            <span className="font-bold text-sm text-foreground">GitVizz</span>
            <span className="text-[9px] ml-1.5 px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">v2.0</span>
          </div>
        </div>
        {analysis.repoInfo && (
          <>
            <div className="mx-4 h-4 w-px bg-border" />
            <span className="text-xs text-muted-foreground">
              {analysis.repoInfo.owner}/{analysis.repoInfo.repo}
            </span>
            {analysis.repoInfo.stars !== undefined && (
              <span className="ml-2 flex items-center gap-1 text-xs text-orange">
                <Star className="w-3 h-3" />
                {analysis.repoInfo.stars.toLocaleString()}
              </span>
            )}
          </>
        )}
        <div className="flex-1" />
        {hasData && (
          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div className="relative">
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
            {analysis.repoInfo && (
              <a href={`https://github.com/${analysis.repoInfo.owner}/${analysis.repoInfo.repo}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Star className="w-3 h-3" />Star on GitHub
              </a>
            )}
            <button onClick={() => window.location.reload()}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <RotateCcw className="w-3 h-3" />New Analysis
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel files={analysis.files} progress={analysis.progress} loading={analysis.loading}
          onAnalyze={handleAnalyze} onLoadDemo={handleLoadDemo} onSelectFile={setSelectedFile} selectedFile={selectedFile} />
        <CenterPanel nodes={flowNodes} edges={flowEdges} endpoints={analysis.endpoints} selectedFile={selectedFile}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={setSelectedFile} hasData={hasData} />
        <RightPanel selectedFile={selectedFile} files={analysis.files} isDemo={analysis.isDemo} repoName={repoName} />
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
