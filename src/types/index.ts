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
}
