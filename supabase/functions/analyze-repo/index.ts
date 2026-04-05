import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Language-aware parsers ──────────────────────────────────────────

interface ParsedImport { source: string; target: string; isDynamic?: boolean }
interface ParsedEndpoint { method: string; path: string; file: string }
interface ParsedFunction { name: string; file: string; calls: string[]; params: string[]; line: number }

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
    [/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, true],       // dynamic import
    [/require\.resolve\s*\(\s*['"]([^'"]+)['"]\s*\)/g, true],
    [/export\s+\*\s+from\s+['"]([^'"]+)['"]/g, false],     // re-exports
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
  // Express-style
  const express = /(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]/gi;
  let m;
  while ((m = express.exec(content)) !== null) {
    endpoints.push({ method: m[1].toUpperCase(), path: m[2], file: filePath });
  }
  // Hono
  const hono = /(?:app|c|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
  while ((m = hono.exec(content)) !== null) {
    if (!endpoints.some(e => e.path === m![2] && e.method === m![1].toUpperCase())) {
      endpoints.push({ method: m[1].toUpperCase(), path: m[2], file: filePath });
    }
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
    /(\w+)\s*\(([^)]*)\)\s*\{/g, // class methods
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

// ── Python parsing ──────────────────────────────────────────────────

function parsePythonImports(content: string, filePath: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const p1 = /^import\s+(\S+)/gm;
  const p2 = /^from\s+(\S+)\s+import/gm;
  let m;
  while ((m = p1.exec(content)) !== null) imports.push({ source: filePath, target: m[1] });
  while ((m = p2.exec(content)) !== null) imports.push({ source: filePath, target: m[1] });
  // Dynamic imports
  const dyn = /importlib\.import_module\s*\(\s*['"]([^'"]+)['"]/g;
  while ((m = dyn.exec(content)) !== null) imports.push({ source: filePath, target: m[1], isDynamic: true });
  return imports;
}

function parsePythonEndpoints(content: string, filePath: string): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  const decorator = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
  let m;
  while ((m = decorator.exec(content)) !== null) {
    endpoints.push({ method: m[1].toUpperCase(), path: m[2], file: filePath });
  }
  const flask = /@(?:app|bp|blueprint)\.route\s*\(\s*['"]([^'"]+)['"](?:.*methods\s*=\s*\[([^\]]+)\])?/gi;
  while ((m = flask.exec(content)) !== null) {
    const methods = m[2] ? m[2].replace(/['"]/g, "").split(",").map((s: string) => s.trim()) : ["GET"];
    for (const method of methods) {
      endpoints.push({ method: method.toUpperCase(), path: m[1], file: filePath });
    }
  }
  // Django URLs
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
    
    // Extract calls from function body (indented block)
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

// ── Alias resolution (@ paths, ~ paths) ─────────────────────────────

function resolveAliasPath(importPath: string, fileSet: Set<string>): string | null {
  // Handle @/ alias (common in Vite/Next.js)
  if (importPath.startsWith("@/")) {
    const stripped = importPath.slice(2); // remove @/
    const prefixes = ["src/", ""];
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
    for (const prefix of prefixes) {
      for (const ext of extensions) {
        const candidate = prefix + stripped + ext;
        if (fileSet.has(candidate)) return candidate;
      }
    }
  }
  // Handle ~/ alias
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

// ── Build graph from parsed data ────────────────────────────────────

function buildGraph(files: { path: string; content: string }[], allFilePaths: string[]) {
  const allImports: ParsedImport[] = [];
  const allEndpoints: ParsedEndpoint[] = [];
  const allFunctions: ParsedFunction[] = [];
  const fileSet = new Set(allFilePaths);

  for (const file of files) {
    try {
      const result = parseFile(file.content, file.path);
      allImports.push(...result.imports);
      allEndpoints.push(...result.endpoints);
      allFunctions.push(...result.functions);
    } catch {
      // Skip files that fail to parse
    }
  }

  // Build nodes
  const nodes = files.map((f) => ({
    id: f.path,
    type: "fileNode",
    data: { label: f.path, filePath: f.path },
  }));

  // Build edges (resolved imports + alias resolution)
  const edges: { id: string; source: string; target: string; isDynamic?: boolean }[] = [];
  const edgeSet = new Set<string>();
  let edgeId = 0;

  for (const imp of allImports) {
    let target = resolveImportPath(imp.source, imp.target, fileSet);
    if (!target) target = resolveAliasPath(imp.target, fileSet);
    if (target && files.some((f) => f.path === target)) {
      const key = `${imp.source}->${target}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ id: `e${edgeId++}`, source: imp.source, target, isDynamic: imp.isDynamic });
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

  // Build function call map
  const functionMap: Record<string, ParsedFunction[]> = {};
  for (const fn of allFunctions) {
    if (!functionMap[fn.file]) functionMap[fn.file] = [];
    functionMap[fn.file].push(fn);
  }

  // Build folder structure
  const folders = new Set<string>();
  for (const f of files) {
    const parts = f.path.split("/");
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join("/"));
    }
  }

  return {
    nodes,
    edges,
    endpoints: allEndpoints,
    functionMap,
    folderStructure: Array.from(folders).sort(),
    circularDeps: circularDeps.slice(0, 50), // limit
    stats: {
      totalFiles: files.length,
      totalImports: allImports.length,
      totalEndpoints: allEndpoints.length,
      totalFunctions: allFunctions.length,
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
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    analysisCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown) {
  if (analysisCache.size > 100) {
    // Evict oldest entries
    const entries = [...analysisCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 20; i++) analysisCache.delete(entries[i][0]);
  }
  analysisCache.set(key, { data, timestamp: Date.now() });
}

// ── GitHub API helpers ──────────────────────────────────────────────

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "CodebaseCipher/2.0",
  };
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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // 1. Fetch repo info
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders });
    if (!repoRes.ok) {
      const status = repoRes.status;
      if (status === 404) throw new Error("Repository not found or is private");
      if (status === 403) throw new Error("GitHub API rate limit reached. Try again later.");
      throw new Error(`Failed to fetch repository (${status})`);
    }
    const repoData = await repoRes.json();

    // 2. Fetch tree
    const ref = branch || repoData.default_branch || "HEAD";
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`, { headers: ghHeaders });
    if (!treeRes.ok) throw new Error("Failed to fetch repository tree");
    const treeData = await treeRes.json();

    const allTreeFiles = (treeData.tree || [])
      .filter((f: { path: string; type: string }) => f.type === "blob" && !shouldExclude(f.path));

    const allFilePaths = allTreeFiles.map((f: { path: string }) => f.path);
    
    // Prioritize important files first (entry points, configs, then by extension)
    const priorityFiles = allTreeFiles
      .filter((f: { path: string }) => isCodeFile(f.path))
      .sort((a: { path: string }, b: { path: string }) => {
        const aScore = getFilePriority(a.path);
        const bScore = getFilePriority(b.path);
        return bScore - aScore;
      })
      .slice(0, MAX_FILES);

    const isLargeRepo = allTreeFiles.length > LARGE_REPO_THRESHOLD;

    // 3. Fetch file contents in batches
    const filesWithContent: { path: string; content: string }[] = [];

    for (let i = 0; i < priorityFiles.length; i += BATCH_SIZE) {
      const batch = priorityFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((f: { path: string; size?: number }) => {
          // Skip very large files (>100KB)
          if (f.size && f.size > 100000) return Promise.resolve(null);
          return fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${f.path}`, { headers: ghHeaders })
            .then((r) => (r.ok ? r.text() : null))
            .then((content) => (content ? { path: f.path, content } : null));
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          filesWithContent.push(r.value);
        }
      }
    }

    // 4. Build graph
    const graph = buildGraph(filesWithContent, allFilePaths);

    const result = {
      repoInfo: {
        owner,
        repo,
        stars: repoData.stargazers_count,
        description: repoData.description,
        defaultBranch: repoData.default_branch,
        language: repoData.language,
        forks: repoData.forks_count,
        size: repoData.size,
      },
      ...graph,
      allFiles: allTreeFiles.map((f: { path: string; size?: number }) => ({
        path: f.path,
        type: "blob" as const,
        size: f.size,
      })),
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

// ── File priority scoring ───────────────────────────────────────────

function getFilePriority(path: string): number {
  let score = 0;
  const name = path.split("/").pop() || "";
  // Entry points
  if (name === "index.ts" || name === "index.js" || name === "main.ts" || name === "main.js") score += 10;
  if (name === "app.ts" || name === "app.js" || name === "App.tsx" || name === "App.jsx") score += 10;
  if (name === "server.ts" || name === "server.js") score += 8;
  if (name === "routes.ts" || name === "router.ts") score += 7;
  // Config files
  if (name.includes("config")) score += 5;
  // Shallow files first
  const depth = path.split("/").length;
  score -= depth;
  // Test files lower priority
  if (path.includes("test") || path.includes("spec") || path.includes("__test__")) score -= 5;
  return score;
}
