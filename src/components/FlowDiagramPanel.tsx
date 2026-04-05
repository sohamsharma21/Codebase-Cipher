import React, { useState, useEffect } from 'react';
import { Loader2, ArrowDown, Database, Zap, FileJson, ArrowRight, Settings, Box, Share, RefreshCw, Server, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface FlowStep {
  id: string;
  label: string;
  description: string;
  type: 'import' | 'initialize' | 'process' | 'validate' | 'return' | 'export' | 'sideEffect' | 'branch' | 'error';
  calls: string[];
  next: string[];
}

export interface FileFlow {
  fileRole: string;
  flowType: string;
  entryPoints: string[];
  steps: FlowStep[];
  dataFlow: string;
  sideEffects: string[];
}

interface FlowDiagramPanelProps {
  filePath: string;
  fileContent: string;
  isDemo?: boolean;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  import: <Box className="w-3.5 h-3.5" />,
  initialize: <Settings className="w-3.5 h-3.5" />,
  process: <RefreshCw className="w-3.5 h-3.5" />,
  validate: <Search className="w-3.5 h-3.5" />,
  return: <ArrowRight className="w-3.5 h-3.5" />,
  export: <Share className="w-3.5 h-3.5" />,
  sideEffect: <Server className="w-3.5 h-3.5" />,
  branch: <div className="w-3 h-3 rotate-45 border-2 border-current rounded-sm" />,
  error: <Zap className="w-3.5 h-3.5" />
};

const STEP_COLORS: Record<string, string> = {
  import: '#8b949e',
  initialize: '#d29922',
  process: '#58a6ff',
  validate: '#a371f7',
  return: '#3fb950',
  export: '#3fb950',
  sideEffect: '#f0883e',
  branch: '#f7df1e',
  error: '#f85149',
};

const TYPE_LABELS: Record<string, string> = {
  import: 'IMPORT',
  initialize: 'INITIALIZE',
  process: 'PROCESS',
  validate: 'VALIDATE',
  return: 'RETURN',
  export: 'EXPORT',
  sideEffect: 'SIDE EFFECT',
};

// Simple pseudo-parsing to fix markdown-wrapped json if any
function extractJSON(text: string) {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.slice(start, end + 1));
    }
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Failed to parse response into JSON');
  }
}

