import React, { useState, useEffect, useMemo } from 'react';
import { Wand2, Copy, Check, FileCode, Loader2, Zap, BookOpen, Package, Tag, Gauge, MessageSquare, Code, Sparkles, Target, TrendingUp, AlertCircle, Layers } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RepoFile, AISummary } from '@/types';
import { getFileExtension, getFileColor } from '@/lib/parser';
import { getDemoSummary } from '@/lib/demoData';
import { supabase } from '@/integrations/supabase/client';
import ChatPanel from './ChatPanel';
import GraphInsightsPanel from './GraphInsightsPanel';
import { GraphNode, GraphEdge } from '@/lib/parser';

interface RightPanelProps {
  selectedFile?: string;
  files: RepoFile[];
  isDemo: boolean;
  repoName?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
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
  const [activeTab, setActiveTab] = useState<'summary' | 'code' | 'chat' | 'insights'>('summary');

  const file = files.find(f => f.path === selectedFile);
  const ext = selectedFile ? getFileExtension(selectedFile) : '';
  const lang = langMap[ext] || 'text';

  useEffect(() => {
    if (!selectedFile) {
        if (activeTab !== 'insights') setActiveTab('insights');
        return;
    }
    
    setSummary(null);
    if (activeTab === 'code' || activeTab === 'chat' || activeTab === 'insights') {
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
        console.error('AI summary error:', err);
        if (!cancelled) {
          setSummary({
            purpose: `This file implements ${selectedFile.split('/').pop()} functionality.`,
            explanation: 'AI analysis failed. Processing code locally.',
            dependencies: [], type: 'utility', complexity: 'medium',
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
    { id: 'code' as const, label: 'Source', icon: Code, hideIfNoFile: true },
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare, hideIfNoFile: true },
    { id: 'insights' as const, label: 'Insights', icon: Sparkles, hideIfNoFile: false },
  ];

  const visibleTabs = tabs.filter(t => !t.hideIfNoFile || selectedFile);

  return (
    <div className="w-[380px] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden shadow-2xl">
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
      <div className="flex-1 overflow-hidden flex flex-col">
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
                <div className="group p-3 rounded-xl bg-secondary/30 border border-border/50 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Zap className="w-3.5 h-3.5" />
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

        {activeTab === 'insights' && (
          <div className="flex-1 overflow-y-auto animate-in fade-in duration-300">
            <GraphInsightsPanel nodes={nodes} edges={edges} />
          </div>
        )}
      </div>
    </div>
  );
}
