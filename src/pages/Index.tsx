import { useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from '@xyflow/react';
import { GitBranch, Star, RotateCcw, Download, ClipboardCopy, FileText, Camera, ArrowLeft, Brain, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import LeftPanel from '@/components/LeftPanel';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import { useGitHubAnalysis } from '@/hooks/useGitHubAnalysis';
import ShareModal from '@/components/ShareModal';

function GitVizzApp() {
  const navigate = useNavigate();
  const {
    files, nodes: analysisNodes, edges: analysisEdges, endpoints,
    functionMap, repoInfo, loading, progress, isDemo, metrics, currentFile,
    analyze, loadDemo,
  } = useGitHubAnalysis();

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Auto-analyze from query params: ?repo=owner/name
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get('repo');
    if (repoParam && !hasData && !loading) {
      handleAnalyze(`https://github.com/${repoParam}`);
    }
  }, []);

  // Global Keyboard Shortcuts (Ctrl+S for Share)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        setShowShareModal(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Sync analysis results into flow state & trigger background AI Badges
  useEffect(() => {
    if (analysisNodes.length > 0) {
      setFlowNodes(analysisNodes);
      setFlowEdges(analysisEdges);
      
      // Feature 2C: Trigger background AI Analysis for badges
      const runAiBadges = async () => {
        setIsAiAnalyzing(true);
        
        // Find top 10 most connected
        const topFiles = [...analysisNodes]
          .sort((a, b) => {
            const aConn = (a.data?.importCount as number || 0) + (a.data?.usedByCount as number || 0);
            const bConn = (b.data?.importCount as number || 0) + (b.data?.usedByCount as number || 0);
            return bConn - aConn;
          })
          .slice(0, 10);
          
        for (const node of topFiles) {
          const filePath = node.data?.filePath as string;
          const fileData = files.find(f => f.path === filePath);
          
          if (!fileData) continue;
          
          try {
            const prompt = `Rate this file briefly. Return only JSON:
{
  "badge": "Clean|Complex|Risky|Core|HotPath",
  "reason": "One sentence why"
}
File: ${filePath}
Imported by: ${node.data?.usedByCount || 0} files
Imports: ${node.data?.importCount || 0} files
Content preview: ${fileData.content?.slice(0, 500) || 'no content'}`;
            
            const { data } = await supabase.functions.invoke('chat-with-code', {
               body: { 
                 messages: [{ role: 'user', content: prompt }],
                 systemPrompt: 'You are an AI code reviewer. Output ONLY valid JSON.'
               }
            });
            
            if (data?.reply || data?.content) {
              const replyText = data.reply || data.content;
              const start = replyText.indexOf('{');
              const end = replyText.lastIndexOf('}');
              const parsed = JSON.parse(replyText.slice(start, end + 1));
              
              setFlowNodes(nds => nds.map(n => {
                if (n.id === node.id) {
                  return {
                    ...n,
                    data: { ...n.data, badge: parsed.badge, badgeReason: parsed.reason }
                  };
                }
                return n;
              }));
            }
          } catch(e) {
            console.error('Failed code quality check for', filePath, e);
          }
        }
        
        setIsAiAnalyzing(false);
      };
      
      runAiBadges();
    }
  }, [analysisNodes, analysisEdges, setFlowNodes, setFlowEdges, files]);

  // Auto-analyze from query params (e.g. ?repo=owner/repo)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get('repo');
    if (repoParam && !analysisNodes.length && !loading) {
      handleAnalyze(`https://github.com/${repoParam}`);
    }
  }, []); // run once on mount

  // Global Keyboard Shortcuts (Ctrl+S for Share)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        setShowShareModal(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Bug #4 fix: Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as globalThis.Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // Bug #3 fix: Destructured `analyze` and `loadDemo` are stable useCallback refs from the hook
  const handleAnalyze = useCallback(async (url: string) => {
    setSelectedFile(undefined);
    setFlowNodes([]);
    setFlowEdges([]);
    await analyze(url);
  }, [analyze, setFlowNodes, setFlowEdges]);

  const handleLoadDemo = useCallback(() => {
    setSelectedFile(undefined);
    loadDemo();
  }, [loadDemo]);

  // Bug #14 fix: Always use undefined (not empty string) for "no selection"
  const handleClearSelection = useCallback(() => {
    setSelectedFile(undefined);
  }, []);

  // Bug #15 fix: Reset analysis state instead of full page reload
  const handleNewAnalysis = useCallback(() => {
    setSelectedFile(undefined);
    setFlowNodes([]);
    setFlowEdges([]);
    // Navigate to landing page for a fresh start
    navigate('/');
  }, [setFlowNodes, setFlowEdges, navigate]);

  const hasData = flowNodes.length > 0;
  const repoName = repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : undefined;

  const handleExport = useCallback(async (type: 'json' | 'text' | 'png') => {
    setShowExportMenu(false);
    if (type === 'json') {
      const data = JSON.stringify({ nodes: flowNodes.map(n => ({ id: n.id, data: n.data })), edges: flowEdges.map(e => ({ source: e.source, target: e.target })) }, null, 2);
      navigator.clipboard.writeText(data);
      toast.success('Node list copied to clipboard');
    } else if (type === 'text') {
      const text = `Codebase Cipher Report - ${repoName || 'Unknown'}\n\nFiles: ${flowNodes.length}\nConnections: ${flowEdges.length}\n\nNodes:\n${flowNodes.map(n => `  - ${n.id}`).join('\n')}`;
      navigator.clipboard.writeText(text);
      toast.success('Report copied to clipboard');
    } else if (type === 'png') {
      toast('Capturing graph...');
      try {
        const { default: html2canvas } = await import('html2canvas');
        const canvas = document.querySelector('.react-flow') as HTMLElement;
        if (!canvas) { toast.error('Graph not found'); return; }
        const c = await html2canvas(canvas, { backgroundColor: '#0d1117', scale: 2 });
        const link = document.createElement('a');
        link.download = `codebase-cipher-${repoName?.replace('/', '-') || 'graph'}.png`;
        link.href = c.toDataURL();
        link.click();
        toast.success('Graph exported as PNG');
      } catch {
        toast.error('Failed to capture graph');
      }
    }
  }, [flowNodes, flowEdges, repoName]);

  const [mobilePanel, setMobilePanel] = useState<'left' | 'center' | 'right'>('left');

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0d1117] overflow-hidden text-[#e6edf3] font-sans selection:bg-[#58a6ff]/30 relative transition-all">
      <header className="h-[52px] border-b border-[#30363d] bg-gradient-to-b from-[#161b22] to-[#0d1117] flex items-center px-4 shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-white/5 text-[#8b949e] hover:text-white transition-colors" title="Back to home">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded border border-white/10 bg-black/50 flex shadow-inner backdrop-blur-sm p-1">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain rounded-sm" />
          </div>
          <div className="hidden sm:block">
            <span className="font-extrabold text-[15px] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8b949e]">Codebase Cipher</span>
            <span className="text-[9px] ml-2 px-2 py-0.5 rounded-full border border-[#58a6ff]/30 bg-[#58a6ff]/10 text-[#58a6ff] font-mono tracking-widest font-semibold uppercase">v2.0 PWA</span>
          </div>
        </div>
        {repoInfo && (
          <>
            <div className="hidden sm:block mx-5 h-4 w-px bg-white/10" />
            <div className="hidden sm:flex items-center gap-1 text-[13px] font-medium px-2 py-0.5 bg-white/5 rounded-md border border-white/5 shadow-inner">
               <span className="text-[#8b949e]">{repoInfo.owner}/</span>
               <span className="text-white">{repoInfo.repo}</span>
            </div>
            {repoInfo.stars !== undefined && (
              <span className="hidden md:flex ml-3 items-center gap-1 text-xs text-[#d29922] font-semibold bg-[#d29922]/10 px-2 py-0.5 rounded-full border border-[#d29922]/20">
                <Star className="w-3.5 h-3.5 fill-[#d29922]" />
                {repoInfo.stars.toLocaleString()}
              </span>
            )}
          </>
        )}
        <div className="flex-1" />
        
        {/* Mobile View Toggle */}
        <div className="flex sm:hidden border border-[#30363d] rounded-lg p-0.5 mr-2 bg-[#161b22]">
           <button onClick={() => setMobilePanel('left')} className={`px-2 py-1 rounded text-[10px] uppercase font-bold transition-colors ${mobilePanel === 'left' ? 'bg-[#58a6ff] text-white' : 'text-[#8b949e]'}`}>Files</button>
           <button onClick={() => setMobilePanel('center')} className={`px-2 py-1 rounded text-[10px] uppercase font-bold transition-colors ${mobilePanel === 'center' ? 'bg-[#58a6ff] text-white' : 'text-[#8b949e]'}`}>Graph</button>
           <button onClick={() => setMobilePanel('right')} className={`px-2 py-1 rounded text-[10px] uppercase font-bold transition-colors ${mobilePanel === 'right' ? 'bg-[#58a6ff] text-white' : 'text-[#8b949e]'}`}>Details</button>
        </div>

        {isAiAnalyzing && (
          <div className="hidden sm:flex items-center gap-2 mr-4 px-3 py-1.5 bg-[#a371f7]/10 border border-[#a371f7]/30 rounded-full text-[#a371f7] text-[11px] font-semibold shadow-inner shadow-[#a371f7]/20">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="animate-pulse">Deep Analyzing...</span>
          </div>
        )}
        {hasData && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold tracking-wide rounded-md bg-gradient-to-b from-[#1f6feb] to-[#1158c7] border border-[#388bfd] text-white hover:brightness-110 active:scale-95 transition-all shadow-sm"
            >
              Share Graph
            </button>
            <div className="relative hidden md:block" ref={exportMenuRef}>
              <button onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[#30363d] bg-[#21262d] shadow-sm text-[#c9d1d9] hover:bg-[#30363d] transition-colors">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-10 z-50 bg-[#161b22]/95 backdrop-blur-xl border border-[#30363d] rounded-lg shadow-2xl py-1 min-w-[220px] overflow-hidden">
                  <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-2 text-xs hover:bg-[#30363d] focus:bg-[#30363d] flex items-center gap-2 text-[#e6edf3] font-medium transition-colors">
                    <ClipboardCopy className="w-3.5 h-3.5 text-[#8b949e]" /> Raw JSON Dump
                  </button>
                  <button onClick={() => handleExport('text')} className="w-full text-left px-3 py-2 text-xs hover:bg-[#30363d] focus:bg-[#30363d] flex items-center gap-2 text-[#e6edf3] font-medium transition-colors">
                    <FileText className="w-3.5 h-3.5 text-[#8b949e]" /> Text Manifest
                  </button>
                  <button onClick={() => handleExport('png')} className="w-full text-left px-3 py-2 text-xs hover:bg-[#30363d] focus:bg-[#30363d] flex items-center gap-2 text-[#e6edf3] font-medium transition-colors">
                    <Camera className="w-3.5 h-3.5 text-[#8b949e]" /> Capture Hi-Res Canvas
                  </button>
                </div>
              )}
            </div>
            
            <button onClick={handleNewAnalysis}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[#30363d] bg-[#21262d] shadow-sm text-[#c9d1d9] hover:bg-[#30363d] transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Initialize New
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden relative z-10 w-full h-[calc(100vh-52px)]">
        {/* Left Panel - File Drawer */}
        <div className={`
           absolute sm:relative z-20 sm:z-0 h-full w-full sm:w-auto transition-transform duration-300
           ${mobilePanel === 'left' ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
           sm:flex sm:flex-col
        `}>
           <LeftPanel files={files} progress={progress} loading={loading}
             onAnalyze={handleAnalyze} onLoadDemo={handleLoadDemo} onSelectFile={setSelectedFile} selectedFile={selectedFile} />
        </div>

        {/* Center Panel - Graph Canvas */}
        <div className={`
           flex-1 h-full w-full absolute sm:relative transition-opacity duration-300
           ${mobilePanel === 'center' || window.innerWidth >= 640 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none sm:pointer-events-auto sm:opacity-100'}
        `}>
           <CenterPanel files={files} nodes={flowNodes} edges={flowEdges} endpoints={endpoints}
             functionMap={functionMap} metrics={metrics}
             selectedFile={selectedFile}
             onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={setSelectedFile} onClearSelection={handleClearSelection} hasData={hasData}
             loading={loading} progress={progress} currentFile={currentFile} repoName={repoName} />
        </div>
        
        {/* Right Panel - Active Intelligence Tab */}
        <div className={`
           absolute sm:relative z-20 sm:z-0 right-0 h-full w-full sm:w-[360px] lg:w-[400px] transition-transform duration-300
           ${mobilePanel === 'right' ? 'translate-x-0' : 'translate-x-full sm:translate-x-0'}
           bg-[#0d1117] border-l border-[#30363d]
        `}>
           <RightPanel selectedFile={selectedFile} files={files} isDemo={isDemo} repoName={repoName} nodes={flowNodes} edges={flowEdges} />
        </div>
      </div>

      {showShareModal && (
        <ShareModal 
          repoName={repoName || ''} 
          onClose={() => setShowShareModal(false)}
          healthScore={87}
        />
      )}
    </div>
  );
}

export default function Index() {
  return (
    <ReactFlowProvider>
      <GitVizzApp />
    </ReactFlowProvider>
  );
}
