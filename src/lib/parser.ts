import type { ParsedImport, APIEndpoint, FileTreeNode, RepoFile } from '@/types';

const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache', '__pycache__', '.vscode'];
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

export function shouldExclude(path: string): boolean {
  return EXCLUDED_DIRS.some(dir => path.startsWith(dir + '/') || path === dir);
}

export function isCodeFile(path: string): boolean {
  return CODE_EXTENSIONS.some(ext => path.endsWith(ext));
}

export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function getFileColor(path: string): string {
  const ext = getFileExtension(path);
  const colors: Record<string, string> = {
    js: '#f1e05a', jsx: '#f1e05a', mjs: '#f1e05a',
    ts: '#3178c6', tsx: '#3178c6',
    css: '#bc8cff', scss: '#bc8cff', less: '#bc8cff',
    json: '#d29922', yaml: '#d29922', yml: '#d29922',
    md: '#e6edf3', mdx: '#e6edf3',
    html: '#e34c26', vue: '#41b883', svelte: '#ff3e00',
    py: '#3572a5', rb: '#701516', go: '#00add8',
    rs: '#dea584', java: '#b07219',
  };
  return colors[ext] || '#8b949e';
}

export function getFileIcon(path: string): string {
  const ext = getFileExtension(path);
  const icons: Record<string, string> = {
    js: '📜', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
    css: '🎨', scss: '🎨', json: '📋', md: '📝',
    html: '🌐', py: '🐍', yaml: '⚙️', yml: '⚙️',
    svg: '🖼️', png: '🖼️', jpg: '🖼️',
  };
  return icons[ext] || '📄';
}

export function parseImports(content: string, filePath: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const patterns = [
    /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const target = match[1];
      if (target.startsWith('.')) {
        imports.push({ source: filePath, target });
      }
    }
  }
  return imports;
}

export function parseEndpoints(content: string, filePath: string): APIEndpoint[] {
  const endpoints: APIEndpoint[] = [];
  const pattern = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    endpoints.push({
      method: match[1].toUpperCase() as APIEndpoint['method'],
      path: match[2],
      file: filePath,
    });
  }

  if (filePath.includes('/api/')) {
    const method = content.includes('POST') ? 'POST' : content.includes('PUT') ? 'PUT' : content.includes('DELETE') ? 'DELETE' : 'GET';
    const routePath = '/' + filePath.replace(/\.(ts|js|tsx|jsx)$/, '').replace(/\/index$/, '');
    endpoints.push({ method: method as APIEndpoint['method'], path: routePath, file: filePath });
  }

  return endpoints;
}

export function buildFileTree(files: RepoFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1 && file.type === 'blob';
      const path = parts.slice(0, i + 1).join('/');

      let existing = current.find(n => n.name === name);
      if (!existing) {
        existing = {
          name,
          path,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
        };
        current.push(existing);
      }
      if (!isFile && existing.children) {
        current = existing.children;
      }
    }
  }

  const sortTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    }).map(n => ({
      ...n,
      children: n.children ? sortTree(n.children) : undefined,
    }));
  };

  return sortTree(root);
}

export function resolveImportPath(sourceFile: string, importPath: string, allFiles: string[]): string | null {
  const sourceDir = sourceFile.split('/').slice(0, -1).join('/');
  let resolved = importPath;

  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const parts = [...sourceDir.split('/'), ...importPath.split('/')];
    const stack: string[] = [];
    for (const part of parts) {
      if (part === '..') stack.pop();
      else if (part !== '.') stack.push(part);
    }
    resolved = stack.join('/');
  }

  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
  for (const ext of extensions) {
    if (allFiles.includes(resolved + ext)) return resolved + ext;
  }
  return null;
}
