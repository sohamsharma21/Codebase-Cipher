import { useState, useCallback } from 'react';
import type { RepoFile, ParsedImport, APIEndpoint, AnalysisProgress, RepoInfo } from '@/types';
import type { Node, Edge } from '@xyflow/react';
import { parseGitHubUrl, shouldExclude, isCodeFile, parseImports, parseEndpoints, resolveImportPath, getFileExtension } from '@/lib/parser';
import { getDemoNodes, getDemoEdges, getDemoFiles, getDemoEndpoints, DEMO_REPO_INFO } from '@/lib/demoData';
import { toast } from 'sonner';
import dagre from 'dagre';

const MAX_FILES_TO_FETCH = 60;

function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });

  nodes.forEach(n => g.setNode(n.id, { width: 200, height: 60 }));
  edges.forEach(e => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map(n => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - 100, y: pos.y - 30 } };
  });
}

export function useGitHubAnalysis() {
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({ step: 0, message: '', done: false });
  const [isDemo, setIsDemo] = useState(false);

  const loadDemo = useCallback(() => {
    setIsDemo(true);
    setFiles(getDemoFiles());
    setNodes(getDemoNodes());
    setEdges(getDemoEdges());
    setEndpoints(getDemoEndpoints());
    setRepoInfo(DEMO_REPO_INFO);
    setProgress({ step: 5, message: '✅ Demo loaded!', done: true });
  }, []);

  const analyze = useCallback(async (url: string) => {
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      toast.error('Invalid GitHub URL. Use format: https://github.com/owner/repo');
      return;
    }

    setLoading(true);
    setIsDemo(false);
    setProgress({ step: 1, message: '📡 Fetching repository tree...', done: false });

    try {
      // Fetch repo info
      const repoRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
      if (!repoRes.ok) {
        if (repoRes.status === 404) throw new Error('Repository not found or is private');
        if (repoRes.status === 403) throw new Error('GitHub API rate limit reached. Try again in 60 seconds.');
        throw new Error('Failed to fetch repository');
      }
      const repoData = await repoRes.json();
      setRepoInfo({ ...parsed, stars: repoData.stargazers_count, description: repoData.description });

      // Fetch tree
      const treeRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/HEAD?recursive=1`);
      if (!treeRes.ok) throw new Error('Failed to fetch repository tree');
      const treeData = await treeRes.json();

      const allFiles: RepoFile[] = treeData.tree
        .filter((f: any) => !shouldExclude(f.path))
        .map((f: any) => ({ path: f.path, type: f.type, size: f.size }));

      setProgress({ step: 2, message: `📂 Found ${allFiles.length} files, filtering...`, done: false });

      const codeFiles = allFiles.filter(f => f.type === 'blob' && isCodeFile(f.path)).slice(0, MAX_FILES_TO_FETCH);

      setProgress({ step: 3, message: `🔍 Parsing ${codeFiles.length} source files...`, done: false });

      // Fetch file contents
      const contents = await Promise.allSettled(
        codeFiles.map(f =>
          fetch(`https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/HEAD/${f.path}`)
            .then(r => r.ok ? r.text() : null)
        )
      );

      const allFilePaths = allFiles.filter(f => f.type === 'blob').map(f => f.path);
      const allImports: ParsedImport[] = [];
      const allEndpoints: APIEndpoint[] = [];

      codeFiles.forEach((file, i) => {
        const result = contents[i];
        if (result.status === 'fulfilled' && result.value) {
          file.content = result.value;
          allImports.push(...parseImports(result.value, file.path));
          allEndpoints.push(...parseEndpoints(result.value, file.path));
        }
      });

      // Merge code files with all files
      const mergedFiles = allFiles.map(f => {
        const codeFile = codeFiles.find(cf => cf.path === f.path);
        return codeFile || f;
      });

      setFiles(mergedFiles);
      setEndpoints(allEndpoints);

      setProgress({ step: 4, message: '🕸️ Building dependency graph...', done: false });

      // Build nodes for files with content
      const nodesWithContent = codeFiles.filter(f => f.content);
      const nodeList: Node[] = nodesWithContent.map((f, i) => ({
        id: f.path,
        type: 'fileNode',
        position: { x: (i % 6) * 220, y: Math.floor(i / 6) * 120 },
        data: { label: f.path, filePath: f.path },
      }));

      // Build edges
      const edgeList: Edge[] = [];
      let edgeId = 0;
      for (const imp of allImports) {
        const target = resolveImportPath(imp.source, imp.target, allFilePaths);
        if (target && nodeList.find(n => n.id === target)) {
          edgeList.push({
            id: `e${edgeId++}`,
            source: imp.source,
            target,
            animated: true,
          });
        }
      }

      const laidOut = layoutNodes(nodeList, edgeList);
      setNodes(laidOut);
      setEdges(edgeList);

      setProgress({ step: 5, message: `✅ Analysis complete! ${nodeList.length} nodes, ${edgeList.length} connections`, done: true });
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
      setProgress({ step: 0, message: '', done: false });
    } finally {
      setLoading(false);
    }
  }, []);

  return { files, nodes, edges, endpoints, repoInfo, loading, progress, isDemo, analyze, loadDemo, setNodes, setEdges };
}
