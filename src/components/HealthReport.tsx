import { useState, useMemo } from 'react';
import { AlertTriangle, FileText, GitFork, AlertCircle, Lightbulb, Loader2, CheckCircle } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import type { CycleInfo, HealthStats } from '@/lib/graphUtils';
import { supabase } from '@/integrations/supabase/client';

interface HealthReportProps {
  stats: HealthStats;
  cycles: CycleInfo[];
  onSelectFile: (path: string) => void;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'hsl(139,60%,49%)' : score >= 50 ? 'hsl(39,73%,49%)' : 'hsl(0,94%,63%)';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" stroke="hsl(215,14%,21%)" strokeWidth="8" fill="none" />
        <circle cx="50" cy="50" r="40" stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[9px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export default function HealthReport({ stats, cycles, onSelectFile }: HealthReportProps) {
  const [recommendations, setRecommendations] = useState<{ title: string; description: string }[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const complexityBadge = useMemo(() => {
    if (stats.avgImports <= 3) return { label: 'Low', color: 'hsl(139,60%,49%)' };
    if (stats.avgImports <= 8) return { label: 'Medium', color: 'hsl(39,73%,49%)' };
    return { label: 'High', color: 'hsl(0,94%,63%)' };
  }, [stats.avgImports]);

  const issueCount = cycles.length + stats.orphanFiles.length;

  const generateRecommendations = async () => {
    setLoadingRecs(true);
    try {
      const systemPrompt = `You are a code health analysis expert. Analyze these codebase statistics and give 3-5 specific, actionable improvement suggestions. Return ONLY a JSON array of objects with "title" and "description" fields. No explanation, just the JSON array.`;

      const userMessage = `Stats:
- Total files: ${stats.totalFiles}
- JS files: ${stats.jsFiles}, TS files: ${stats.tsFiles}
- Circular dependencies: ${stats.circularDeps}
- Orphan files: ${stats.orphanFiles.join(', ') || 'none'}
- Average imports per file: ${stats.avgImports}
- Health score: ${stats.score}/100
- Top complex files: ${stats.topComplex.map(f => `${f.path} (${f.imports} imports)`).join(', ')}`;

      // Bug #11 fix: Use chat-with-code (returns free-form text) instead of
      // analyze-file (returns AISummary), then parse the JSON from the response
      const { data, error } = await supabase.functions.invoke('chat-with-code', {
        body: {
          messages: [{ role: 'user', content: userMessage }],
          systemPrompt,
        },
      });
      if (error) throw error;

      // Try to parse JSON array from the response content
      const content = data?.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
          setRecommendations(parsed);
          return;
        }
      }
      // Fallback if parsing fails
      throw new Error('Could not parse recommendations');
    } catch {
      setRecommendations([
        { title: 'Review circular dependencies', description: `Found ${stats.circularDeps} circular dependencies that should be resolved.` },
        { title: 'Clean up orphan files', description: `${stats.orphanFiles.length} files are never imported anywhere.` },
        { title: 'Monitor complexity', description: `Average imports per file: ${stats.avgImports}. Keep this below 8 for maintainability.` },
      ]);
    } finally {
      setLoadingRecs(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Top metric cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col items-center">
          <ScoreRing score={stats.score} />
          <span className="text-xs text-muted-foreground mt-2">Codebase Health</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <FileText className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold text-foreground">{stats.totalFiles}</p>
          <p className="text-xs text-muted-foreground">Files Analyzed</p>
          <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
            <p>JS: {stats.jsFiles} · TS: {stats.tsFiles} · Config: {stats.configFiles}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <GitFork className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold text-foreground">{stats.avgImports}</p>
          <p className="text-xs text-muted-foreground">Avg Imports/File</p>
          <span className="text-[10px] mt-2 inline-block px-1.5 py-0.5 rounded" style={{ color: complexityBadge.color, background: `${complexityBadge.color}20` }}>
            {complexityBadge.label}
          </span>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <AlertCircle className="w-5 h-5 mb-2" style={{ color: issueCount > 0 ? 'hsl(0,94%,63%)' : 'hsl(139,60%,49%)' }} />
          <p className="text-2xl font-bold text-foreground">{issueCount}</p>
          <p className="text-xs text-muted-foreground">Issues Found</p>
          {issueCount > 0 && (
            <span className="text-[10px] mt-2 inline-block px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">
              Needs attention
            </span>
          )}
        </div>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Issues */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-foreground mb-3">🔴 Issues Found</h3>
          {issueCount === 0 ? (
            <div className="flex items-center gap-2 text-xs text-green">
              <CheckCircle className="w-4 h-4" />
              No issues found!
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {cycles.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {c.cycle.map(f => f.split('/').pop()).join(' → ')} → {c.cycle[0].split('/').pop()}
                  </span>
                </div>
              ))}
              {stats.orphanFiles.map(f => (
                <div key={f} className="flex items-start gap-2 text-xs">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'hsl(39,73%,49%)' }} />
                  <button onClick={() => onSelectFile(f)} className="text-muted-foreground font-mono text-[10px] hover:text-foreground">
                    {f} — never imported
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Complexity Rankings */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-foreground mb-3">📊 File Complexity Rankings</h3>
          <div className="space-y-2">
            {stats.topComplex.map((f, i) => (
              <div key={f.path} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                <button onClick={() => onSelectFile(f.path)} className="text-[10px] font-mono text-foreground hover:text-primary truncate flex-1 text-left">
                  {f.path.split('/').pop()}
                </button>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 rounded-full bg-primary/30 w-16 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (f.imports / (stats.topComplex[0]?.imports || 1)) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-6 text-right">{f.imports}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-foreground">💡 AI Recommendations</h3>
          {recommendations.length === 0 && (
            <button
              onClick={generateRecommendations}
              disabled={loadingRecs}
              className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
            >
              {loadingRecs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
              Generate Recommendations
            </button>
          )}
        </div>
        {recommendations.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {recommendations.map((r, i) => (
              <div key={i} className="border border-border rounded-md p-3">
                <p className="text-xs font-medium text-foreground mb-1">{r.title}</p>
                <p className="text-[10px] text-muted-foreground">{r.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
