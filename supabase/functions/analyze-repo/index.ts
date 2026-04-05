import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ───────────────────────────────────────────────────────────

interface ParsedImport { source: string; target: string; isDynamic?: boolean }
interface ParsedEndpoint { method: string; path: string; file: string; handler?: string }
interface ParsedFunction { name: string; file: string; calls: string[]; params: string[]; line: number }
interface DatabaseInteraction { file: string; line: number; operation: string; model?: string; framework: string; functionName?: string }
interface ExecutionFlow { name: string; trigger: string; steps: FlowStep[]; type: 'api' | 'event' | 'lifecycle' }
interface FlowStep { file: string; function?: string; action: string; type: 'route' | 'handler' | 'service' | 'database' | 'middleware' | 'response' | 'ui' }

const JS_TS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const PYTHON_EXTENSIONS = [".py"];
const EXCLUDED_DIRS = [
  "node_modules", ".git", "dist", "build", "coverage",
  ".next", ".cache", "__pycache__", ".vscode", ".idea",
  "vendor", "venv", ".env", ".tox", "egg-info",
  ".nuxt", ".output", ".turbo", ".parcel-cache",
];

function getExt(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i) : "";
}

function isCodeFile(path: string): boolean {
  const ext = getExt(path);
  return [...JS_TS_EXTENSIONS, ...PYTHON_EXTENSIONS].includes(ext);
}

function shouldExclude(path: string): boolean {
  const segments = path.split("/");
  return segments.some(s => EXCLUDED_DIRS.includes(s));
}

// ── JS/TS parsing ───────────────────────────────────────────────────

function parseJSImports(content: string, filePath: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const patterns: [RegExp, boolean][] = [
    [/import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g, false],
    [/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, false],
    [/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, true],
    [/require\.resolve\s*\(\s*['"]([^'"]+)['"]\s*\)/g, true],
    [/export\s+\*\s+from\s+['"]([^'"]+)['"]/g, false],
    [/export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g, false],
  ];
  for (const [p, isDynamic] of patterns) {
    let m;
    while ((m = p.exec(content)) !== null) {
      imports.push({ source: filePath, target: m[1], isDynamic });
    }
  }
  return imports;
}

function parseJSEndpoints(content: string, filePath: string): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  // Express/Hono style
  const express = /(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*(\w+))?/gi;
  let m;
  while ((m = express.exec(content)) !== null) {
    endpoints.push({ method: m[1].toUpperCase(), path: m[2], file: filePath, handler: m[3] || undefined });
  }
  // Next.js API routes
  if (filePath.includes("/api/") && (filePath.endsWith(".ts") || filePath.endsWith(".js"))) {
    const exportedMethods = content.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/g);
    if (exportedMethods) {
      const routePath = "/" + filePath.replace(/\.(ts|js|tsx|jsx)$/, "").replace(/\/index$/, "").replace(/\/route$/, "");
      for (const em of exportedMethods) {
        const method = em.match(/(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/)![0];
        endpoints.push({ method, path: routePath, file: filePath });
      }
    }
  }
  return endpoints;
}

function parseJSFunctions(content: string, filePath: string): ParsedFunction[] {
  const fns: ParsedFunction[] = [];
  const lines = content.split("\n");
  const patterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
    /(\w+)\s*\(([^)]*)\)\s*\{/g,
  ];
  const reserved = new Set(["if", "for", "while", "switch", "catch", "return", "new", "typeof", "import", "require", "console", "class", "super", "this", "throw", "try", "else", "case", "break", "continue", "do", "void", "delete", "in", "of", "instanceof", "yield", "await"]);
  const seen = new Set<string>();

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) {
      const name = m[1];
      if (reserved.has(name) || seen.has(name)) continue;
      seen.add(name);
      const params = m[2] ? m[2].split(",").map((p: string) => p.trim().split(":")[0].split("=")[0].trim()).filter(Boolean) : [];
      const lineNum = content.slice(0, m.index).split("\n").length;
      const bodyStart = lineNum - 1;
      const bodyEnd = Math.min(bodyStart + 50, lines.length);
      const bodyText = lines.slice(bodyStart, bodyEnd).join("\n");
      const callPattern = /(\w+)\s*\(/g;
      const calls: string[] = [];
      let cm;
      while ((cm = callPattern.exec(bodyText)) !== null) {
        const callee = cm[1];
        if (callee !== name && !reserved.has(callee) && !calls.includes(callee)) {
          calls.push(callee);
        }
      }
      fns.push({ name, file: filePath, calls, params, line: lineNum });
    }
  }
  return fns;
}

