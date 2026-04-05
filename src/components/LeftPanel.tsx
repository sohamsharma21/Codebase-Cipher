import { useState, useEffect, useMemo, useCallback } from 'react';
import { GitBranch, Search, X, CheckCircle2, AlertCircle, ArrowRight, Loader2, Trash2, Clock, ChevronDown, ChevronRight, BookMarked } from 'lucide-react';
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

const EXAMPLE_REPOS = [
  { label: 'expressjs', value: 'https://github.com/expressjs/express' },
  { label: 'axios', value: 'https://github.com/axios/axios' },
  { label: 'lodash', value: 'https://github.com/lodash/lodash' },
];

function isValidGithubUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+/.test(url.trim());
}

function isPartiallyTyped(url: string): boolean {
  return url.trim().length > 0;
}

interface HistoryEntry {
  repo: string;
  timestamp: number;
  fileCount: number;
  healthScore: number;
}

export default function LeftPanel({ files, progress, loading, onAnalyze, onLoadDemo, onSelectFile, selectedFile }: LeftPanelProps) {
  const [url, setUrl] = useState('');
  const [filter, setFilter] = useState('');
  const [touched, setTouched] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);

  const isValid = isValidGithubUrl(url);
  const isInvalid = touched && isPartiallyTyped(url) && !isValid;

  const tree = useMemo(() => files.length > 0 ? buildFileTree(files) : [], [files]);
  const fileCount = files.filter(f => f.type === 'blob').length;
  const folderCount = files.filter(f => f.type === 'tree').length;

  const matchCount = useMemo(() => {
    if (!filter) return 0;
    const lf = filter.toLowerCase();
    return files.filter(f => f.type === 'blob' && f.path.toLowerCase().includes(lf)).length;
  }, [files, filter]);

  const handleSubmit = useCallback(() => {
    if (!url.trim()) return;
    setTouched(true);
    if (!isValid) return;
    onAnalyze(url);
  }, [url, isValid, onAnalyze]);

  const handleExampleClick = useCallback((repoUrl: string) => {
    setUrl(repoUrl);
    setTouched(false);
  }, []);

  // Cmd+K shortcut for file search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('file-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // History loader
  const loadHistory = useCallback(() => {
    try {
      const stored = localStorage.getItem('gitvizz_history');
      if (stored) setHistory(JSON.parse(stored));
    } catch(e) {}
  }, []);

  useEffect(() => {
    loadHistory();
    window.addEventListener('gitvizz_history_updated', loadHistory);
    return () => window.removeEventListener('gitvizz_history_updated', loadHistory);
  }, [loadHistory]);

  const handleDeleteHistory = (e: React.MouseEvent, repo: string) => {
    e.stopPropagation();
    try {
      const newHist = history.filter(h => h.repo !== repo);
      localStorage.setItem('gitvizz_history', JSON.stringify(newHist));
      setHistory(newHist);
    } catch(err) {}
  };

  const handleHistoryClick = (entry: HistoryEntry) => {
    const fullUrl = `https://github.com/${entry.repo}`;
    setUrl(fullUrl);
    onAnalyze(fullUrl);
  };

  // Border color for input
  const inputBorderColor = isValid
    ? '#3fb950'
    : isInvalid
    ? '#f85149'
    : undefined;

  return (
    <div className="w-full sm:w-[300px] lg:w-[320px] shrink-0 border-r border-[#30363d] flex flex-col h-full bg-[#0d1117] shadow-2xl z-20 transition-all duration-300">
      {/* Search Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#30363d] backdrop-blur-md bg-gradient-to-b from-[#161b22] to-[#0d1117]">
        {/* Redesigned Analyze Card */}
        <div
          className="relative group transition-all duration-300"
          style={{
            background: 'linear-gradient(145deg, #161b22, #0d1117)',
            border: '1px solid #30363d',
            borderRadius: 14,
            padding: 16,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <p className="text-[11px] font-extrabold text-[#e6edf3] mb-3 flex items-center gap-1.5 uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">
            <Search className="w-4 h-4 text-[#58a6ff]" />
            Scan Repository
          </p>

          {/* URL Input */}
          <div className="relative mb-3">
            <input
              type="text"
              value={url}
              onChange={e => {
                setUrl(e.target.value);
                if (touched) setTouched(true);
              }}
              onBlur={() => setTouched(true)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="github.com/owner/repo"
              style={{
                background: '#010409',
                border: `1px solid ${inputBorderColor || '#30363d'}`,
                borderRadius: 8,
                width: '100%',
                padding: '10px 36px 10px 14px',
                fontSize: 12,
                color: '#e6edf3',
                fontFamily: 'monospace',
                outline: 'none',
                boxShadow: isValid
                  ? '0 0 0 2px rgba(63,185,80,0.2)'
                  : isInvalid
                  ? '0 0 0 2px rgba(248,81,73,0.2)'
                  : 'inset 0 2px 4px rgba(0,0,0,0.5)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              className="placeholder:text-[#484f58] focus:border-[#58a6ff] focus:shadow-[0_0_0_3px_rgba(88,166,255,0.25)] focus:bg-[#0d1117]"
            />
            {/* Right icon: valid checkmark or invalid X */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-300">
              {isValid && <CheckCircle2 className="w-4 h-4 text-[#3fb950] animate-in zoom-in-50" />}
              {isInvalid && <AlertCircle className="w-4 h-4 text-[#f85149] animate-in bounce-in" />}
            </div>
          </div>

          {/* Validation error */}
          {isInvalid && (
            <p className="text-[10px] text-[#f85149] mb-3 px-1 font-semibold animate-in slide-in-from-top-1">
              Enter a valid github.com URL
            </p>
          )}

          {/* Analyze Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 8,
              border: 'none',
              background: loading
                ? 'transparent'
                : !url.trim()
                ? '#21262d'
                : 'linear-gradient(to bottom, #238636, #2ea043)',
              color: !url.trim() ? '#484f58' : '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              borderTop: !loading && url.trim() ? '1px solid rgba(255,255,255,0.2)' : undefined,
              boxShadow: !loading && url.trim() ? '0 4px 12px rgba(35,134,54,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : undefined,
            }}
            className={!loading && url.trim() ? 'hover:!brightness-110 active:!scale-[0.98]' : ''}
          >
            {loading ? (
              <>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#161b22',
                    borderRadius: 8,
                    border: '1px solid #30363d',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.max(8, (progress.step / 5) * 100)}%`,
                    background: progress.step >= 5
                      ? 'linear-gradient(90deg, #238636, #3fb950)'
                      : 'linear-gradient(90deg, #1f6feb, #388bfd)',
                    borderRadius: 8,
                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 0 16px rgba(56,139,253,0.5)'
                  }}
                />
                <Loader2 className="w-4 h-4 animate-spin relative z-10 text-white" />
                <span className="relative z-10 text-white text-xs tracking-wide">Executing Analysis...</span>
              </>
            ) : (
              <>
                Initialize Scan
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-2 my-3">
            <div style={{ flex: 1, height: 1, background: '#30363d' }} />
            <span className="text-[10px] text-[#484f58]">or try an example</span>
            <div style={{ flex: 1, height: 1, background: '#30363d' }} />
          </div>

          {/* Example Chips */}
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_REPOS.map(repo => (
              <button
                key={repo.value}
                onClick={() => handleExampleClick(repo.value)}
                style={{
                  background: '#21262d',
                  border: '1px solid #30363d',
                  borderRadius: 20,
                  padding: '3px 10px',
                  fontSize: 10,
                  color: '#8b949e',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}
                className="hover:!bg-[#1f6feb]/20 hover:!text-[#58a6ff] hover:!border-[#1f6feb]/50"
              >
                {repo.label}
              </button>
            ))}
            <button
              onClick={onLoadDemo}
              style={{
                background: '#21262d',
                border: '1px solid #30363d',
                borderRadius: 20,
                padding: '3px 10px',
                fontSize: 10,
                color: '#8b949e',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              }}
              className="hover:!bg-purple-500/20 hover:!text-purple-400 hover:!border-purple-500/40"
            >
              ✨ demo
            </button>
          </div>
        </div>
      </div>

      {/* Recent Analyses Toggle */}
      {history.length > 0 && (
        <div className="px-4 py-2 border-b border-[#30363d]">
          <button 
            onClick={() => setHistoryCollapsed(!historyCollapsed)}
            className="flex items-center justify-between w-full text-xs font-semibold text-[#8b949e] hover:text-[#e6edf3] transition-colors group"
          >
            <div className="flex items-center gap-1.5">
              <BookMarked className="w-3.5 h-3.5" />
              Recent Analyses
            </div>
            {historyCollapsed ? <ChevronRight className="w-3.5 h-3.5 group-hover:text-white" /> : <ChevronDown className="w-3.5 h-3.5 group-hover:text-white" />}
          </button>
          
          {!historyCollapsed && (
            <div className="mt-2 space-y-1.5">
              {history.map((entry, idx) => {
                const timeAgo = (Date.now() - entry.timestamp) / 1000 / 60; // minutes
                let timeStr = 'Just now';
                if (timeAgo > 1440) timeStr = `${Math.floor(timeAgo / 1440)} days ago`;
                else if (timeAgo > 60) timeStr = `${Math.floor(timeAgo / 60)} hours ago`;
                else if (timeAgo > 1) timeStr = `${Math.floor(timeAgo)} mins ago`;

                return (
                  <div 
                    key={idx} 
                    onClick={() => handleHistoryClick(entry)}
                    className="flex justify-between items-center p-2 rounded-md bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] cursor-pointer group/item transition-colors"
                  >
                    <div className="flex-1 overflow-hidden">
                      <div className="text-[11px] font-semibold text-[#58a6ff] truncate">{entry.repo}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[#8b949e] text-[9px]">
                        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {timeStr}</span>
                        <span>·</span>
                        <span>{entry.fileCount} files</span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteHistory(e, entry.repo)}
                      className="p-1 rounded opacity-0 group-hover/item:opacity-100 hover:bg-[#f85149]/20 text-[#8b949e] hover:text-[#f85149] transition-all ml-2"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Smart file search */}
      {tree.length > 0 && (
        <div className="px-2 pt-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              id="file-search-input"
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search files... (⌘K)"
              className="w-full pl-7 pr-7 py-1.5 text-xs rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {filter && (
              <button onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {filter && (
            <p className="text-[10px] text-muted-foreground mt-1 px-1">{matchCount} files match</p>
          )}
        </div>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {tree.length > 0 ? (
          <FileTree nodes={tree} onSelectFile={onSelectFile} selectedFile={selectedFile} filter={filter} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No repository loaded</div>
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
