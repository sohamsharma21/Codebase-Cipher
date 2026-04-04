import { useState, useCallback, useEffect } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from '@xyflow/react';
import { GitBranch, Star, RotateCcw } from 'lucide-react';
import LeftPanel from '@/components/LeftPanel';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import { useGitHubAnalysis } from '@/hooks/useGitHubAnalysis';

function GitVizzApp() {
  const analysis = useGitHubAnalysis();
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [selectedFile, setSelectedFile] = useState<string>();

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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="h-12 border-b border-border flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm text-foreground">GitVizz</span>
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
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            New Analysis
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          files={analysis.files}
          progress={analysis.progress}
          loading={analysis.loading}
          onAnalyze={handleAnalyze}
          onLoadDemo={handleLoadDemo}
          onSelectFile={setSelectedFile}
          selectedFile={selectedFile}
        />
        <CenterPanel
          nodes={flowNodes}
          edges={flowEdges}
          endpoints={analysis.endpoints}
          selectedFile={selectedFile}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={setSelectedFile}
          hasData={hasData}
        />
        <RightPanel
          selectedFile={selectedFile}
          files={analysis.files}
          isDemo={analysis.isDemo}
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