// ── Database interaction detection ──────────────────────────────────

function detectDatabaseInteractions(content: string, filePath: string): DatabaseInteraction[] {
  const interactions: DatabaseInteraction[] = [];
  const lines = content.split("\n");

  const patterns: { regex: RegExp; framework: string; getOp: (m: RegExpExecArray) => string; getModel?: (m: RegExpExecArray) => string }[] = [
    // Prisma
    { regex: /prisma\.(\w+)\.(findMany|findFirst|findUnique|create|update|delete|upsert|count|aggregate|groupBy)\s*\(/g, framework: 'Prisma', getOp: m => m[2], getModel: m => m[1] },
    // Mongoose
    { regex: /(\w+)\.(find|findOne|findById|create|save|updateOne|updateMany|deleteOne|deleteMany|countDocuments|aggregate)\s*\(/g, framework: 'Mongoose', getOp: m => m[2], getModel: m => m[1] },
    // Sequelize
    { regex: /(\w+)\.(findAll|findOne|findByPk|create|update|destroy|bulkCreate|count)\s*\(/g, framework: 'Sequelize', getOp: m => m[2], getModel: m => m[1] },
    // TypeORM
    { regex: /(?:getRepository|getManager)\s*\((\w+)\)\.(find|findOne|save|delete|update|createQueryBuilder)\s*\(/g, framework: 'TypeORM', getOp: m => m[2], getModel: m => m[1] },
    // Knex / raw SQL
    { regex: /(?:knex|db|pool|client)\s*(?:\.)?\s*(?:query|raw|select|insert|update|delete|from)\s*\(/g, framework: 'SQL/Knex', getOp: m => m[0].includes('select') ? 'select' : m[0].includes('insert') ? 'insert' : m[0].includes('update') ? 'update' : m[0].includes('delete') ? 'delete' : 'query' },
    // Supabase
    { regex: /supabase\s*\.from\s*\(\s*['"](\w+)['"]\s*\)\s*\.(select|insert|update|delete|upsert)\s*\(/g, framework: 'Supabase', getOp: m => m[2], getModel: m => m[1] },
    // MongoDB native
    { regex: /(?:collection|db)\s*\.\s*(?:(\w+)\s*\.\s*)?(find|insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|aggregate)\s*\(/g, framework: 'MongoDB', getOp: m => m[2] },
    // SQLAlchemy (Python)
    { regex: /session\.(query|add|delete|commit|execute|flush)\s*\(/g, framework: 'SQLAlchemy', getOp: m => m[1] },
    // Django ORM
    { regex: /(\w+)\.objects\.(all|filter|get|create|update|delete|exclude|aggregate|annotate|count)\s*\(/g, framework: 'Django ORM', getOp: m => m[2], getModel: m => m[1] },
    // FastAPI/SQLModel
    { regex: /(?:session|db)\.(exec|execute|add|delete|get|refresh)\s*\(/g, framework: 'SQLModel', getOp: m => m[1] },
  ];

  for (const { regex, framework, getOp, getModel } of patterns) {
    let m;
    while ((m = regex.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split("\n").length;
      // Try to find enclosing function
      let functionName: string | undefined;
      for (let i = lineNum - 1; i >= Math.max(0, lineNum - 20); i--) {
        const fnMatch = lines[i]?.match(/(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|(\w+)\s*\([^)]*\)\s*\{|def\s+(\w+))/);
        if (fnMatch) {
          functionName = fnMatch[1] || fnMatch[2] || fnMatch[3] || fnMatch[4];
          break;
        }
      }
      interactions.push({
        file: filePath,
        line: lineNum,
        operation: getOp(m),
        model: getModel ? getModel(m) : undefined,
        framework,
        functionName,
      });
    }
  }
  return interactions;
}

// ── Node type classification ────────────────────────────────────────

type NodeRole = 'entry' | 'route' | 'service' | 'database' | 'middleware' | 'component' | 'utility' | 'config' | 'model' | 'test';

function classifyFile(filePath: string, content: string, hasEndpoints: boolean, hasDbInteractions: boolean): NodeRole {
  const name = filePath.split('/').pop() || '';
  const lower = filePath.toLowerCase();

  if (name.match(/^(index|main|app|server)\.(ts|js|tsx|jsx)$/)) return 'entry';
  if (lower.includes('test') || lower.includes('spec') || lower.includes('__test__')) return 'test';
  if (lower.includes('config') || name.match(/\.(json|yaml|yml|toml)$/)) return 'config';
  if (hasEndpoints || lower.includes('route') || lower.includes('controller') || lower.includes('/api/')) return 'route';
  if (hasDbInteractions || lower.includes('model') || lower.includes('schema') || lower.includes('migration') || lower.includes('entity')) return 'database';
  if (lower.includes('middleware') || lower.includes('guard') || lower.includes('interceptor')) return 'middleware';
  if (lower.includes('service') || lower.includes('provider') || lower.includes('repository')) return 'service';
  if (name.match(/\.(tsx|jsx)$/) || lower.includes('component') || lower.includes('widget') || lower.includes('page') || lower.includes('view')) return 'component';
  if (lower.includes('util') || lower.includes('helper') || lower.includes('lib') || lower.includes('hook')) return 'utility';
  if (lower.includes('model') || lower.includes('type') || lower.includes('interface')) return 'model';
  return 'utility';
}

// ── Execution flow detection ────────────────────────────────────────

function detectExecutionFlows(
  files: { path: string; content: string }[],
  endpoints: ParsedEndpoint[],
  functionMap: Record<string, ParsedFunction[]>,
  dbInteractions: DatabaseInteraction[],
  edges: { source: string; target: string }[]
): ExecutionFlow[] {
  const flows: ExecutionFlow[] = [];
  const adjacency = new Map<string, string[]>();
  edges.forEach(e => {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  });

  // Build function lookup
  const fnLookup = new Map<string, { file: string; calls: string[] }>();
  for (const [file, fns] of Object.entries(functionMap)) {
    for (const fn of fns) {
      fnLookup.set(fn.name, { file, calls: fn.calls });
    }
  }

  // For each endpoint, trace execution path
  for (const ep of endpoints.slice(0, 30)) {
    const steps: FlowStep[] = [];
    steps.push({ file: ep.file, action: `${ep.method} ${ep.path}`, type: 'route' });

    // Find handler function
    if (ep.handler && fnLookup.has(ep.handler)) {
      const handler = fnLookup.get(ep.handler)!;
      steps.push({ file: handler.file, function: ep.handler, action: `Handler: ${ep.handler}()`, type: 'handler' });

      // Trace calls from handler
      const visited = new Set<string>();
      function traceCalls(fnName: string, depth: number) {
        if (depth > 4 || visited.has(fnName)) return;
        visited.add(fnName);
        const fn = fnLookup.get(fnName);
        if (!fn) return;
        for (const call of fn.calls) {
          const calledFn = fnLookup.get(call);
          if (calledFn) {
            const dbHit = dbInteractions.find(d => d.functionName === call);
            steps.push({
              file: calledFn.file,
              function: call,
              action: dbHit ? `DB: ${dbHit.operation}(${dbHit.model || ''})` : `Call: ${call}()`,
              type: dbHit ? 'database' : 'service',
            });
            traceCalls(call, depth + 1);
          }
        }
      }
      traceCalls(ep.handler, 0);
    }

    // Check if the endpoint file has DB interactions
    const fileDbOps = dbInteractions.filter(d => d.file === ep.file);
    for (const db of fileDbOps.slice(0, 3)) {
      if (!steps.some(s => s.type === 'database' && s.file === db.file)) {
        steps.push({
          file: db.file,
          function: db.functionName,
          action: `DB: ${db.framework} ${db.operation}(${db.model || ''})`,
          type: 'database',
        });
      }
    }

    // Add response step
    steps.push({ file: ep.file, action: 'Response → Client', type: 'response' });

    // Follow import dependencies for services
    const fileDeps = adjacency.get(ep.file) || [];
    for (const dep of fileDeps.slice(0, 3)) {
      const depDbOps = dbInteractions.filter(d => d.file === dep);
      if (depDbOps.length > 0 && !steps.some(s => s.file === dep)) {
        const insertIdx = steps.length - 1; // before response
        steps.splice(insertIdx, 0, {
          file: dep,
          action: `Service: ${dep.split('/').pop()}`,
          type: 'service',
        });
        for (const db of depDbOps.slice(0, 2)) {
          steps.splice(insertIdx + 1, 0, {
            file: dep,
            function: db.functionName,
            action: `DB: ${db.framework} ${db.operation}(${db.model || ''})`,
            type: 'database',
          });
        }
      }
    }

    flows.push({
      name: `${ep.method} ${ep.path}`,
      trigger: 'HTTP Request',
      steps,
      type: 'api',
    });
  }

  // Detect lifecycle flows (main entry → app bootstrap)
  const entryFiles = files.filter(f => {
    const name = f.path.split('/').pop() || '';
    return name.match(/^(index|main|app|server)\.(ts|js|tsx|jsx)$/);
  });

  for (const entry of entryFiles.slice(0, 3)) {
    const deps = adjacency.get(entry.path) || [];
    if (deps.length > 0) {
      const steps: FlowStep[] = [
        { file: entry.path, action: `Entry: ${entry.path.split('/').pop()}`, type: 'route' },
      ];
      for (const dep of deps.slice(0, 5)) {
        const role = classifyFile(dep, '', endpoints.some(e => e.file === dep), dbInteractions.some(d => d.file === dep));
        steps.push({
          file: dep,
          action: `Load: ${dep.split('/').pop()}`,
          type: role === 'route' ? 'route' : role === 'database' ? 'database' : role === 'middleware' ? 'middleware' : 'service',
        });
      }
      flows.push({
        name: `App Bootstrap (${entry.path.split('/').pop()})`,
        trigger: 'Application Start',
        steps,
        type: 'lifecycle',
      });
    }
  }

  return flows.slice(0, 50);
}

// ── Python parsing ──────────────────────────────────────────────────

function parsePythonImports(content: string, filePath: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const p1 = /^import\s+(\S+)/gm;
  const p2 = /^from\s+(\S+)\s+import/gm;
  let m;
  while ((m = p1.exec(content)) !== null) imports.push({ source: filePath, target: m[1] });
  while ((m = p2.exec(content)) !== null) imports.push({ source: filePath, target: m[1] });
  const dyn = /importlib\.import_module\s*\(\s*['"]([^'"]+)['"]/g;
  while ((m = dyn.exec(content)) !== null) imports.push({ source: filePath, target: m[1], isDynamic: true });
  return imports;
}

function parsePythonEndpoints(content: string, filePath: string): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  const decorator = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
  let m;
  while ((m = decorator.exec(content)) !== null) {
    // Try to find handler function name
    const afterDecorator = content.slice(m.index + m[0].length);
    const handlerMatch = afterDecorator.match(/(?:async\s+)?def\s+(\w+)/);
    endpoints.push({ method: m[1].toUpperCase(), path: m[2], file: filePath, handler: handlerMatch?.[1] });
  }
  const flask = /@(?:app|bp|blueprint)\.route\s*\(\s*['"]([^'"]+)['"](?:.*methods\s*=\s*\[([^\]]+)\])?/gi;
  while ((m = flask.exec(content)) !== null) {
    const methods = m[2] ? m[2].replace(/['"]/g, "").split(",").map((s: string) => s.trim()) : ["GET"];
    for (const method of methods) {
      endpoints.push({ method: method.toUpperCase(), path: m[1], file: filePath });
    }
  }
  const django = /path\s*\(\s*['"]([^'"]+)['"]/g;
  while ((m = django.exec(content)) !== null) {
    endpoints.push({ method: "GET", path: "/" + m[1], file: filePath });
  }
  return endpoints;
}

function parsePythonFunctions(content: string, filePath: string): ParsedFunction[] {
  const fns: ParsedFunction[] = [];
  const pattern = /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm;
  const lines = content.split("\n");
  let m;
  while ((m = pattern.exec(content)) !== null) {
    const name = m[1];
    const params = m[2] ? m[2].split(",").map((p: string) => p.trim().split(":")[0].split("=")[0].trim()).filter((p: string) => p && p !== "self" && p !== "cls") : [];
    const lineNum = content.slice(0, m.index).split("\n").length;
    const bodyStart = lineNum;
    const calls: string[] = [];
    for (let i = bodyStart; i < Math.min(bodyStart + 30, lines.length); i++) {
      const line = lines[i];
      if (i > bodyStart && line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t")) break;
      const callPattern = /(\w+)\s*\(/g;
      let cm;
      while ((cm = callPattern.exec(line)) !== null) {
        const callee = cm[1];
        if (callee !== name && !["if", "for", "while", "print", "len", "range", "str", "int", "float", "list", "dict", "set", "tuple", "type", "isinstance", "hasattr", "getattr"].includes(callee) && !calls.includes(callee)) {
          calls.push(callee);
        }
      }
    }
    fns.push({ name, file: filePath, calls, params, line: lineNum });
  }
  return fns;
}

// ── Unified parse dispatcher ────────────────────────────────────────

function parseFile(content: string, filePath: string) {
  const ext = getExt(filePath);
  const isPython = PYTHON_EXTENSIONS.includes(ext);
  return {
    imports: isPython ? parsePythonImports(content, filePath) : parseJSImports(content, filePath),
    endpoints: isPython ? parsePythonEndpoints(content, filePath) : parseJSEndpoints(content, filePath),
    functions: isPython ? parsePythonFunctions(content, filePath) : parseJSFunctions(content, filePath),
    dbInteractions: detectDatabaseInteractions(content, filePath),
  };
}

// ── Resolve imports to actual file paths ────────────────────────────

function resolveImportPath(sourceFile: string, importPath: string, fileSet: Set<string>): string | null {
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) return null;
  const sourceDir = sourceFile.split("/").slice(0, -1).join("/");
  const parts = [...sourceDir.split("/"), ...importPath.split("/")];
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "..") stack.pop();
    else if (part !== "." && part !== "") stack.push(part);
  }
  const resolved = stack.join("/");
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", "/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/index.mjs", "/__init__.py"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

function resolveAliasPath(importPath: string, fileSet: Set<string>): string | null {
  if (importPath.startsWith("@/")) {
    const stripped = importPath.slice(2);
    const prefixes = ["src/", ""];
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
    for (const prefix of prefixes) {
      for (const ext of extensions) {
        const candidate = prefix + stripped + ext;
        if (fileSet.has(candidate)) return candidate;
      }
    }
  }
  if (importPath.startsWith("~/")) {
    const stripped = importPath.slice(2);
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"];
    for (const ext of extensions) {
      const candidate = "src/" + stripped + ext;
      if (fileSet.has(candidate)) return candidate;
    }
  }
  return null;
}

// ── Edge type classification ────────────────────────────────────────

type EdgeType = 'import' | 'api_call' | 'db_query' | 'dynamic' | 'middleware';

function classifyEdge(source: string, target: string, isDynamic: boolean, dbFiles: Set<string>, routeFiles: Set<string>, middlewareFiles: Set<string>): EdgeType {
  if (isDynamic) return 'dynamic';
  if (dbFiles.has(target)) return 'db_query';
  if (routeFiles.has(source) && !routeFiles.has(target)) return 'api_call';
  if (middlewareFiles.has(target)) return 'middleware';
  return 'import';
}

// ── Build graph from parsed data ────────────────────────────────────

function buildGraph(files: { path: string; content: string }[], allFilePaths: string[]) {
  const allImports: ParsedImport[] = [];
  const allEndpoints: ParsedEndpoint[] = [];
  const allFunctions: ParsedFunction[] = [];
  const allDbInteractions: DatabaseInteraction[] = [];
  const fileSet = new Set(allFilePaths);
  const fileContentMap = new Map<string, string>();

  for (const file of files) {
    fileContentMap.set(file.path, file.content);
    try {
      const result = parseFile(file.content, file.path);
      allImports.push(...result.imports);
      allEndpoints.push(...result.endpoints);
      allFunctions.push(...result.functions);
      allDbInteractions.push(...result.dbInteractions);
    } catch { /* skip */ }
  }

  // Build function map
  const functionMap: Record<string, ParsedFunction[]> = {};
  for (const fn of allFunctions) {
    if (!functionMap[fn.file]) functionMap[fn.file] = [];
    functionMap[fn.file].push(fn);
  }

  // Classify files
  const endpointFiles = new Set(allEndpoints.map(e => e.file));
  const dbFiles = new Set(allDbInteractions.map(d => d.file));
  const middlewareFiles = new Set(files.filter(f => f.path.toLowerCase().includes('middleware')).map(f => f.path));

  // Build nodes with roles
  const nodes = files.map(f => {
    const role = classifyFile(f.path, f.content, endpointFiles.has(f.path), dbFiles.has(f.path));
    return {
      id: f.path,
      type: "fileNode",
      data: { label: f.path, filePath: f.path, role },
    };
  });

  // Build edges with types
  const edges: { id: string; source: string; target: string; isDynamic?: boolean; edgeType: EdgeType }[] = [];
  const edgeSet = new Set<string>();
  let edgeId = 0;

  for (const imp of allImports) {
    let target = resolveImportPath(imp.source, imp.target, fileSet);
    if (!target) target = resolveAliasPath(imp.target, fileSet);
    if (target && files.some(f => f.path === target)) {
      const key = `${imp.source}->${target}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        const edgeType = classifyEdge(imp.source, target, !!imp.isDynamic, dbFiles, endpointFiles, middlewareFiles);
        edges.push({ id: `e${edgeId++}`, source: imp.source, target, isDynamic: imp.isDynamic, edgeType });
      }
    }
  }

  // Detect circular dependencies
  const circularDeps: string[][] = [];
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  }
  const visited = new Set<string>();
  const stack = new Set<string>();
  function dfs(node: string, path: string[]) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) circularDeps.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    for (const neighbor of adjacency.get(node) || []) {
      dfs(neighbor, [...path, node]);
    }
    stack.delete(node);
  }
  for (const node of adjacency.keys()) dfs(node, []);

  // Detect execution flows
  const executionFlows = detectExecutionFlows(files, allEndpoints, functionMap, allDbInteractions, edges);

  // Detect database framework
  const dbFrameworks = [...new Set(allDbInteractions.map(d => d.framework))];

  // Build folder structure
  const folders = new Set<string>();
  for (const f of files) {
    const parts = f.path.split("/");
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join("/"));
    }
  }

  // Architecture layers
  const layers = {
    frontend: files.filter(f => f.path.match(/\.(tsx|jsx)$/) || f.path.includes('component') || f.path.includes('page') || f.path.includes('view')).map(f => f.path),
    backend: files.filter(f => endpointFiles.has(f.path) || f.path.includes('service') || f.path.includes('controller')).map(f => f.path),
    database: files.filter(f => dbFiles.has(f.path) || f.path.includes('model') || f.path.includes('migration') || f.path.includes('schema')).map(f => f.path),
    middleware: files.filter(f => middlewareFiles.has(f.path)).map(f => f.path),
    config: files.filter(f => f.path.match(/\.(json|yaml|yml|toml)$/) || f.path.includes('config')).map(f => f.path),
  };

  return {
    nodes,
    edges,
    endpoints: allEndpoints,
    functionMap,
    dbInteractions: allDbInteractions,
    executionFlows,
    dbFrameworks,
    layers,
    folderStructure: Array.from(folders).sort(),
    circularDeps: circularDeps.slice(0, 50),
    stats: {
      totalFiles: files.length,
      totalImports: allImports.length,
      totalEndpoints: allEndpoints.length,
      totalFunctions: allFunctions.length,
      totalDbInteractions: allDbInteractions.length,
      totalFlows: executionFlows.length,
      dynamicImports: allImports.filter(i => i.isDynamic).length,
      circularDeps: circularDeps.length,
    },
  };
}

// ── Simple in-memory cache ──────────────────────────────────────────

const analysisCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function getCached(key: string): unknown | null {
  const entry = analysisCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { analysisCache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: unknown) {
  if (analysisCache.size > 100) {
    const entries = [...analysisCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 20; i++) analysisCache.delete(entries[i][0]);
  }
  analysisCache.set(key, { data, timestamp: Date.now() });
}

// ── GitHub API helpers ──────────────────────────────────────────────

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Accept": "application/vnd.github.v3+json", "User-Agent": "CodebaseCipher/3.0" };
  const token = Deno.env.get("GITHUB_TOKEN");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// ── Main handler ────────────────────────────────────────────────────

const MAX_FILES = 500;
const BATCH_SIZE = 30;
const LARGE_REPO_THRESHOLD = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { owner, repo, branch } = await req.json();
    if (!owner || !repo) {
      return new Response(JSON.stringify({ error: "owner and repo are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = `${owner}/${repo}/${branch || "HEAD"}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ ...cached as Record<string, unknown>, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghHeaders = getGitHubHeaders();

    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
    if (!repoRes.ok) {
      const status = repoRes.status;
      if (status === 404) throw new Error("Repository not found or is private");
      if (status === 403) throw new Error("GitHub API rate limit reached. Try again later.");
      throw new Error(`Failed to fetch repository (${status})`);
    }
    const repoData = await repoRes.json();

    const ref = branch || repoData.default_branch || "HEAD";
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`, { headers: ghHeaders });
    if (!treeRes.ok) throw new Error("Failed to fetch repository tree");
    const treeData = await treeRes.json();

    const allTreeFiles = (treeData.tree || [])
      .filter((f: { path: string; type: string }) => f.type === "blob" && !shouldExclude(f.path));

    const allFilePaths = allTreeFiles.map((f: { path: string }) => f.path);

    const priorityFiles = allTreeFiles
      .filter((f: { path: string }) => isCodeFile(f.path))
      .sort((a: { path: string }, b: { path: string }) => getFilePriority(b.path) - getFilePriority(a.path))
      .slice(0, MAX_FILES);

    const isLargeRepo = allTreeFiles.length > LARGE_REPO_THRESHOLD;

    const filesWithContent: { path: string; content: string }[] = [];
    for (let i = 0; i < priorityFiles.length; i += BATCH_SIZE) {
      const batch = priorityFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((f: { path: string; size?: number }) => {
          if (f.size && f.size > 100000) return Promise.resolve(null);
          return fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${f.path}`, { headers: ghHeaders })
            .then(r => r.ok ? r.text() : null)
            .then(content => content ? { path: f.path, content } : null);
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) filesWithContent.push(r.value);
      }
    }

    const graph = buildGraph(filesWithContent, allFilePaths);

    const result = {
      repoInfo: {
        owner, repo,
        stars: repoData.stargazers_count,
        description: repoData.description,
        defaultBranch: repoData.default_branch,
        language: repoData.language,
        forks: repoData.forks_count,
        size: repoData.size,
      },
      ...graph,
      allFiles: allTreeFiles.map((f: { path: string; size?: number }) => ({ path: f.path, type: "blob" as const, size: f.size })),
      isLargeRepo,
      truncated: priorityFiles.length >= MAX_FILES,
      totalRepoFiles: allTreeFiles.length,
      cached: false,
    };

    setCache(cacheKey, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-repo error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getFilePriority(path: string): number {
  let score = 0;
  const name = path.split("/").pop() || "";
  if (name === "index.ts" || name === "index.js" || name === "main.ts" || name === "main.js") score += 10;
  if (name === "app.ts" || name === "app.js" || name === "App.tsx" || name === "App.jsx") score += 10;
  if (name === "server.ts" || name === "server.js") score += 8;
  if (name === "routes.ts" || name === "router.ts") score += 7;
  if (name.includes("config")) score += 5;
  const depth = path.split("/").length;
  score -= depth;
  if (path.includes("test") || path.includes("spec") || path.includes("__test__")) score -= 5;
  return score;
}
