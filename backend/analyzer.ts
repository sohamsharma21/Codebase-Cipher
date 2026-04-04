import Parser from 'web-tree-sitter';
import path from 'path';
import fs from 'fs-extra';
import { glob } from 'glob';
import pLimit from 'p-limit';

export interface GraphNode {
  id: string;
  type: 'file' | 'function' | 'folder';
  group: string;
  data?: any;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'import' | 'call' | 'contains';
}

export class CodebaseAnalyzer {
  private parser: Parser | null = null;
  private grammars: Record<string, Parser.Language> = {};

  // Initialize Tree-sitter WASM
  async init() {
    await Parser.init();
    // In a real prod environment, these WASM files would be pre-downloaded or served locally
    // For now, we'll try loading from common paths
    const languages = {
      javascript: 'tree-sitter-javascript.wasm',
      typescript: 'tree-sitter-typescript.wasm',
      tsx: 'tree-sitter-tsx.wasm',
      python: 'tree-sitter-python.wasm',
    };

    for (const [name, filename] of Object.entries(languages)) {
      try {
        const lang = await Parser.Language.load(path.join(__dirname, 'wasm', filename));
        this.grammars[name] = lang;
      } catch (err) {
        console.warn(`Could not load grammar for ${name}: ${err}`);
      }
    }
    this.parser = new Parser();
  }

  private getLanguage(ext: string): string | null {
    if (/\.(js|jsx|mjs|cjs)$/.test(ext)) return 'javascript';
    if (/\.ts$/.test(ext)) return 'typescript';
    if (/\.tsx$/.test(ext)) return 'tsx';
    if (/\.py$/.test(ext)) return 'python';
    return null;
  }

  async analyzeRepo(repoPath: string) {
    const files = await glob('**/*.{js,jsx,ts,tsx,py}', { 
      cwd: repoPath, 
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
    });

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const fileToImports = new Map<string, string[]>();

    // Batch process files using a limit to avoid memory bloat (10k+ files)
    const limit = pLimit(20); 
    const tasks = files.map(file => limit(async () => {
      const fullPath = path.join(repoPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      const langName = this.getLanguage(file);
      
      if (!langName || !this.grammars[langName]) return;

      this.parser!.setLanguage(this.grammars[langName]);
      const tree = this.parser!.parse(content);

      // Add file node
      nodes.push({ id: file, type: 'file', group: path.dirname(file) });

      // AST Queries for imports and functions
      const query = this.getQueryForLanguage(langName);
      const matches = query.captures(tree.rootNode);

      const imports: string[] = [];
      const functions: { name: string; node: Parser.SyntaxNode }[] = [];

      for (const match of matches) {
        if (match.name === 'import.path') {
          imports.push(match.node.text.replace(/['"]/g, ''));
        } else if (match.name === 'function.name') {
          const fnName = match.node.text;
          const fnId = `${file}:${fnName}`;
          nodes.push({ id: fnId, type: 'function', group: file });
          edges.push({ source: file, target: fnId, type: 'contains' });
          functions.push({ name: fnName, node: match.node });
        }
      }

      fileToImports.set(file, imports);
      tree.delete();
    }));

    await Promise.all(tasks);

    // Resolve imports (the "resolver" logic)
    for (const [file, imports] of fileToImports.entries()) {
      for (const imp of imports) {
        const resolved = this.resolvePath(file, imp, files);
        if (resolved) {
          edges.push({ source: file, target: resolved, type: 'import' });
        }
      }
    }

    return { nodes, edges };
  }

  private getQueryForLanguage(langName: string) {
    // Basic queries for demonstration — expanded versions would handle dynamic imports, etc.
    const queries: Record<string, string> = {
      javascript: `
        (import_statement source: (string (string_fragment) @import.path))
        (call_expression function: (identifier) @call.name)
        (function_declaration name: (identifier) @function.name)
        (variable_declarator name: (identifier) @function.name value: (arrow_function))
      `,
      typescript: `
        (import_statement source: (string (string_fragment) @import.path))
        (function_declaration name: (identifier) @function.name)
      `,
      python: `
        (import_from_statement module_name: (dotted_name) @import.path)
        (import_statement name: (dotted_name) @import.path)
        (function_definition name: (identifier) @function.name)
      `
    };

    return this.grammars[langName].query(queries[langName] || queries.javascript);
  }

  private resolvePath(sourceFile: string, importPath: string, allFiles: string[]): string | null {
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      const sourceDir = path.dirname(sourceFile);
      const absolutePath = path.posix.normalize(path.join(sourceDir, importPath));
      const candidates = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      
      for (const ext of candidates) {
        if (allFiles.includes(absolutePath + ext)) return absolutePath + ext;
      }
    }
    // Handle module aliases or external deps could go here
    return null;
  }
}
