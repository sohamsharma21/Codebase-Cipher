import { useState } from 'react';
import { GitBranch, Search, Loader2, Sparkles } from 'lucide-react';
import FileTree from './FileTree';
import type { RepoFile, AnalysisProgress } from '@/types';
import { buildFileTree } from '@/lib/parser';

interface LeftPanelProps {
  files: RepoFile[];
  progress: AnalysisProgress;
  loading: boolean;
  onAnalyze: (url: string) => void;
  onLoadDemo: () => void;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
}

export default function LeftPanel({ files, progress, loading, onAnalyze, onLoadDemo, onSelectFile, selectedFile }: LeftPanelProps) {
  const [url, setUrl] = useState('');
  const tree = files.length > 0 ? buildFileTree(files) : [];
  const fileCount = files.filter(f => f.type === 'blob').length;
  const folderCount = files.filter(f => f.type === 'tree').length;

  return (
    <div className="w-[280px] shrink-0 border-r border-border flex flex-col h-full bg-card">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">GitVizz</h1>
            <p className="text-[10px] text-muted-foreground">Illuminate your codebase</p>
          </div>
        </div>

        {/* URL Input */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && url && onAnalyze(url)}
              placeholder="https://github.com/owner/repo"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => url && onAnalyze(url)}
            disabled={loading || !url}
            className="w-full py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {loading ? 'Analyzing...' : 'Analyze Repository'}
          </button>
          <button
            onClick={onLoadDemo}
            className="w-full py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50 flex items-center justify-center gap-1 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Try Demo (expressjs/express)
          </button>
        </div>
      </div>

      {/* Progress */}
      {progress.step > 0 && !progress.done && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span>{progress.message}</span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(progress.step / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {tree.length > 0 ? (
          <FileTree nodes={tree} onSelectFile={onSelectFile} selectedFile={selectedFile} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No repository loaded
          </div>
        )}
      </div>

      {/* Stats */}
      {files.length > 0 && (
        <div className="p-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
          <span>📄 {fileCount} files</span>
          <span>📁 {folderCount} folders</span>
        </div>
      )}
    </div>
  );
}
