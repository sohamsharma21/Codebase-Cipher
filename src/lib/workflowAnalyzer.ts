import type { RepoFile } from '@/types';

export type ArchitectureType = 'MVC' | 'REST_API' | 'REACT_APP' | 'NEXT_JS' | 'MICROSERVICE' | 'MONOREPO' | 'LIBRARY' | 'UNKNOWN';

export interface ArchitectureMatch {
  type: ArchitectureType;
  description: string;
  confidence: number;
}

export type EntityType = 
  | 'ENTRY_POINT' 
  | 'API_ROUTE' 
  | 'MIDDLEWARE' 
  | 'CONTROLLER' 
  | 'SERVICE' 
  | 'MODEL' 
  | 'DATABASE' 
  | 'PAGE' 
  | 'COMPONENT' 
  | 'HOOK' 
  | 'CONFIG' 
  | 'UTILITY' 
  | 'AUTH'
  | 'UNKNOWN';

export interface FileEntity {
  path: string;
  type: EntityType;
  color: string;
  layer: number;
  icon: string;
  label: string;
}

export interface RouteDef {
  method: string;
  path: string;
  file: string;
  line: number;
}

export interface DbOperation {
  op: 'READ' | 'WRITE' | 'UPDATE' | 'DELETE';
  label: string;
  file: string;
}