export default function FlowDiagramPanel({ filePath, fileContent, isDemo }: FlowDiagramPanelProps) {
  const [flow, setFlow] = useState<FileFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileContent) return;

    setLoading(true);
    setError(null);
    setFlow(null);

    let cancelled = false;

    const fetchFlow = async () => {
      if (isDemo) {
        // Provide mock demo data for express examples to be fast
        setTimeout(() => {
          if (!cancelled) {
            setFlow({
              fileRole: "Core utility script simulating mock process",
              flowType: "utility",
              entryPoints: ["main()"],
              dataFlow: "Receives raw request data and outputs formatted JSON",
              sideEffects: ["Writes trace logs"],
              steps: [
                { id: "s1", label: "Import dependencies", description: "Loads external libraries", type: "import", calls: ["fs", "path"], next: ["s2"] },
                { id: "s2", label: "Initialize variables", description: "Sets up configuration", type: "initialize", calls: [], next: ["s3"] },
                { id: "s3", label: "Process data", description: "Transforms input", type: "process", calls: ["transform()"], next: ["s4"] },
                { id: "s4", label: "Export results", description: "Returns formatted output", type: "export", calls: [], next: [] }
              ]
            });
            setLoading(false);
          }
        }, 1200);
        return;
      }

      try {
        const prompt = `Analyze this file and return ONLY a JSON object 
describing its execution flow. No markdown, no backticks, raw JSON only.

File: ${filePath}
Content: ${fileContent.slice(0, 3000)}

Return this exact structure:
{
  "fileRole": "One sentence: what role does this file play in the codebase",
  "flowType": "component|service|utility|controller|config|model",
  "entryPoints": ["function or export that starts execution"],
  "steps": [
    {
      "id": "step_1",
      "label": "Short step name",
      "description": "What happens in this step",
      "type": "import|initialize|process|validate|return|export|sideEffect|branch|error",
      "calls": ["external functions or imports used here"],
      "next": ["step_2"]
    }
  ],
  "dataFlow": "Brief description of what data enters and exits this file",
  "sideEffects": ["list any side effects like API calls, DB writes, etc"]
}`;

        const { data, error: funcError } = await supabase.functions.invoke('chat-with-code', {
          body: {
            messages: [{ role: 'user', content: prompt }],
            systemPrompt: "You are an expert system that solely outputs valid raw JSON."
          },
        });

        if (cancelled) return;
        if (funcError) throw funcError;

        const reply = data?.reply || data?.content || data?.message;
        if (!reply) throw new Error("No response content from AI");

        const parsedFlow = extractJSON(reply);
        setFlow(parsedFlow);
      } catch (err: any) {
        console.error('Flow diagram error:', err);
        if (!cancelled) setError(err.message || 'Failed to generate flow diagram');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFlow();

    return () => {
      cancelled = true;
    };
  }, [filePath, fileContent, isDemo]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin opacity-40 text-primary" />
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">Analyzing Execution Flow</p>
          <p className="text-[10px]">Calling AI to generate step-by-step diagram...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-destructive h-full">
        <Zap className="w-8 h-8 mb-3 opacity-60" />
        <p className="text-xs font-semibold">Generation Failed</p>
        <p className="text-[10px] opacity-70 mt-1">{error}</p>
      </div>
    );
  }

  if (!flow) {
    return null;
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      {/* File Role Header */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <FileJson className="w-4 h-4 text-[#58a6ff]" />
          <span className="text-sm font-bold font-mono truncate text-[#e6edf3]">{filePath.split('/').pop()}</span>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded font-mono bg-[#1f6feb]/20 text-[#58a6ff] uppercase border border-[#1f6feb]/30">
            {flow.flowType || 'file'}
          </span>
        </div>
        <div className="bg-[#0d1117] border border-[#30363d]/50 rounded-md p-3 mb-3">
          <p className="text-xs text-[#c9d1d9] leading-relaxed italic border-l-2 border-[#58a6ff] pl-3">
            {flow.fileRole}
          </p>
        </div>
        
        {flow.sideEffects && flow.sideEffects.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-[#f0883e]/10 border border-[#f0883e]/20 rounded w-max">
            <Server className="w-3 h-3 text-[#f0883e]" />
            <span className="text-[10px] uppercase font-bold text-[#f0883e]">Has Side Effects</span>
          </div>
        )}
        
        {flow.dataFlow && (
          <p className="text-[11px] text-[#8b949e] italic flex items-center gap-1 mt-3">
            <Database className="w-3 h-3" /> Data flow: {flow.dataFlow}
          </p>
        )}
      </div>

      {/* Execution Flow Diagram */}
      <div className="flex flex-col items-center relative py-2">
        {flow.steps.map((step, index) => {
          const color = STEP_COLORS[step.type] || '#8b949e';
          const isBranch = step.type === 'branch';

          return (
            <React.Fragment key={step.id}>
              {/* Step Card */}
              {isBranch ? (
                <div className="relative group w-full flex flex-col items-center">
                  <div
                    className="w-10 h-10 border-2 rotate-45 flex items-center justify-center bg-[#161b22] shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-colors z-10"
                    style={{ borderColor: color }}
                  />
                  {/* Branch tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-14 opacity-0 group-hover:opacity-100 transition-opacity bg-[#21262d] border border-[#30363d] p-3 rounded-lg shadow-xl w-[240px] pointer-events-none z-50">
                    <p className="text-[11px] font-bold text-white mb-1">{step.label}</p>
                    <p className="text-[10px] text-[#8b949e] leading-relaxed">{step.description}</p>
                  </div>
                  <div className="mt-2 mb-1 text-[10px] font-bold text-[#c9d1d9] uppercase tracking-widest">{step.label}</div>
                </div>
              ) : (
                <div
                  className="group w-full max-w-[280px] bg-[#161b22] border rounded-[8px] p-3 shadow-lg relative z-10 transition-colors cursor-default"
                  style={{ borderColor: color }}
                >
                  <div className="flex items-center gap-2 border-b border-[#30363d] pb-2 mb-2" style={{ color }}>
                    {TYPE_ICONS[step.type] || <Zap className="w-3.5 h-3.5" />}
                    <span className="text-[10px] font-bold tracking-wider uppercase">
                      {TYPE_LABELS[step.type] || step.type}
                    </span>
                  </div>
                  
                  <div className="text-xs font-semibold text-[#e6edf3] mb-1">
                    {step.label}
                  </div>
                  
                  <div className="text-[10px] text-[#8b949e] leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                    {step.description}
                  </div>

                  {step.calls && step.calls.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-[#30363d]/50 flex flex-wrap gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      {step.calls.map((call, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-[#0d1117] text-[#c9d1d9] border border-[#30363d]">
                          {call}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Down Arrow (except for last step if it has no next) */}
              {(index < flow.steps.length - 1 || (step.next && step.next.length > 0)) && (
                <div className="flex flex-col items-center my-0">
                  <div className="w-px h-6" style={{ background: color }}></div>
                  <ArrowDown className="w-4 h-4 -mt-1 z-0" style={{ color }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
