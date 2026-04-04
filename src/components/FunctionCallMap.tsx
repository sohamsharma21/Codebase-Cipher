import { useState, useMemo } from 'react';
import { Search, X, ArrowRight, Code2 } from 'lucide-react';
import type { ParsedFunction } from '@/types';

interface FunctionCallMapProps {
  functionMap: Record<string, ParsedFunction[]>;
  onSelectFile: (path: string) => void;
}

export default function FunctionCallMap({ functionMap, onSelectFile }: FunctionCallMapProps) {
  const [search, setSearch] = useState('');
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    const q = search.toLowerCase();
    return Object.entries(functionMap)
      .filter(([file, fns]) => {
        if (!q) return true;
        return file.toLowerCase().includes(q) || fns.some(fn => fn.name.toLowerCase().includes(q));
      })
      .sort((a, b) => b[1].length - a[1].length);
  }, [functionMap, search]);

  const totalFunctions = useMemo(() =>
    Object.values(functionMap).reduce((sum, fns) => sum + fns.length, 0),
    [functionMap]
  );

  if (totalFunctions === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Code2 className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm text-foreground font-medium">No functions detected</p>
        <p className="text-xs text-muted-foreground mt-1">Function call mapping is available for analyzed code files</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search functions..."
            className="w-full pl-7 pr-7 py-1.5 text-xs rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{totalFunctions} functions across {filteredFiles.length} files</p>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredFiles.map(([file, fns]) => (
          <div key={file} className="bg-card border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedFile(expandedFile === file ? null : file)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-mono text-foreground truncate flex-1">{file.split('/').pop()}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{fns.length}</span>
            </button>

            {expandedFile === file && (
              <div className="border-t border-border px-3 py-2 space-y-2">
                <button onClick={() => onSelectFile(file)} className="text-[10px] text-muted-foreground hover:text-primary transition-colors font-mono">
                  📂 {file}
                </button>
                {fns.map((fn, i) => (
                  <div key={i} className="pl-2 border-l-2 border-primary/30 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-medium text-foreground">{fn.name}</span>
                      <span className="text-[10px] text-muted-foreground">({fn.params.join(', ')})</span>
                      <span className="text-[9px] text-muted-foreground ml-auto">L{fn.line}</span>
                    </div>
                    {fn.calls.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <ArrowRight className="w-2.5 h-2.5 text-muted-foreground mt-0.5" />
                        {fn.calls.slice(0, 8).map(call => (
                          <span key={call} className="text-[9px] px-1 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                            {call}()
                          </span>
                        ))}
                        {fn.calls.length > 8 && (
                          <span className="text-[9px] text-muted-foreground">+{fn.calls.length - 8} more</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
