import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Brain, X, Maximize2, Minimize2, Sparkles, Loader2, Target } from 'lucide-react';
import { RepoFile, APIEndpoint } from '@/types';
import { Node, Edge } from '@xyflow/react';

interface RepoIntelligenceOverlayProps {
  repoName: string;
  files: RepoFile[];
  nodes: Node[];
  edges: Edge[];
  endpoints: APIEndpoint[];
  hasData: boolean;
  loading: boolean;
}

export interface RepoSummaryData {
  projectType: string;
  techStack: string[];
  architecture: string;
  summary: string;
  mainFeatures: string[];
  entryPointExplanation: string;
  topInsight: string;
}

export default function RepoIntelligenceOverlay({ repoName, files, nodes, edges, endpoints, hasData, loading }: RepoIntelligenceOverlayProps) {
  const [summaryData, setSummaryData] = useState<RepoSummaryData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Track the current repo to avoid re-fetching
  const [currentRepo, setCurrentRepo] = useState<string>('');

  useEffect(() => {
    if (!hasData || loading || !repoName) {
      return;
    }
    
    // Check if we already analyzed this repo
    if (repoName === currentRepo) {
      return;
    }

    setCurrentRepo(repoName);
    setSummaryData(null);
    setDataLoading(true);
    setCollapsed(false);

    let cancelled = false;

    const fetchSummary = async () => {
      try {
        const fileCount = files.length;
        const entryFiles = nodes.filter(n => n.data?.isEntry).map(n => n.id);
        const coreFiles = nodes.filter(n => n.data?.isCore).map(n => n.id);
        const allPaths = files.map(f => f.path);
        const endpointPaths = endpoints.map(e => `${e.method} ${e.path}`);
        
        // Very basic circular dep format for the prompt
        const circularDepsCount = edges.filter((e: any) => e.data?.isCircular).length || 0;

        const prompt = `Analyze this repository structure and return ONLY raw JSON, no markdown.

Repository: ${repoName}
Total files: ${fileCount}
Entry points: ${entryFiles.join(', ')}
Core files (most imported): ${coreFiles.join(', ')}
All file paths: ${allPaths.slice(0, 200).join('\n')}
Detected API endpoints: ${endpointPaths.join(', ')}
Circular dependencies: ${circularDepsCount}

{
  "projectType": "React App|Node API|Full Stack|Library|CLI Tool|Other",
  "techStack": ["React", "Express", "etc"],
  "architecture": "MVC|Component-Based|Microservices|Monolith|etc",
  "summary": "2-3 sentence plain English description of what this project does",
  "mainFeatures": ["feature 1", "feature 2", "feature 3"],
  "entryPointExplanation": "How the app starts and boots up",
  "topInsight": "One surprising or interesting thing about this codebase"
}`;

        const { data, error } = await supabase.functions.invoke('chat-with-code', {
          body: {
            messages: [{ role: 'user', content: prompt }],
            systemPrompt: "You are an expert software architect analyzing codebases. You must output ONLY RAW JSON format."
          },
        });

        if (cancelled) return;
        if (error) throw error;

        const reply = data?.reply || data?.content || data?.message;
        if (!reply) throw new Error("No response from AI");

        // Parse JSON safely
        let parsed: RepoSummaryData;
        try {
          const start = reply.indexOf('{');
          const end = reply.lastIndexOf('}');
          parsed = JSON.parse(reply.slice(start, end + 1));
        } catch (e) {
          parsed = JSON.parse(reply);
        }

        setSummaryData(parsed);

        // Auto collapse after 8 seconds
        const timer = setTimeout(() => {
          if (!cancelled) setCollapsed(true);
        }, 8000);
        setAutoHideTimer(timer);

      } catch (err) {
        console.error('Failed to generate repo summary:', err);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    fetchSummary();

    return () => {
      cancelled = true;
      if (autoHideTimer) clearTimeout(autoHideTimer);
    };
  }, [hasData, loading, repoName, files, nodes, edges, endpoints]);

  // Clean up timer if user interacts
  const handleCollapseToggle = () => {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      setAutoHideTimer(null);
    }
    setCollapsed(!collapsed);
  };

  if (!hasData || loading) return null;

  if (collapsed && summaryData) {
    return (
      <button 
        onClick={handleCollapseToggle}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-[#21262d]/90 backdrop-blur-md border border-[#30363d] rounded-full shadow-lg hover:border-[#58a6ff]/50 hover:bg-[#30363d] transition-all text-[#e6edf3] text-xs font-semibold animate-in slide-in-from-bottom"
      >
        <Brain className="w-4 h-4 text-[#a371f7]" />
        <span>View Repo Intelligence</span>
      </button>
    );
  }

  if (dataLoading) {
    return (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex items-center gap-3 px-6 py-4 bg-[#161b22]/90 backdrop-blur-xl border border-[#30363d] rounded-2xl shadow-2xl animate-in zoom-in-95">
        <Loader2 className="w-5 h-5 animate-spin text-[#a371f7]" />
        <span className="text-[#e6edf3] text-sm font-semibold">Synthesizing Repository Intelligence...</span>
      </div>
    );
  }

  if (!summaryData) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[520px] bg-[#0d1117]/95 backdrop-blur-xl border border-[#30363d] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#30363d] bg-[#161b22]">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#a371f7]" />
          <h3 className="text-[13px] font-bold text-[#e6edf3] tracking-wide uppercase">Repository Intelligence</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCollapseToggle} className="p-1.5 rounded-md hover:bg-[#30363d] text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            <Minimize2 className="w-4 h-4" />
          </button>
          <button onClick={() => setSummaryData(null)} className="p-1.5 rounded-md hover:bg-[#f85149]/20 text-[#8b949e] hover:text-[#f85149] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col space-y-5">
        {/* Top Info Banner */}
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="text-[15px] font-bold text-[#58a6ff] flex items-center gap-2 mb-1">
              <Package className="w-4 h-4" /> {repoName}
            </div>
            <div className="text-[11px] text-[#8b949e] italic leading-snug">
              {summaryData.summary}
            </div>
          </div>
        </div>

        {/* Tags Block */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-2.5">
            <div className="text-[10px] uppercase font-bold text-[#8b949e] mb-1">Architecture</div>
            <div className="text-xs font-semibold text-[#e6edf3]">{summaryData.architecture}</div>
          </div>
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-2.5">
            <div className="text-[10px] uppercase font-bold text-[#8b949e] mb-1">Project Type</div>
            <div className="text-xs font-semibold text-[#e6edf3]">{summaryData.projectType}</div>
          </div>
        </div>

        {/* Tech Stack */}
        <div>
          <div className="text-[10px] uppercase font-bold text-[#8b949e] mb-2 flex items-center gap-1">
            <Target className="w-3.5 h-3.5" /> Core Technology Stack
          </div>
          <div className="flex flex-wrap gap-1.5">
            {summaryData.techStack.map(t => (
              <span key={t} className="px-2 py-1 bg-[#21262d] border border-[#30363d] rounded text-[10px] text-[#e6edf3] font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Main Features */}
        <div>
          <div className="text-[10px] uppercase font-bold text-[#8b949e] mb-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#3fb950]" /> Main Features
          </div>
          <ul className="text-[11px] text-[#c9d1d9] space-y-1.5 ml-1">
            {summaryData.mainFeatures.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#3fb950]">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Startup Process */}
        <div>
          <div className="text-[10px] uppercase font-bold text-[#8b949e] mb-1">🚀 Boot Process</div>
          <p className="text-[11px] text-[#c9d1d9] leading-relaxed p-2 bg-[#161b22] border border-[#30363d]/60 rounded-md">
            {summaryData.entryPointExplanation}
          </p>
        </div>

        {/* Top Insight */}
        <div className="p-3 bg-gradient-to-r from-[#a371f7]/10 to-transparent border border-[#a371f7]/20 rounded-xl relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
            <Brain className="w-24 h-24 text-[#a371f7]" />
          </div>
          <h4 className="text-[11px] font-bold text-[#a371f7] uppercase mb-1 flex items-center gap-1.5 relative z-10">
            ✨ Top Insight
          </h4>
          <p className="text-xs text-[#e6edf3] leading-relaxed relative z-10 font-medium">
            "{summaryData.topInsight}"
          </p>
        </div>

      </div>

      {/* Footer controls */}
      <div className="flex gap-3 px-5 py-3 border-t border-[#30363d] bg-[#161b22]">
        <button onClick={handleCollapseToggle} className="flex-1 px-4 py-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-xs font-semibold text-[#e6edf3] transition-colors text-center">
          Explore Graph
        </button>
      </div>

    </div>
  );
}
// Fix missing import
function Package(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
}
