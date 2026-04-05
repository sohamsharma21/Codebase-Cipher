import { useState, useCallback } from 'react';
import type { RepoFile, APIEndpoint, AnalysisProgress, RepoInfo, ParsedFunction, PerformanceMetrics, DatabaseInteraction, ExecutionFlow, ArchitectureLayers } from '@/types';
import type { Node, Edge } from '@xyflow/react';
import { parseGitHubUrl } from '@/lib/parser';
import { getDemoNodes, getDemoEdges, getDemoFiles, getDemoEndpoints, DEMO_REPO_INFO } from '@/lib/demoData';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { extractEntity, extractRoutes, extractDbOperations, detectArchitecture, type ArchitectureMatch } from '@/lib/workflowAnalyzer';

const LANES = [
  { id: 'client', label: 'Client / Entry', y: 40, height: 160, color: 'rgba(210, 153, 34, 0.05)', borderColor: 'rgba(210, 153, 34, 0.3)' },
  { id: 'http', label: 'HTTP Layer', y: 220, height: 180, color: 'rgba(88, 166, 255, 0.05)', borderColor: 'rgba(88, 166, 255, 0.3)' },
  { id: 'logic', label: 'Business Logic', y: 420, height: 180, color: 'rgba(63, 185, 80, 0.05)', borderColor: 'rgba(63, 185, 80, 0.3)' },
  { id: 'data', label: 'Data Layer', y: 620, height: 180, color: 'rgba(240, 136, 62, 0.05)', borderColor: 'rgba(240, 136, 62, 0.3)' },
  { id: 'database', label: 'Database', y: 820, height: 180, color: 'rgba(248, 81, 73, 0.05)', borderColor: 'rgba(248, 81, 73, 0.3)' }
];

