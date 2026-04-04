import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Bot, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import type { RepoFile } from '@/types';

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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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

    const file = files.find(f => f.path === fileContext);
    const allPaths = files.filter(f => f.type === 'blob').map(f => f.path).join(', ');

    const systemPrompt = `You are an expert code assistant analyzing a GitHub repository.
Repository: ${repoName || 'Unknown'}
${fileContext ? `Currently viewing file: ${fileContext}` : 'No specific file selected.'}
${file?.content ? `File content:\n${file.content.slice(0, 2000)}` : ''}
All files in repo: ${allPaths}
Answer questions about this codebase concisely and accurately. Use markdown formatting.`;

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-code', {
        body: {
          messages: [...messages, userMsg].slice(-6).map(m => ({ role: m.role, content: m.content })),
          systemPrompt,
        },
      });
      if (error) throw error;
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, files, fileContext, repoName]);

  const handleSend = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => sendMessage(input), 300);
  }, [input, sendMessage]);

  return (
    <div className="flex flex-col h-full">
      {/* Context chip */}
      {fileContext && (
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-1 text-[10px] bg-secondary rounded-full px-2 py-1 w-fit max-w-full">
            <span className="truncate text-muted-foreground">Context: {fileContext}</span>
            <button onClick={() => setFileContext(undefined)} className="shrink-0 hover:text-foreground text-muted-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2 mt-4">
            <p className="text-xs text-muted-foreground text-center mb-3">Ask anything about this codebase</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
              msg.role === 'user'
                ? 'bg-[hsl(212,92%,45%)] text-white'
                : 'bg-card border border-border text-foreground'
            }`}>
              {msg.role === 'assistant' && <Bot className="w-3 h-3 text-muted-foreground mb-1" />}
              <div className="prose prose-invert prose-xs max-w-none [&_p]:m-0 [&_pre]:text-[10px] [&_code]:text-[10px]">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border">
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about this code..."
            className="flex-1 text-xs px-2 py-1.5 rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
