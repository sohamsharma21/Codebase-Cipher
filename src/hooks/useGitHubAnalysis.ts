import { useState, useCallback } from 'react';
import type { RepoFile, APIEndpoint, AnalysisProgress, RepoInfo, ParsedFunction, PerformanceMetrics, DatabaseInteraction, ExecutionFlow, ArchitectureLayers } from '@/types';
import type { Node, Edge } from '@xyflow/react';
import { parseGitHubUrl } from '@/lib/parser';
import { getDemoNodes, getDemoEdges, getDemoFiles, getDemoEndpoints, DEMO_REPO_INFO } from '@/lib/demoData';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import dagre from 'dagre';

function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return [];
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });
  nodes.forEach(n => g.setNode(n.id, { width: 200, height: 60 }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => {
    const pos = g.node(n.id);
    if (!pos) return n;
    return { ...n, position: { x: pos.x - 100, y: pos.y - 30 } };
  });
}

export function useGitHubAnalysis() {
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [functionMap, setFunctionMap] = useState<Record<string, ParsedFunction[]>>({});
  const [dbInteractions, setDbInteractions] = useState<DatabaseInteraction[]>([]);
  const [executionFlows, setExecutionFlows] = useState<ExecutionFlow[]>([]);
  const [dbFrameworks, setDbFrameworks] = useState<string[]>([]);
  const [layers, setLayers] = useState<ArchitectureLayers>({ frontend: [], backend: [], database: [], middleware: [], config: [] });
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({ step: 0, message: '', done: false });
  const [isDemo, setIsDemo] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  const loadDemo = useCallback(() => {
    setIsDemo(true);
    setFiles(getDemoFiles());
    setNodes(getDemoNodes());
    setEdges(getDemoEdges());
    setEndpoints(getDemoEndpoints());
    setFunctionMap({});
    setDbInteractions([]);
    setExecutionFlows([]);
    setDbFrameworks([]);
    setLayers({ frontend: [], backend: [], database: [], middleware: [], config: [] });
    setRepoInfo(DEMO_REPO_INFO);
    setMetrics({
      startTime: Date.now(), endTime: Date.now(), duration: 0,
      filesAnalyzed: 14, nodesCount: 14, edgesCount: 13,
      functionsCount: 0, endpointsCount: 0,
      dbInteractionsCount: 0, flowsCount: 0, cached: false,
    });
    setProgress({ step: 5, message: '✅ Demo loaded!', done: true });
  }, []);

  const analyze = useCallback(async (url: string) => {
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      toast.error('Invalid GitHub URL. Use format: https://github.com/owner/repo');
      return;
    }

    const startTime = Date.now();
    setLoading(true);
    setIsDemo(false);
    setMetrics(null);
    setProgress({ step: 1, message: '📡 Sending to analysis engine...', done: false });

    try {
      setProgress({ step: 2, message: '🔍 Server is fetching and parsing repository...', done: false });

      const { data, error } = await supabase.functions.invoke('analyze-repo', {
        body: { owner: parsed.owner, repo: parsed.repo },
      });

      if (error) throw new Error(error.message || 'Analysis failed');
      if (data.error) throw new Error(data.error);

      setProgress({ step: 3, message: '🕸️ Building dependency graph...', done: false });

      setRepoInfo({
        owner: data.repoInfo.owner,
        repo: data.repoInfo.repo,
        stars: data.repoInfo.stars,
        description: data.repoInfo.description,
        language: data.repoInfo.language,
        defaultBranch: data.repoInfo.defaultBranch,
      });

      const allFiles: RepoFile[] = (data.allFiles || []).map((f: any) => ({
        path: f.path, type: f.type || 'blob', size: f.size,
      }));
      setFiles(allFiles);
      setEndpoints(data.endpoints || []);
      setFunctionMap(data.functionMap || {});
      setDbInteractions(data.dbInteractions || []);
      setExecutionFlows(data.executionFlows || []);
      setDbFrameworks(data.dbFrameworks || []);
      setLayers(data.layers || { frontend: [], backend: [], database: [], middleware: [], config: [] });

      setProgress({ step: 4, message: '📐 Laying out graph nodes...', done: false });

      const serverNodes = (data.nodes || []).map((n: any, i: number) => ({
        id: n.id,
        type: 'fileNode',
        position: { x: (i % 8) * 220, y: Math.floor(i / 8) * 120 },
        data: { label: n.data?.label || n.id, filePath: n.data?.filePath || n.id, role: n.data?.role || 'utility' },
      }));

      const serverEdges: Edge[] = (data.edges || []).map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
        edgeType: e.edgeType || 'import',
      }));

      const laidOut = layoutNodes(serverNodes, serverEdges);
      setNodes(laidOut);
      setEdges(serverEdges);

      const endTime = Date.now();
      setMetrics({
        startTime, endTime,
        duration: endTime - startTime,
        filesAnalyzed: data.stats?.totalFiles || serverNodes.length,
        nodesCount: serverNodes.length,
        edgesCount: serverEdges.length,
        functionsCount: data.stats?.totalFunctions || 0,
        endpointsCount: data.stats?.totalEndpoints || 0,
        dbInteractionsCount: data.stats?.totalDbInteractions || 0,
        flowsCount: data.stats?.totalFlows || 0,
        cached: data.cached || false,
      });

      const truncMsg = data.truncated ? ' (truncated to 500 files)' : '';
      const cachedMsg = data.cached ? ' (cached)' : '';
      setProgress({
        step: 5,
        message: `✅ ${serverNodes.length} nodes, ${serverEdges.length} connections${truncMsg}${cachedMsg}`,
        done: true,
      });
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
      setProgress({ step: 0, message: '', done: false });
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    files, nodes, edges, endpoints, functionMap, repoInfo,
    dbInteractions, executionFlows, dbFrameworks, layers,
    loading, progress, isDemo, metrics,
    analyze, loadDemo, setNodes, setEdges,
  };
}