function buildWorkflowGraph(rawNodes: any[], rawEdges: any[], allFiles: RepoFile[]) {
  if (rawNodes.length === 0) return { nodes: [], edges: [], dbOpsRaw: [], routesRaw: [] };

  const inDegree: Record<string, number> = {};
  const outDegree: Record<string, number> = {};
  rawNodes.forEach(n => { inDegree[n.id] = 0; outDegree[n.id] = 0; });
  rawEdges.forEach(e => {
    if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    if (outDegree[e.source] !== undefined) outDegree[e.source]++;
  });

  const dbOpsRaw: any[] = [];
  const routesRaw: any[] = [];
  
  // Extract entities & assign lanes
  const fileEntities = new Map();
  const laneCounts = [0, 0, 0, 0, 0];
  
  rawNodes.forEach(n => {
    const file = allFiles.find(f => f.path === n.id);
    const content = file?.content || '';
    const entity = extractEntity(n.id, content);
    
    // Extract routes
    if (entity.type === 'API_ROUTE') {
      const detectedRoutes = extractRoutes(content, n.id);
      if (detectedRoutes.length) {
        routesRaw.push(...detectedRoutes);
        (entity as any).routes = detectedRoutes;
      }
    }
    // Extract DB ops
    const ops = extractDbOperations(content, n.id);
    if (ops.length) {
      dbOpsRaw.push(...ops);
      if (entity.type !== 'DATABASE') {
        entity.type = 'MODEL'; // force data layer mapping if op detected
        entity.layer = 3;
      }
    }
    
    let lIdx = entity.layer;
    if (lIdx === undefined || lIdx > 4) lIdx = 3;
    
    fileEntities.set(n.id, { ...entity, laneIndex: lIdx, xPos: laneCounts[lIdx]++ });
  });

  const nodes: Node[] = [];
  
  // Conditionally generate lane background nodes
  const activeLanes: number[] = [];
  laneCounts.forEach((c, idx) => { if (c > 0) activeLanes.push(idx); });
  
  activeLanes.forEach(idx => {
    const lane = LANES[idx];
    nodes.push({
      id: `lane-${lane.id}`,
      type: 'laneNode',
      position: { x: -200, y: lane.y },
      data: lane,
      selectable: false,
      draggable: false,
      zIndex: -1,
    } as Node);
  });

  // Calculate Node coordinates
  rawNodes.forEach(n => {
    const entity = fileEntities.get(n.id);
    if (!entity) return;
    
    const lane = LANES[entity.laneIndex];
    if (!lane) return; // Should not happen

    const y = lane.y + 40 + (entity.xPos % 2 === 0 ? 0 : 30); // staggered Y
    const x = entity.xPos * 220;
    
    nodes.push({
      id: n.id,
      type: 'workflowNode',
      position: { x, y },
      data: {
        ...entity,
        filePath: n.id,
        importsCount: outDegree[n.id] ?? 0,
        usedByCount: inDegree[n.id] ?? 0,
        entityType: entity.type,
      },
      zIndex: 1
    } as Node);
  });

  // Smart Edges
  const edges: Edge[] = rawEdges.map(e => {
    const src = fileEntities.get(e.source);
    const tgt = fileEntities.get(e.target);
    
    if (src && tgt) {
      if (src.type === 'API_ROUTE' && (tgt.type === 'CONTROLLER' || tgt.type === 'SERVICE')) {
        return {
          id: e.id, source: e.source, target: e.target, type: 'smartEdge', data: { label: 'request', animated: true },
          style: { stroke: '#58a6ff', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#58a6ff' }
        };
      }
      if (tgt.type === 'DATABASE' || tgt.type === 'MODEL') {
        const fileContent = allFiles.find(f => f.path === e.source)?.content || '';
        const ops = extractDbOperations(fileContent, e.source);
        const opLabel = ops.length > 0 ? ops[0].label : 'query';
        return {
          id: e.id, source: e.source, target: e.target, type: 'smartEdge', data: { label: opLabel, animated: true },
          style: { stroke: '#f0883e', strokeWidth: 2 }, markerEnd: { type: 'arrowclosed', color: '#f0883e' }
        };
      }
      if (src.type === 'MIDDLEWARE') {
        return {
          id: e.id, source: e.source, target: e.target, type: 'smartEdge', data: { label: 'guards' },
          style: { stroke: '#a371f7', strokeWidth: 1.5, strokeDasharray: '5,3' }, markerEnd: { type: 'arrowclosed', color: '#a371f7' }
        };
      }
    }
    // Default
    return {
      id: e.id, source: e.source, target: e.target, type: 'smartEdge',
      style: { stroke: '#30363d', strokeWidth: 1, opacity: 0.6 }
    };
  });

  return { nodes, edges, dbOpsRaw, routesRaw };
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
  
  // Arch Tracking
  const [architecture, setArchitecture] = useState<ArchitectureMatch | null>(null);
  const [dbOps, setDbOps] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [currentFile, setCurrentFile] = useState<string>('');

  const loadDemo = useCallback(() => {
    setIsDemo(true);
    setFiles(getDemoFiles());
    const demoNodes = getDemoNodes();
    const demoEdges = getDemoEdges();
    // Enrich demo nodes too
    const inDeg: Record<string, number> = {};
    demoNodes.forEach(n => { inDeg[n.id] = 0; });
    demoEdges.forEach(e => { if (inDeg[e.target] !== undefined) inDeg[e.target]++; });
    setNodes(buildEnrichedNodes(demoNodes, demoEdges));
    setEdges(buildEnrichedEdges(demoEdges, inDeg));
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
    setCurrentFile('');
    setProgress({ step: 1, message: 'Connecting to repository...', done: false });

    try {
      setProgress({ step: 2, message: 'Fetching file tree from GitHub...', done: false });

      const { data, error } = await supabase.functions.invoke('analyze-repo', {
        body: { owner: parsed.owner, repo: parsed.repo },
      });

      if (error) throw new Error(error.message || 'Analysis failed');
      if (data.error) throw new Error(data.error);

      setProgress({ step: 3, message: 'Parsing imports and dependencies...', done: false });

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
<<<<<<< HEAD
      setFunctionMap(data.functionMap || []);
=======
      setFunctionMap(data.functionMap || {});
      setDbInteractions(data.dbInteractions || []);
      setExecutionFlows(data.executionFlows || []);
      setDbFrameworks(data.dbFrameworks || []);
      setLayers(data.layers || { frontend: [], backend: [], database: [], middleware: [], config: [] });
>>>>>>> origin/main

      // Show "currently reading" last files
      const codeFiles = allFiles.filter(f => f.type === 'blob' && /\.(js|ts|jsx|tsx|mjs)$/.test(f.path));
      if (codeFiles.length > 0) {
        setCurrentFile(codeFiles[codeFiles.length - 1].path);
      }

<<<<<<< HEAD
      setProgress({ step: 4, message: 'Building hierarchical dependency graph...', done: false });

      const rawNodes = data.nodes || [];
      const rawEdges = data.edges || [];
=======
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
>>>>>>> origin/main

      // Architecture detect
      const pkgFile = allFiles.find(f => f.path.endsWith('package.json'))?.content;
      const arch = detectArchitecture(allFiles, pkgFile);
      setArchitecture(arch);

      // Workflow topology map layout
      setProgress({ step: 4, message: `Building topological map for ${arch.description}...`, done: false });
      
      const { nodes: enrichedNodes, edges: enrichedEdges, dbOpsRaw, routesRaw } = buildWorkflowGraph(rawNodes, rawEdges, allFiles);
      setDbOps(dbOpsRaw);
      setRoutes(routesRaw);

      setNodes(enrichedNodes);
      setEdges(enrichedEdges);
      setCurrentFile('');

      const endTime = Date.now();
      setMetrics({
        startTime, endTime,
        duration: endTime - startTime,
        filesAnalyzed: data.stats?.totalFiles || enrichedNodes.length,
        nodesCount: enrichedNodes.length,
        edgesCount: enrichedEdges.length,
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
        message: `${enrichedNodes.length} files, ${enrichedEdges.length} connections${truncMsg}${cachedMsg}`,
        done: true,
      });

      // Success toast
      toast.success(`✅ Analysis complete — ${enrichedNodes.length} files, ${enrichedEdges.length} connections`, {
        duration: 4000,
      });

      // Save to history
      try {
        const historyRaw = localStorage.getItem('gitvizz_history');
        let history = historyRaw ? JSON.parse(historyRaw) : [];
        const newEntry = {
          repo: `${parsed.owner}/${parsed.repo}`,
          timestamp: Date.now(),
          fileCount: enrichedNodes.length,
          healthScore: 100 // placeholder since health is calculated later
        };
        // Remove existing if same repo
        history = history.filter((h: any) => h.repo !== newEntry.repo);
        // Add new to front
        history.unshift(newEntry);
        // Keep max 5
        if (history.length > 5) history = history.slice(0, 5);
        localStorage.setItem('gitvizz_history', JSON.stringify(history));
        // Dispatch custom event to tell LeftPanel to re-read
        window.dispatchEvent(new Event('gitvizz_history_updated'));
      } catch (e) {
        console.error('Failed to save gitvizz history', e);
      }

    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
      setProgress({ step: 0, message: '', done: false });
      setCurrentFile('');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    files, nodes, edges, endpoints, functionMap, repoInfo,
<<<<<<< HEAD
    loading, progress, isDemo, metrics, currentFile,
=======
    dbInteractions, executionFlows, dbFrameworks, layers,
    loading, progress, isDemo, metrics,
>>>>>>> origin/main
    analyze, loadDemo, setNodes, setEdges,
  };
}
