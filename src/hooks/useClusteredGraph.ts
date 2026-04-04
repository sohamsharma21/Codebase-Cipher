import { useState, useCallback, useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import dagre from 'dagre';

export interface ClusterNode {
  id: string;          // folder path e.g. "src/components"
  label: string;       // folder name e.g. "components"
  fileCount: number;
  children: string[];  // file IDs inside this cluster
  subClusters: string[]; // child folder IDs
}

interface UseClusteredGraphReturn {
  visibleNodes: Node[];
  visibleEdges: Edge[];
  expandedClusters: Set<string>;
  toggleCluster: (clusterId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  focusNode: (nodeId: string) => void;
  focusedNode: string | null;
  clearFocus: () => void;
}

function getFolder(path: string): string {
  const parts = path.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
}

function getTopFolder(path: string): string {
  const parts = path.split('/');
  return parts.length > 1 ? parts[0] : '.';
}

function layoutNodesWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return [];
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });

  nodes.forEach(n => {
    const isCluster = n.type === 'clusterNode';
    g.setNode(n.id, { width: isCluster ? 180 : 200, height: isCluster ? 50 : 60 });
  });
  edges.forEach(e => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target);
    }
  });

  dagre.layout(g);

  return nodes.map(n => {
    const pos = g.node(n.id);
    if (!pos) return n;
    return { ...n, position: { x: pos.x - 100, y: pos.y - 30 } };
  });
}

export function useClusteredGraph(allNodes: Node[], allEdges: Edge[]): UseClusteredGraphReturn {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [focusedNode, setFocusedNode] = useState<string | null>(null);

  // Build cluster map: group files by their immediate parent folder
  const clusters = useMemo(() => {
    const map = new Map<string, ClusterNode>();

    for (const node of allNodes) {
      const folder = getFolder(node.id);
      if (!map.has(folder)) {
        const parts = folder.split('/');
        map.set(folder, {
          id: folder,
          label: parts[parts.length - 1] || folder,
          fileCount: 0,
          children: [],
          subClusters: [],
        });
      }
      const cluster = map.get(folder)!;
      cluster.children.push(node.id);
      cluster.fileCount++;
    }

    return map;
  }, [allNodes]);

  // Build top-level clusters (group by first directory segment)
  const topClusters = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [folderPath] of clusters) {
      const top = getTopFolder(folderPath);
      if (!map.has(top)) map.set(top, new Set());
      map.get(top)!.add(folderPath);
    }
    return map;
  }, [clusters]);

  // Compute visible nodes and edges based on expansion state
  const { visibleNodes, visibleEdges } = useMemo(() => {
    const nodeSet = new Set<string>();
    const resultNodes: Node[] = [];

    // For each top-level cluster
    for (const [topFolder, subFolders] of topClusters) {
      const isTopExpanded = expandedClusters.has(topFolder);

      if (!isTopExpanded) {
        // Show as a single cluster node
        let totalFiles = 0;
        for (const sf of subFolders) {
          totalFiles += clusters.get(sf)?.fileCount || 0;
        }
        resultNodes.push({
          id: `cluster:${topFolder}`,
          type: 'clusterNode',
          position: { x: 0, y: 0 },
          data: {
            label: topFolder === '.' ? 'root' : topFolder,
            fileCount: totalFiles,
            clusterId: topFolder,
            isExpanded: false,
          },
        });
        nodeSet.add(`cluster:${topFolder}`);
      } else {
        // Show sub-folders or individual files
        for (const sf of subFolders) {
          const cluster = clusters.get(sf)!;
          const isSubExpanded = expandedClusters.has(sf) || sf === topFolder;

          if (!isSubExpanded && sf !== topFolder) {
            // Show sub-folder as cluster node
            resultNodes.push({
              id: `cluster:${sf}`,
              type: 'clusterNode',
              position: { x: 0, y: 0 },
              data: {
                label: cluster.label,
                fileCount: cluster.fileCount,
                clusterId: sf,
                isExpanded: false,
              },
            });
            nodeSet.add(`cluster:${sf}`);
          } else {
            // Show individual files
            for (const fileId of cluster.children) {
              const origNode = allNodes.find(n => n.id === fileId);
              if (origNode) {
                resultNodes.push({ ...origNode });
                nodeSet.add(fileId);
              }
            }
          }
        }
      }
    }

    // Build edge mapping: file -> visible node
    const fileToVisibleNode = new Map<string, string>();
    for (const node of allNodes) {
      const folder = getFolder(node.id);
      const top = getTopFolder(folder);

      if (nodeSet.has(node.id)) {
        fileToVisibleNode.set(node.id, node.id);
      } else if (nodeSet.has(`cluster:${folder}`)) {
        fileToVisibleNode.set(node.id, `cluster:${folder}`);
      } else if (nodeSet.has(`cluster:${top}`)) {
        fileToVisibleNode.set(node.id, `cluster:${top}`);
      }
    }

    // Map edges to visible nodes, dedup
    const edgeSet = new Set<string>();
    const resultEdges: Edge[] = [];
    for (const edge of allEdges) {
      const src = fileToVisibleNode.get(edge.source);
      const tgt = fileToVisibleNode.get(edge.target);
      if (src && tgt && src !== tgt) {
        const key = `${src}->${tgt}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          resultEdges.push({
            id: `ce-${key}`,
            source: src,
            target: tgt,
            animated: true,
          });
        }
      }
    }

    // Layout
    const laid = layoutNodesWithDagre(resultNodes, resultEdges);
    return { visibleNodes: laid, visibleEdges: resultEdges };
  }, [allNodes, allEdges, expandedClusters, clusters, topClusters]);

  const toggleCluster = useCallback((clusterId: string) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      // clusterId might come as "cluster:xxx" from node click
      const id = clusterId.replace(/^cluster:/, '');
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    for (const [topFolder, subFolders] of topClusters) {
      all.add(topFolder);
      for (const sf of subFolders) all.add(sf);
    }
    setExpandedClusters(all);
  }, [topClusters]);

  const collapseAll = useCallback(() => {
    setExpandedClusters(new Set());
  }, []);

  const focusNode = useCallback((nodeId: string) => {
    // Expand clusters to reveal this node
    const folder = getFolder(nodeId);
    const top = getTopFolder(folder);
    setExpandedClusters(prev => {
      const next = new Set(prev);
      next.add(top);
      if (folder !== top) next.add(folder);
      return next;
    });
    setFocusedNode(nodeId);
  }, []);

  const clearFocus = useCallback(() => {
    setFocusedNode(null);
  }, []);

  return {
    visibleNodes,
    visibleEdges,
    expandedClusters,
    toggleCluster,
    expandAll,
    collapseAll,
    focusNode,
    focusedNode,
    clearFocus,
  };
}
