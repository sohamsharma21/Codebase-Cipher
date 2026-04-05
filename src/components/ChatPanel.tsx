import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Bot, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { RepoFile } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

    try {
      // Find file content for context
      const contextFile = files.find(f => f.path === fileContext);
      const fileContent = contextFile?.content?.slice(0, 3000) || '';

      const { data, error } = await supabase.functions.invoke('chat-with-code', {
        body: {
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          fileContext: fileContext,
          fileContent,
          repoName: repoName || '',
          query: text.trim(),
        },
      });

      if (error) throw error;

      const reply = data?.reply || data?.message || data?.content || 'I could not generate a response. Please try again.';

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
      }]);
    } catch (err) {
      console.warn('Chat edge function failed, using client-side analysis:', err);
      
      // Smart client-side response generation
      const contextFile = files.find(f => f.path === fileContext);
      const content = contextFile?.content || '';
      const fileName = fileContext?.split('/').pop() || 'this file';
      const query = text.trim().toLowerCase();
      
      let reply = '';
      
      if (query.includes('what does') || query.includes('purpose') || query.includes('explain')) {
        const lines = content.split('\n');
        const imports = lines.filter(l => /^import\s/.test(l.trim()));
        const exports = lines.filter(l => /^export\s/.test(l.trim()));
        const isComponent = /\.(jsx|tsx)$/.test(fileName) && content.includes('return (');
        const isHook = fileName.startsWith('use');
        reply = `## ${fileName}\n\n` +
          `**Type:** ${isComponent ? 'React Component' : isHook ? 'Custom Hook' : 'Module'}\n` +
          `**Lines:** ${lines.length}\n` +
          `**Imports:** ${imports.length} dependencies\n` +
          `**Exports:** ${exports.length} exports\n\n` +
          (isComponent ? `This is a React component that renders UI elements. ` : '') +
          (isHook ? `This is a custom React hook that provides reusable stateful logic. ` : '') +
          `It has ${imports.length} import(s) connecting it to other parts of the codebase.`;
      } else if (query.includes('bug') || query.includes('issue') || query.includes('problem')) {
        const todoCount = (content.match(/TODO|FIXME|HACK|XXX/gi) || []).length;
        const catchBlocks = (content.match(/catch\s*\(/g) || []).length;
        const anyTypes = (content.match(/:\s*any/g) || []).length;
        reply = `## Code Quality Report for ${fileName}\n\n` +
          `- **TODO/FIXME markers:** ${todoCount}\n` +
          `- **Error handlers (catch blocks):** ${catchBlocks}\n` +
          `- **Uses of \`any\` type:** ${anyTypes}\n\n` +
          (todoCount > 0 ? `⚠️ Found ${todoCount} TODO/FIXME markers that may need attention.\n` : '✅ No TODO markers found.\n') +
          (anyTypes > 3 ? `⚠️ High usage of \`any\` type (${anyTypes}) — consider adding proper types.\n` : '') +
          (catchBlocks === 0 && content.includes('async') ? `⚠️ Async code without error handling detected.\n` : '');
      } else if (query.includes('improve') || query.includes('refactor') || query.includes('better')) {
        const loc = content.split('\n').length;
        reply = `## Improvement Suggestions for ${fileName}\n\n` +
          (loc > 300 ? `1. **Split into smaller modules** — ${loc} lines is quite long. Consider extracting logic into separate files.\n` : '') +
          `2. **Add documentation** — JSDoc comments for exported functions improve maintainability.\n` +
          `3. **Error boundaries** — Ensure proper error handling for async operations.\n` +
          `4. **Type safety** — Replace any \`any\` types with proper interfaces.\n` +
          `5. **Testing** — Add unit tests for core logic functions.`;
      } else if (query.includes('depend') || query.includes('import')) {
        const imports = content.split('\n').filter(l => /^import\s/.test(l.trim()));
        reply = `## Dependencies of ${fileName}\n\n` +
          (imports.length > 0 
            ? imports.map(l => `- \`${l.trim()}\``).join('\n')
            : 'No imports detected in this file.');
      } else {
        // Generic helpful response
        const lines = content.split('\n');
        const functions = lines.filter(l => /function\s+\w|const\s+\w+\s*=\s*(\(|async)/.test(l.trim()));
        reply = `I analyzed **${fileName}** (${lines.length} lines). Here's what I found:\n\n` +
          `- **${functions.length}** function/variable declarations\n` +
          `- **${lines.filter(l => /^import/.test(l.trim())).length}** imports\n` +
          `- **${lines.filter(l => /^export/.test(l.trim())).length}** exports\n\n` +
          `Try asking:\n- "What does this file do?"\n- "Are there any bugs?"\n- "How can I improve this code?"\n- "What depends on this file?"`;
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, fileContext, repoName, files]);

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
            <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs ${
              msg.role === 'user'
                ? 'bg-primary text-white shadow-md'
                : 'bg-card border border-border text-foreground shadow-sm'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2 border-b border-border/50 pb-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <span className="text-[8px] font-bold text-primary/80 bg-primary/10 px-2 py-0.5 rounded uppercase tracking-widest">AI Assistant</span>
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
            placeholder="Ask about this code..."
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
