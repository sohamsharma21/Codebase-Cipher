import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Language-aware parsers ──────────────────────────────────────────

interface ParsedImport {
  source: string;
  target: string;
}
interface ParsedEndpoint {
  method: string;
  path: string;
  file: string;
}
interface ParsedFunction {
  name: string;
  file: string;
  calls: string[];
  params: string[];
  line: number;
}

const JS_TS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const PYTHON_EXTENSIONS = [".py"];
const EXCLUDED_DIRS = [
  "node_modules", ".git", "dist", "build", "coverage",
  ".next", ".cache", "__pycache__", ".vscode", ".idea",
  "vendor", "venv", ".env", ".tox", "egg-info",
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
  return EXCLUDED_DIRS.some((d) => path.startsWith(d + "/") || path === d);
}

// ── JS/TS parsing ───────────────────────────────────────────────────

function parseJSImports(content: string, filePath: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const patterns = [
    /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(content)) !== null) {
      imports.push({ source: filePath, target: m[1] });
    }
  }
  return imports;
}

function parseJSEndpoints(content: string, filePath: string): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  // Express-style
  const express = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
  let m;
  while ((m = express.exec(content)) !== null) {
    endpoints.push({ method: m[1].toUpperCase(), path: m[2], file: filePath });
  }
  // Next.js API routes
  if (filePath.includes("/api/")) {
    const method = content.includes("POST") ? "POST" : content.includes("PUT") ? "PUT" : content.includes("DELETE") ? "DELETE" : "GET";
    const routePath = "/" + filePath.replace(/\.(ts|js|tsx|jsx)$/, "").replace(/\/index$/, "");
    endpoints.push({ method, path: routePath, file: filePath });
  }
  return endpoints;
}

