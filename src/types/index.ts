export interface RepoFile {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  content?: string;
}

export interface ParsedImport {
  source: string;
  target: string;
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  file: string;
}

export interface AISummary {
  purpose: string;
  explanation: string;
  dependencies: string[];
  type: string;
  complexity: 'low' | 'medium' | 'high';
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
}

export interface AnalysisProgress {
  step: number;
  message: string;
  done: boolean;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  stars?: number;
  description?: string;
  language?: string;
  defaultBranch?: string;
}

export interface ParsedFunction {
  name: string;
  file: string;
  calls: string[];
  params: string[];
  line: number;
}

export interface AnalysisResult {
  repoInfo: RepoInfo;
  nodes: { id: string; type: string; data: { label: string; filePath: string } }[];
  edges: { id: string; source: string; target: string }[];
  endpoints: APIEndpoint[];
  functionMap: Record<string, ParsedFunction[]>;
  folderStructure: string[];
  allFiles: RepoFile[];
  stats: {
    totalFiles: number;
    totalImports: number;
    totalEndpoints: number;
    totalFunctions: number;
  };
  isLargeRepo: boolean;
  truncated: boolean;
  cached: boolean;
}

export interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  filesAnalyzed: number;
  nodesCount: number;
  edgesCount: number;
  functionsCount: number;
  endpointsCount: number;
  cached: boolean;
  llmResponseTime?: number;
}
