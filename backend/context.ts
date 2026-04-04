import path from 'path';
import fs from 'fs-extra';
import { GraphNode, GraphEdge } from './analyzer';

export interface FileContext {
  path: string;
  content: string;
  role: string;
  imports: string[];
  callers: string[];
  relatedFunctions: string[];
}

export class ContextBuilder {
  constructor(private repoPath: string) {}

  async buildContext(targetId: string, allNodes: GraphNode[], allEdges: GraphEdge[]): Promise<FileContext> {
    const fullPath = path.join(this.repoPath, targetId);
    const content = await fs.readFile(fullPath, 'utf8');

    // Find relationships
    const imports = allEdges
      .filter(e => e.source === targetId && e.type === 'import')
      .map(e => e.target);

    const callers = allEdges
      .filter(e => e.target === targetId && e.type === 'import')
      .map(e => e.source);
      
    const children = allNodes.filter(n => n.group === targetId);
    
    // Determine the role of the file based on path and content heuristics
    let role = 'Component/Module';
    if (targetId.includes('/api/')) role = 'API Endpoint';
    if (targetId.includes('/hooks/')) role = 'React Hook';
    if (targetId.includes('/lib/') || targetId.includes('/utils/')) role = 'Utility Logic';
    if (content.includes('export default function')) role = 'Main UI Component';

    return {
      path: targetId,
      content,
      role,
      imports,
      callers,
      relatedFunctions: children.map(c => c.id),
    };
  }

  // Optimize tokens: only send necessary function bodies
  chunkCode(content: string): string[] {
    // Basic chunking: split by exported functions/classes
    return content.split(/export (const|function|class)/);
  }
}
