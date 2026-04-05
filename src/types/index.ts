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
  handler?: string;
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

export type NodeRole = 'entry' | 'route' | 'service' | 'database' | 'middleware' | 'component' | 'utility' | 'config' | 'model' | 'test';
export type EdgeType = 'import' | 'api_call' | 'db_query' | 'dynamic' | 'middleware';

export interface DatabaseInteraction {
  file: string;
  line: number;
  operation: string;
  model?: string;
  framework: string;
  functionName?: string;
}

export interface FlowStep {
  file: string;
  function?: string;
  action: string;
  type: 'route' | 'handler' | 'service' | 'database' | 'middleware' | 'response' | 'ui';
}

export interface ExecutionFlow {
  name: string;
  trigger: string;
  steps: FlowStep[];
  type: 'api' | 'event' | 'lifecycle';
}

export interface ArchitectureLayers {
  frontend: string[];
  backend: string[];
  database: string[];
  middleware: string[];
  config: string[];
}

export interface AnalysisResult {
  repoInfo: RepoInfo;
  nodes: { id: string; type: string; data: { label: string; filePath: string; role?: NodeRole } }[];
  edges: { id: string; source: string; target: string; edgeType?: EdgeType; isDynamic?: boolean }[];
  endpoints: APIEndpoint[];
  functionMap: Record<string, ParsedFunction[]>;
  dbInteractions: DatabaseInteraction[];
  executionFlows: ExecutionFlow[];
  dbFrameworks: string[];
  layers: ArchitectureLayers;
  folderStructure: string[];
  allFiles: RepoFile[];
  stats: {
    totalFiles: number;
    totalImports: number;
    totalEndpoints: number;
    totalFunctions: number;
    totalDbInteractions: number;
    totalFlows: number;
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
  dbInteractionsCount: number;
  flowsCount: number;
  cached: boolean;
  llmResponseTime?: number;
}
