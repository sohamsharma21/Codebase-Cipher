import { useState, useCallback } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from '@xyflow/react';
import { GitBranch, Star, RotateCcw } from 'lucide-react';
import LeftPanel from '@/components/LeftPanel';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import { useGitHubAnalysis } from '@/hooks/useGitHubAnalysis';

function GitVizzApp() {
  const { files, nodes, edges, endpoints, repoInfo, loading, progress, isDemo, analyze, loadDemo, setNodes: setAnalysisNodes, setEdges: setAnalysisEdges } = useGitHubAnalysis();
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);
  const [selectedFile, setSelectedFile] = useState<string>();

  // Sync analysis nodes/edges to flow state
  const prevNodesRef = useState(nodes)[0];
  if (nodes !== prevNodesRef && nodes.length > 0 && nodes !== flowNodes) {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  }

  // Use a ref-like approach: update flow when analysis changes
  const handleAnalyze = useCallback(async (url: string) => {
    setSelectedFile(undefined);
    await analyze(url);
  }, [analyze]);

  const handleLoadDemo = useCallback(() => {
    setSelectedFile(undefined);
    loadDemo();
  }, [loadDemo]);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path);
  }, []);

  // Sync nodes when they change from analysis
  if (nodes.length > 0 && flowNodes.length === 0) {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  }

  const hasData = nodes.length > 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b border-border flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm text-foreground">GitVizz</span>
        </div>
        {repoInfo && (
          <>
            <div className="mx-4 h-4 w-px bg-border" />
            <span className="text-xs text-muted-foreground">
              {repoInfo.owner}/{repoInfo.repo}
            </span>
            {repoInfo.stars !== undefined && (
              <span className="ml-2 flex items-center gap-1 text-xs text-orange">
                <Star className="w-3 h-3" />
                {repoInfo.stars.toLocaleString()}
              </span>
            )}
          </>
        )}
        <div className="flex-1" />
        {hasData && (
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            New Analysis
          </button>
        )}
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          files={files}
          progress={progress}
          loading={loading}
          onAnalyze={handleAnalyze}
          onLoadDemo={handleLoadDemo}
          onSelectFile={handleSelectFile}
          selectedFile={selectedFile}
        />
        <CenterPanel
          nodes={flowNodes.length > 0 ? flowNodes : nodes}
          edges={flowEdges.length > 0 ? flowEdges : edges}
          endpoints={endpoints}
          selectedFile={selectedFile}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleSelectFile}
          hasData={hasData}
        />
        <RightPanel
          selectedFile={selectedFile}
          files={files}
          isDemo={isDemo}
        />
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
