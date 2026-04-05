import React, { useState, useEffect } from 'react';
import { Wand2, Copy, Check, Loader2, Zap, BookOpen, Package, Tag, Gauge, MessageSquare, Code, Sparkles, GitMerge } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RepoFile, AISummary } from '@/types';
import { getFileExtension, getFileColor } from '@/lib/parser';
import { getDemoSummary } from '@/lib/demoData';
import { supabase } from '@/integrations/supabase/client';
import ChatPanel from './ChatPanel';
import GraphInsightsPanel from './GraphInsightsPanel';
import FlowDiagramPanel from './FlowDiagramPanel';

interface RightPanelProps {
  selectedFile?: string;
  files: RepoFile[];
  isDemo: boolean;
  repoName?: string;
  nodes: { id: string; [key: string]: any }[];
  edges: { id: string; source: string; target: string; [key: string]: any }[];
}

const langMap: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  json: 'json', css: 'css', scss: 'scss', html: 'html',
  md: 'markdown', py: 'python', rb: 'ruby', go: 'go',
  rs: 'rust', java: 'java', yaml: 'yaml', yml: 'yaml',
};

const complexityColors = { low: '#3fb950', medium: '#d29922', high: '#f85149' };

export default function RightPanel({ selectedFile, files, isDemo, repoName, nodes, edges }: RightPanelProps) {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'code' | 'flow' | 'chat' | 'insights'>('summary');

  const file = files.find(f => f.path === selectedFile);
  const ext = selectedFile ? getFileExtension(selectedFile) : '';
  const lang = langMap[ext] || 'text';

  // Feature 3B: Dependency Impact Analysis (BFS backward traversal)
  const impactedFiles = React.useMemo(() => {
    if (!selectedFile || !edges?.length) return [];
    
    const impacted = new Set<string>();
    const queue = [selectedFile];
    
    while(queue.length > 0) {
      const current = queue.shift()!;
      // files that import `current`
      const incoming = edges.filter(e => e.target === current);
      for (const e of incoming) {
        if (!impacted.has(e.source)) {
          impacted.add(e.source);
          queue.push(e.source);
        }
      }
    }
    return Array.from(impacted);
  }, [selectedFile, edges]);

  useEffect(() => {
    if (!selectedFile) {
        if (activeTab !== 'insights') setActiveTab('insights');
        return;
    }
    
    setSummary(null);
    if (activeTab === 'code' || activeTab === 'chat' || activeTab === 'flow' || activeTab === 'insights') {
      // stay on current tab
    } else {
      setActiveTab('summary');
    }

    if (!file?.content) return;

    if (isDemo) {
      const demoSummary = getDemoSummary(selectedFile);
      if (demoSummary) {
        setLoadingSummary(true);
        const t = setTimeout(() => { setSummary(demoSummary); setLoadingSummary(false); }, 600);
        return () => clearTimeout(t);
      }
    }

    setLoadingSummary(true);
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('analyze-file', {
          body: { filePath: selectedFile, fileContent: file.content!.slice(0, 3000) },
        });
        if (cancelled) return;
        if (error) throw error;
        setSummary(data as AISummary);
      } catch (err) {
        console.warn('AI summary edge function failed, using client-side analysis:', err);
        if (!cancelled) {
          // Smart client-side summary generation
          const content = file.content || '';
          const lines = content.split('\n');
          const loc = lines.length;
          const fileName = selectedFile.split('/').pop() || selectedFile;
          const ext = fileName.split('.').pop() || '';
          
          // Detect imports
          const importLines = lines.filter(l => /^import\s|require\(/.test(l.trim()));
          const deps = importLines
            .map(l => { const m = l.match(/from\s+['"]([^'"]+)['"]/); return m ? m[1] : null; })
            .filter(Boolean) as string[];
          
          // Detect exports
          const exportCount = lines.filter(l => /^export\s/.test(l.trim())).length;
          
          // Detect patterns
          const isComponent = /\.(jsx|tsx)$/.test(fileName) && (content.includes('return (') || content.includes('return('));
          const isHook = fileName.startsWith('use') && /^(ts|tsx|js|jsx)$/.test(ext);
          const isRoute = /route|api|endpoint|controller/i.test(fileName) || content.includes('router.') || content.includes('app.get') || content.includes('app.post');
          const isModel = /model|schema|entity|migration/i.test(fileName) || content.includes('Schema(') || content.includes('model(');
          const isConfig = /config|\.env|settings/i.test(fileName) || /\.(json|yaml|yml|toml)$/.test(fileName);
          const isTest = /\.(test|spec)\./i.test(fileName) || content.includes('describe(') || content.includes('it(');
          const isMiddleware = /middleware/i.test(fileName) || (content.includes('req,') && content.includes('res,') && content.includes('next'));
          const isUtil = /util|helper|lib|service/i.test(fileName);
          
          // Determine type
          let fileType = 'utility';
          if (isComponent) fileType = 'component';
          else if (isHook) fileType = 'hook';
          else if (isRoute) fileType = 'route';
          else if (isModel) fileType = 'model';
          else if (isConfig) fileType = 'config';
          else if (isTest) fileType = 'test';
          else if (isMiddleware) fileType = 'middleware';
          else if (isUtil) fileType = 'utility';
          
          // Determine complexity
          const branchCount = (content.match(/if\s*\(|switch\s*\(|for\s*\(|while\s*\(|\?\s*[^:]/g) || []).length;
          let complexity: 'low' | 'medium' | 'high' = 'low';
          if (loc > 200 || branchCount > 15) complexity = 'high';
          else if (loc > 80 || branchCount > 5) complexity = 'medium';
          
          // Generate purpose
          const purposes: Record<string, string> = {
            component: `React component that renders the ${fileName.replace(/\.(tsx|jsx)$/, '')} UI. ${exportCount > 1 ? `Exports ${exportCount} elements.` : 'Default export.'}`,
            hook: `Custom React hook providing reusable stateful logic. ${deps.length > 0 ? `Depends on ${deps.length} modules.` : ''}`,
            route: `API route/controller handling HTTP requests. ${content.includes('GET') || content.includes('get') ? 'Handles GET requests.' : ''} ${content.includes('POST') || content.includes('post') ? 'Handles POST requests.' : ''}`,
            model: `Data model/schema definition. Defines the structure and validation rules for data entities.`,
            config: `Configuration file that sets up environment variables, build settings, or application parameters.`,
            test: `Test file containing ${(content.match(/it\s*\(/g) || []).length || 'multiple'} test cases for verifying functionality.`,
            middleware: `Middleware that intercepts and processes requests before they reach the route handler.`,
            utility: `Utility module providing ${exportCount} helper function(s). ${loc > 100 ? 'Contains substantial logic.' : 'Lightweight helper.'}`,
          };
          
          const explanation = `${fileName} is a ${complexity}-complexity ${fileType} file with ${loc} lines of code. ` +
            `It has ${importLines.length} import(s) and ${branchCount} control flow branch(es). ` +
            (deps.length > 0 ? `Key dependencies: ${deps.slice(0, 5).map(d => d.split('/').pop()).join(', ')}.` : 'No local imports detected.');
          
          setSummary({
            purpose: purposes[fileType] || `This file implements ${fileName} functionality.`,
            explanation,
            dependencies: deps.slice(0, 8),
            type: fileType,
            complexity,
          });
        }
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedFile, file, isDemo]);

  const handleCopy = () => {
    if (file?.content) {
      navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs = [
    { id: 'summary' as const, label: 'Summary', icon: Wand2, hideIfNoFile: true },
    { id: 'flow' as const, label: 'Flow', icon: GitMerge, hideIfNoFile: true },
    { id: 'code' as const, label: 'Source', icon: Code, hideIfNoFile: true },
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare, hideIfNoFile: true },
    { id: 'insights' as const, label: 'Insights', icon: Sparkles, hideIfNoFile: false },
  ];

  const visibleTabs = tabs.filter(t => !t.hideIfNoFile || selectedFile);

  return (
    <div className="w-full shrink-0 border-l border-border bg-card flex flex-col h-full shadow-2xl">
      {/* Header */}
      <div className="p-3 border-b border-border bg-card/50 backdrop-blur-md">
        {selectedFile ? (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getFileColor(selectedFile) }} />
            <span className="text-xs font-mono font-medium text-foreground truncate flex-1">{selectedFile}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-secondary text-muted-foreground">
              .{ext}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">Project Intelligence</span>
          </div>
        )}
        
        <div className="flex gap-1 bg-background/50 p-1 rounded-lg border border-border/50">
          {visibleTabs.map(t => (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-md transition-all duration-200 ${
                activeTab === t.id 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <t.icon className={`w-3 h-3 ${activeTab === t.id ? 'animate-pulse' : ''}`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {activeTab === 'summary' && selectedFile && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-in fade-in duration-300">
            {loadingSummary ? (
              <div className="space-y-3">
                <div className="h-4 bg-secondary rounded animate-pulse w-full" />
                <div className="h-4 bg-secondary rounded animate-pulse w-3/4" />
                <div className="h-4 bg-secondary rounded animate-pulse w-5/6" />
              </div>
            ) : summary ? (
              <>
                {(() => {
                  const currentNodeData = Object.values(nodes || {}).find((n: any) => n.id === selectedFile)?.data as any;
                  if (!currentNodeData) return null;
                  
                  return (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">{currentNodeData.icon || '📄'}</span>
                        <h3 className="font-bold text-foreground text-sm flex-1 truncate">{currentNodeData.label || 'File Component'}</h3>
                        <span className="text-[9px] px-2 py-0.5 rounded-full uppercase font-mono tracking-widest border" style={{ color: currentNodeData.color, borderColor: `${currentNodeData.color}40`, backgroundColor: `${currentNodeData.color}15` }}>
                          {currentNodeData.entityType || 'UNKNOWN'}
                        </span>
                      </div>
                      
                      {currentNodeData.entityType === 'API_ROUTE' && currentNodeData.routes && (
                        <div className="p-3 bg-[#161b22] border border-[#58a6ff]/30 rounded-lg">
                           <div className="text-[10px] text-[#58a6ff] font-bold uppercase mb-2 flex items-center gap-1"><Zap className="w-3 h-3"/> Discovered Endpoints</div>
                           <div className="space-y-1.5 max-h-32 overflow-y-auto">
                              {currentNodeData.routes.map((r: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-[10px] items-center font-mono bg-[#0d1117] p-1.5 rounded border border-[#30363d]">
                                  <span className="text-[#58a6ff] font-bold min-w-[36px]">{r.method}</span>
                                  <span className="text-foreground truncate">{r.path}</span>
                                </div>
                              ))}
                           </div>
                        </div>
                      )}
                      
                      {(currentNodeData.entityType === 'DATABASE' || currentNodeData.entityType === 'MODEL') && currentNodeData.dbOps?.length > 0 && (
                        <div className="p-3 bg-[#161b22] border border-[#f0883e]/30 rounded-lg">
                           <div className="text-[10px] text-[#f0883e] font-bold uppercase mb-2 flex items-center gap-1"><Package className="w-3 h-3"/> Database Operations</div>
                           <div className="space-y-1 overflow-y-auto max-h-32">
                              {currentNodeData.dbOps.map((op: any, i: number) => (
                                <div key={i} className="flex gap-2 text-[10px] font-mono items-center">
                                  <span className="text-[#8b949e]">»</span>
                                  <span className="text-foreground truncate">{op.label}</span>
                                </div>
                              ))}
                           </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="group p-3 rounded-xl bg-secondary/30 border border-border/50 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Purpose</p>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{summary.purpose}</p>
                </div>

                <div className="group p-3 rounded-xl bg-secondary/30 border border-border/50 hover:border-violet-500/30 transition-all">
                  <div className="flex items-center gap-2 mb-2 text-violet-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Analysis</p>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed italic">{summary.explanation}</p>
                </div>

                {summary.dependencies.length > 0 && (
                  <div className="group p-3 rounded-xl bg-secondary/30 border border-border/50 hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                      <Package className="w-3.5 h-3.5" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Neighborhood</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {summary.dependencies.map(d => (
                        <span key={d} className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                          {d.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Feature 3B: Impact Analysis section */}
                {impactedFiles.length > 0 && (
                  <div className="group p-3 rounded-xl bg-[hsl(var(--orange))]/10 border border-[hsl(var(--orange))]/30 hover:border-[hsl(var(--orange))]/50 transition-all">
                    <div className="flex items-center gap-2 mb-2 text-[hsl(var(--orange))]">
                      <GitMerge className="w-3.5 h-3.5" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Impact Analysis</p>
                    </div>
                    <p className="text-[11px] text-[#c9d1d9] mb-2 leading-tight">
                      Modifying this file could affect <span className="font-bold text-white">{impactedFiles.length} downstream files</span>:
                    </p>
                    <div className="max-h-24 overflow-y-auto pr-1 space-y-1">
                      {impactedFiles.map((f, i) => (
                        <div key={f} className="text-[10px] text-[#8b949e] font-mono flex gap-2">
                          <span className="opacity-50">{i + 1}.</span>
                          <span className="truncate" title={f}>{f.split('/').pop()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">{summary.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" style={{ color: complexityColors[summary.complexity] }} />
                    <span className="text-[10px] font-medium uppercase" style={{ color: complexityColors[summary.complexity] }}>
                      {summary.complexity} Complexity
                    </span>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'code' && selectedFile && (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/30">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Source Viewer</span>
              <button 
                onClick={handleCopy} 
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all active:scale-90"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-[#0d1117]">
              {file?.content ? (
                <SyntaxHighlighter 
                  language={lang} 
                  style={vscDarkPlus} 
                  showLineNumbers
                  customStyle={{ 
                    margin: 0, 
                    padding: '16px', 
                    background: 'transparent', 
                    fontSize: '11px', 
                    lineHeight: '1.6',
                    fontFamily: 'var(--font-mono)' 
                  }}
                  lineNumberStyle={{ color: '#484f58', minWidth: '2.5em', paddingRight: '1em' }}
                >
                  {file.content}
                </SyntaxHighlighter>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin opacity-20" />
                    <p className="text-xs">Processing file content...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex-1 overflow-hidden animate-in fade-in duration-300">
            <ChatPanel selectedFile={selectedFile} files={files} repoName={repoName} />
          </div>
        )}

        {activeTab === 'flow' && selectedFile && (
          <div className="flex-1 overflow-hidden animate-in fade-in duration-300 bg-[#0d1117]">
            <FlowDiagramPanel filePath={selectedFile} fileContent={file?.content || ''} isDemo={isDemo} />
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="flex-1 overflow-y-auto animate-in fade-in duration-300">
            <GraphInsightsPanel nodes={nodes} edges={edges} />
          </div>
        )}
      </div>
    </div>
  );
}