export const ENTITY_TYPES: Record<string, Omit<FileEntity, 'path' | 'type'> & { detect: RegExp | string[] }> = {
  // Entry Points
  ENTRY_POINT: {
    detect: ['index.js', 'main.js', 'app.js', 'server.js', 'index.ts', 'main.ts', 'server.ts', 'app.ts'],
    color: '#d29922', layer: 0, icon: '⚡', label: 'Entry Point'
  },
  API_ROUTE: {
    detect: /\.(get|post|put|delete|patch)\s*\(/,
    color: '#58a6ff', layer: 1, icon: '🔗', label: 'API Route'
  },
  MIDDLEWARE: {
    detect: /app\.use\(|router\.use\(|middleware/i,
    color: '#a371f7', layer: 1, icon: '🔒', label: 'Middleware'
  },
  // Business Logic
  CONTROLLER: {
    detect: /controller|Controller/,
    color: '#3fb950', layer: 2, icon: '⚙️', label: 'Controller'
  },
  SERVICE: {
    detect: /service|Service|\.service\./,
    color: '#3fb950', layer: 2, icon: '🔧', label: 'Service'
  },
  // Data Layer
  MODEL: {
    detect: /model|Model|schema|Schema|mongoose|sequelize|prisma/,
    color: '#f0883e', layer: 3, icon: '📦', label: 'Model'
  },
  DATABASE: {
    detect: /mongoose|sequelize|prisma|knex|pg|mysql|redis|supabase/,
    color: '#f85149', layer: 4, icon: '🗄️', label: 'Database'
  },
  // React/Frontend Layer
  PAGE: {
    detect: /pages\/|app\/.*page\.|\.page\./,
    color: '#61dafb', layer: 0, icon: '📄', label: 'Page'
  },
  COMPONENT: {
    detect: /components\/|\.component\.|return.*jsx|return.*tsx/,
    color: '#61dafb', layer: 1, icon: '🧩', label: 'Component'
  },
  HOOK: {
    detect: /^use[A-Z]|hooks\//,
    color: '#a371f7', layer: 2, icon: '🪝', label: 'Custom Hook'
  },
  // Utilities
  CONFIG: {
    detect: /config|\.env|settings/i,
    color: '#8b949e', layer: 0, icon: '⚙️', label: 'Config'
  },
  UTILITY: {
    detect: /utils|helpers|lib\//,
    color: '#8b949e', layer: 3, icon: '🔨', label: 'Utility'
  },
  AUTH: {
    detect: /auth|jwt|passport|session|token/i,
    color: '#a371f7', layer: 1, icon: '🔐', label: 'Auth'
  }
};

export function detectArchitecture(files: RepoFile[], packageJsonContent?: string): ArchitectureMatch {
  const filePaths = files.map(f => f.path.toLowerCase());
  const content = packageJsonContent || '';
  
  const patterns = {
    'MVC': { indicators: ['controllers/', 'models/', 'views/', 'routes/'], description: 'Model-View-Controller pattern' },
    'REST_API': { indicators: ['routes/', 'middleware/', 'controllers/', 'express', 'fastify', 'koa'], description: 'REST API server' },
    'NEXT_JS': { indicators: ['pages/api/', 'app/', 'next.config'], description: 'Next.js full-stack application' },
    'REACT_APP': { indicators: ['components/', 'pages/', 'hooks/', 'react', 'vite'], description: 'React frontend application' },
    'MICROSERVICE': { indicators: ['services/', 'docker-compose', 'kafka', 'rabbitmq'], description: 'Microservices architecture' },
    'MONOREPO': { indicators: ['packages/', 'apps/', 'libs/', 'lerna.json', 'nx.json'], description: 'Monorepo structure' },
    'LIBRARY': { indicators: ['src/index', 'dist/', 'rollup', 'tsup', 'lib/'], description: 'npm library/package' }
  };

  let bestMatch: ArchitectureMatch = { type: 'UNKNOWN', description: 'Unknown Architecture', confidence: 0 };

  for (const [type, data] of Object.entries(patterns)) {
    let matches = 0;
    for (const ind of data.indicators) {
      if (filePaths.some(p => p.includes(ind.toLowerCase())) || content.includes(ind)) {
        matches++;
      }
    }
    const confidence = matches / data.indicators.length;
    if (confidence > bestMatch.confidence) {
      bestMatch = { type: type as ArchitectureType, description: data.description, confidence };
    }
  }

  return bestMatch;
}

export function extractEntity(filePath: string, fileContent: string): FileEntity {
  const name = filePath.split('/').pop() || '';
  for (const [type, def] of Object.entries(ENTITY_TYPES)) {
    if (Array.isArray(def.detect)) {
      if (def.detect.includes(name)) {
        return { path: filePath, type: type as EntityType, color: def.color, layer: def.layer, icon: def.icon, label: def.label };
      }
    } else if (def.detect instanceof RegExp) {
      if (def.detect.test(filePath) || def.detect.test(fileContent)) {
        return { path: filePath, type: type as EntityType, color: def.color, layer: def.layer, icon: def.icon, label: def.label };
      }
    }
  }
  return { path: filePath, type: 'UNKNOWN', color: '#8b949e', layer: 3, icon: '📄', label: 'File' };
}

export function extractRoutes(fileContent: string, filePath: string): RouteDef[] {
  const routes: RouteDef[] = [];
  const expressPattern = /(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  
  if (filePath.includes('/api/')) {
    const methods = fileContent.match(/export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g);
    if (methods) {
      routes.push({
        method: methods[0].match(/(GET|POST|PUT|DELETE|PATCH)/)![0],
        path: filePath.replace(/.*\/pages\/api/, '/api').replace(/\..*$/, ''),
        file: filePath,
        line: 1
      });
    }
  }
  
  let match;
  while ((match = expressPattern.exec(fileContent)) !== null) {
    routes.push({
      method: match[2].toUpperCase(),
      path: match[3],
      file: filePath,
      line: fileContent.substring(0, match.index).split('\n').length
    });
  }
  
  return routes;
}

export function extractDbOperations(fileContent: string, filePath: string): DbOperation[] {
  const ops: DbOperation[] = [];
  const mongooseOps = [
    { pattern: /\.find\(/, op: 'READ', label: 'find()' },
    { pattern: /\.findById\(/, op: 'READ', label: 'findById()' },
    { pattern: /\.findOne\(/, op: 'READ', label: 'findOne()' },
    { pattern: /\.save\(/, op: 'WRITE', label: 'save()' },
    { pattern: /\.create\(/, op: 'WRITE', label: 'create()' },
    { pattern: /\.updateOne\(/, op: 'UPDATE', label: 'updateOne()' },
    { pattern: /\.deleteOne\(/, op: 'DELETE', label: 'deleteOne()' },
    { pattern: /\.aggregate\(/, op: 'READ', label: 'aggregate()' }
  ];
  
  const prismaOps = [
    { pattern: /prisma\.\w+\.findMany/, op: 'READ', label: 'findMany' },
    { pattern: /prisma\.\w+\.create/, op: 'WRITE', label: 'create' },
    { pattern: /prisma\.\w+\.update/, op: 'UPDATE', label: 'update' },
    { pattern: /prisma\.\w+\.delete/, op: 'DELETE', label: 'delete' }
  ];
  
  [...mongooseOps, ...prismaOps].forEach(({ pattern, op, label }) => {
    if (pattern.test(fileContent)) {
      ops.push({ op: op as any, label, file: filePath });
    }
  });
  
  return ops;
}
