import { useState, useEffect, useMemo } from 'react';
import { Wand2, Copy, Check, FileCode, Loader2, Zap, BookOpen, Package, Tag, Gauge, MessageSquare, Code } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RepoFile, AISummary } from '@/types';
import { getFileExtension, getFileColor } from '@/lib/parser';
import { getDemoSummary } from '@/lib/demoData';
import { supabase } from '@/integrations/supabase/client';
import ChatPanel from './ChatPanel';

interface RightPanelProps {
  selectedFile?: string;
  files: RepoFile[];
  isDemo: boolean;
  repoName?: string;
}

const langMap: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  json: 'json', css: 'css', scss: 'scss', html: 'html',
  md: 'markdown', py: 'python', rb: 'ruby', go: 'go',
  rs: 'rust', java: 'java', yaml: 'yaml', yml: 'yaml',
};

const complexityColors = { low: '#3fb950', medium: '#d29922', high: '#f85149' };

export default function RightPanel({ selectedFile, files, isDemo, repoName }: RightPanelProps) {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'code' | 'chat'>('summary');

  const file = files.find(f => f.path === selectedFile);
  const ext = selectedFile ? getFileExtension(selectedFile) : '';
  const lang = langMap[ext] || 'text';

  useEffect(() => {
    setSummary(null);
    if (activeTab === 'code' || activeTab === 'chat') {
      // don't auto-switch to summary tab
    } else {
      setActiveTab('summary');
    }
    if (!selectedFile || !file?.content) return;

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
            explanation: 'AI analysis failed. This is a fallback summary.',
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

  if (!selectedFile) {
    return (
      <div className="w-[360px] shrink-0 border-l border-border bg-card flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <FileCode className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">Select a file</h3>
        <p className="text-xs text-muted-foreground">Click on a node in the graph or a file in the tree to view its details and AI summary</p>
      </div>
    );
  }

  const tabs = [
    { id: 'summary' as const, label: 'AI Summary', icon: Wand2 },
    { id: 'code' as const, label: 'Source', icon: Code },
    { id: 'chat' as const, label: '💬 Chat', icon: MessageSquare },
  ];

  return (
    <div className="w-[360px] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-medium text-foreground truncate flex-1">{selectedFile}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{ color: getFileColor(selectedFile), background: `${getFileColor(selectedFile)}20` }}>
            .{ext}
          </span>
        </div>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-2 py-1 text-[10px] rounded-md transition-colors ${activeTab === t.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.id === 'chat' ? '💬 Chat' : t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' && (
        <div className="flex-1 overflow-y-auto p-3">
          {loadingSummary ? (
            <div className="space-y-2">
              <div className="h-3 bg-secondary rounded animate-pulse w-full" />
              <div className="h-3 bg-secondary rounded animate-pulse w-3/4" />
              <div className="h-3 bg-secondary rounded animate-pulse w-5/6" />
            </div>
          ) : summary ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#bc8cff' }} />
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Purpose</p>
                  <p className="text-xs text-foreground">{summary.purpose}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Explanation</p>
                  <p className="text-xs text-foreground">{summary.explanation}</p>
                </div>
              </div>
              {summary.dependencies.length > 0 && (
                <div className="flex gap-2">
                  <Package className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green" />
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Dependencies</p>
                    <div className="flex flex-wrap gap-1">
                      {summary.dependencies.map(d => (
                        <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-green/10 text-green font-mono">{d}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <div className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{summary.type}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Gauge className="w-3 h-3" style={{ color: complexityColors[summary.complexity] }} />
                  <span className="text-[10px]" style={{ color: complexityColors[summary.complexity] }}>{summary.complexity}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {activeTab === 'code' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs text-muted-foreground">Source Code</span>
            <button onClick={handleCopy} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {file?.content ? (
              <SyntaxHighlighter language={lang} style={vscDarkPlus} showLineNumbers
                customStyle={{ margin: 0, padding: '8px', background: '#0d1117', fontSize: '11px', lineHeight: '1.5' }}
                lineNumberStyle={{ color: '#484f58', minWidth: '2.5em' }}>
                {file.content}
              </SyntaxHighlighter>
            ) : (
              <div className="p-4 text-xs text-muted-foreground text-center">Content not available</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <ChatPanel selectedFile={selectedFile} files={files} repoName={repoName} />
      )}
    </div>
  );
}
