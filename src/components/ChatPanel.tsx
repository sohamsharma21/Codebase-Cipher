import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Bot, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { RepoFile } from '@/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isQuick?: boolean;
  isRefined?: boolean;
}

interface ChatPanelProps {
  selectedFile?: string;
  files: RepoFile[];
  repoName?: string;
}

const SUGGESTED_QUESTIONS = [
  'What does this file do?',
  'Are there any bugs here?',
  'How can I improve this code?',
  'What depends on this file?',
];

export default function ChatPanel({ selectedFile, files, repoName }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileContext, setFileContext] = useState<string | undefined>(selectedFile);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFileContext(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Using our new Scalable Backend Orchestrator (Gemini/Claude hybrid)
    try {
      const startTime = Date.now();
      const response = await fetch('http://localhost:3001/analyze-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId: repoName || 'default',
          nodeId: fileContext || 'root',
          repoPath: '/',
          nodes: [], // Visible nodes for context
          edges: [], // Visible edges for context
          query: text.trim()
        }),
      });

      if (!response.ok) throw new Error('Backend unreachabe');
      const data = await response.json();
      
      // Tier 1: Gemini Fast Result
      if (data.primary) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.primary,
          isQuick: true 
        }]);
      }

      // Tier 2: Claude Refined Result (if available)
      if (data.refined) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.refined,
          isRefined: true 
        }]);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      window.dispatchEvent(new CustomEvent('gitvizz:llm-metrics', { detail: { duration } }));
      
    } catch (err) {
      console.error('Analysis error:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I had trouble reaching the analysis engine. Ensure the backend server is running.' 
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, fileContext, repoName]);

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Context chip */}
      {fileContext && (
        <div className="px-3 py-2 border-b border-border bg-card/30">
          <div className="flex items-center gap-1 text-[10px] bg-secondary/50 rounded-full px-2 py-1 w-fit max-w-full">
            <span className="truncate text-muted-foreground">Context: {fileContext}</span>
            <button onClick={() => setFileContext(undefined)} className="shrink-0 hover:text-foreground text-muted-foreground ml-1">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3 mt-8">
            <p className="text-xs text-muted-foreground text-center mb-4 italic">Ask anything about this codebase</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-[10px] px-3 py-1.5 rounded-full border border-border bg-card hover:bg-secondary transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs relative ${
              msg.role === 'user'
                ? 'bg-primary text-white shadow-md'
                : 'bg-card border border-border text-foreground shadow-sm'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2 border-b border-border/50 pb-2">
                  <Bot className="w-4 h-4 text-primary" />
                  {msg.isQuick && (
                    <span className="text-[8px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase tracking-widest border border-blue-500/20">Gemini Fast</span>
                  )}
                  {msg.isRefined && (
                    <span className="text-[8px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded uppercase tracking-widest border border-violet-500/20">Claude Refined</span>
                  )}
                </div>
              )}
              <div className="prose prose-invert prose-xs max-w-none [&_p]:leading-relaxed">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '200ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card/20">
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Search code or ask a question..."
            className="flex-1 text-xs px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 shadow-lg transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