function parseJSFunctions(content: string, filePath: string): ParsedFunction[] {
  const fns: ParsedFunction[] = [];
  const lines = content.split("\n");

  // Named functions, arrow functions, methods
  const patterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) {
      const name = m[1];
      const params = m[2] ? m[2].split(",").map((p: string) => p.trim().split(":")[0].trim()).filter(Boolean) : [];
      const lineNum = content.slice(0, m.index).split("\n").length;

      // Find function calls within this function's body (rough heuristic: next 50 lines)
      const bodyStart = lineNum - 1;
      const bodyEnd = Math.min(bodyStart + 50, lines.length);
      const bodyText = lines.slice(bodyStart, bodyEnd).join("\n");
      const callPattern = /(\w+)\s*\(/g;
      const calls: string[] = [];
      let cm;
      while ((cm = callPattern.exec(bodyText)) !== null) {
        const callee = cm[1];
        if (callee !== name && !["if", "for", "while", "switch", "catch", "return", "new", "typeof", "import", "require", "console"].includes(callee)) {
          if (!calls.includes(callee)) calls.push(callee);
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
  return imports;
}

function parsePythonEndpoints(content: string, filePath: string): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  // FastAPI / Flask
  const decorator = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
  let m;
  while ((m = decorator.exec(content)) !== null) {
    endpoints.push({ method: m[1].toUpperCase(), path: m[2], file: filePath });
  }
  // Flask route decorator
  const flask = /@(?:app|bp|blueprint)\.route\s*\(\s*['"]([^'"]+)['"](?:.*methods\s*=\s*\[([^\]]+)\])?/gi;
  while ((m = flask.exec(content)) !== null) {
    const methods = m[2] ? m[2].replace(/['"]/g, "").split(",").map((s: string) => s.trim()) : ["GET"];
    for (const method of methods) {
      endpoints.push({ method: method.toUpperCase(), path: m[1], file: filePath });
    }
  }
  return endpoints;
}

function parsePythonFunctions(content: string, filePath: string): ParsedFunction[] {
  const fns: ParsedFunction[] = [];
  const pattern = /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm;
  let m;
  while ((m = pattern.exec(content)) !== null) {
    const name = m[1];
    const params = m[2] ? m[2].split(",").map((p: string) => p.trim().split(":")[0].split("=")[0].trim()).filter((p: string) => p && p !== "self" && p !== "cls") : [];
    const lineNum = content.slice(0, m.index).split("\n").length;
    fns.push({ name, file: filePath, calls: [], params, line: lineNum });
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

function resolveImportPath(sourceFile: string, importPath: string, allFiles: string[]): string | null {
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) return null; // external package

  const sourceDir = sourceFile.split("/").slice(0, -1).join("/");
  const parts = [...sourceDir.split("/"), ...importPath.split("/")];
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "..") stack.pop();
    else if (part !== "." && part !== "") stack.push(part);
  }
  const resolved = stack.join("/");

  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".py", "/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/__init__.py"];
  for (const ext of extensions) {
    if (allFiles.includes(resolved + ext)) return resolved + ext;
  }
  return null;
}

// ── Build graph from parsed data ────────────────────────────────────

function buildGraph(
  files: { path: string; content: string }[],
  allFilePaths: string[]
) {
  const allImports: ParsedImport[] = [];
  const allEndpoints: ParsedEndpoint[] = [];
  const allFunctions: ParsedFunction[] = [];

  // Process in chunks to avoid blocking
  for (const file of files) {
    const result = parseFile(file.content, file.path);
    allImports.push(...result.imports);
    allEndpoints.push(...result.endpoints);
    allFunctions.push(...result.functions);
  }

  // Build nodes
  const nodes = files.map((f) => ({
    id: f.path,
    type: "fileNode",
    data: { label: f.path, filePath: f.path },
  }));

  // Build edges (resolved imports)
  const edges: { id: string; source: string; target: string }[] = [];
  const edgeSet = new Set<string>();
  let edgeId = 0;

  for (const imp of allImports) {
    const target = resolveImportPath(imp.source, imp.target, allFilePaths);
    if (target && files.some((f) => f.path === target)) {
      const key = `${imp.source}->${target}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ id: `e${edgeId++}`, source: imp.source, target });
      }
    }
  }

  // Build function call map
  const functionMap: Record<string, { name: string; file: string; calls: string[]; params: string[]; line: number }[]> = {};
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
    stats: {
      totalFiles: files.length,
      totalImports: allImports.length,
      totalEndpoints: allEndpoints.length,
      totalFunctions: allFunctions.length,
    },
  };
}

// ── Simple in-memory cache ──────────────────────────────────────────

const analysisCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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
  // Limit cache size
  if (analysisCache.size > 50) {
    const oldest = analysisCache.keys().next().value;
    if (oldest) analysisCache.delete(oldest);
  }
  analysisCache.set(key, { data, timestamp: Date.now() });
}

// ── Main handler ────────────────────────────────────────────────────

const MAX_FILES = 200;
const BATCH_SIZE = 20;
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

    // 1. Fetch repo info
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!repoRes.ok) {
      const status = repoRes.status;
      if (status === 404) throw new Error("Repository not found or is private");
      if (status === 403) throw new Error("GitHub API rate limit reached. Try again later.");
      throw new Error("Failed to fetch repository");
    }
    const repoData = await repoRes.json();

    // 2. Fetch tree
    const ref = branch || repoData.default_branch || "HEAD";
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`);
    if (!treeRes.ok) throw new Error("Failed to fetch repository tree");
    const treeData = await treeRes.json();

    const allTreeFiles = (treeData.tree || [])
      .filter((f: { path: string; type: string }) => f.type === "blob" && !shouldExclude(f.path));

    const allFilePaths = allTreeFiles.map((f: { path: string }) => f.path);
    const codeFiles = allTreeFiles
      .filter((f: { path: string }) => isCodeFile(f.path))
      .slice(0, MAX_FILES);

    const isLargeRepo = allTreeFiles.length > LARGE_REPO_THRESHOLD;

    // 3. Fetch file contents in batches
    const filesWithContent: { path: string; content: string }[] = [];

    for (let i = 0; i < codeFiles.length; i += BATCH_SIZE) {
      const batch = codeFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((f: { path: string }) =>
          fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${f.path}`)
            .then((r) => (r.ok ? r.text() : null))
            .then((content) => (content ? { path: f.path, content } : null))
        )
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
      },
      ...graph,
      allFiles: allTreeFiles.map((f: { path: string; size?: number }) => ({
        path: f.path,
        type: "blob" as const,
        size: f.size,
      })),
      isLargeRepo,
      truncated: codeFiles.length >= MAX_FILES,
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
