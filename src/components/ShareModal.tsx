import React, { useState } from 'react';
import { X, Copy, Twitter, Download, Code, Check } from 'lucide-react';

interface ShareModalProps {
  repoName: string;
  onClose: () => void;
  healthScore?: number;
}

export default function ShareModal({ repoName, onClose, healthScore = 87 }: ShareModalProps) {
  const [activeTab, setActiveTab] = useState<'link' | 'embed'>('link');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState(false);

  const shareUrl = `${window.location.origin}/?repo=${repoName}&view=graph`;
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `Check out the architecture of ${repoName} on GitVizz!`
  )}&url=${encodeURIComponent(shareUrl)}&hashtags=GitVizz,opensource,coding`;

  const safeHealthScore = Math.round(healthScore);
  const badgeColor = safeHealthScore >= 80 ? '3fb950' : safeHealthScore >= 50 ? 'd29922' : 'f85149';
  const badgeUrl = `https://img.shields.io/badge/GitVizz-${safeHealthScore}%2F100-${badgeColor}?style=flat&logo=github&logoColor=white`;
  const markdownBadge = `[![GitVizz](${badgeUrl})](${shareUrl})`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyBadge = () => {
    navigator.clipboard.writeText(markdownBadge);
    setCopiedBadge(true);
    setTimeout(() => setCopiedBadge(false), 2000);
  };

  const handleDownloadGraph = () => {
    // Basic screenshot dispatch fallback
    window.dispatchEvent(new Event('gitvizz_download_graph'));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0d1117] border border-[#30363d] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden animate-in zoom-in-95">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d] bg-[#161b22]">
          <h2 className="text-[15px] font-bold text-[#e6edf3] flex items-center gap-2">
            🔗 Share This Analysis
          </h2>
          <button onClick={onClose} className="p-1 text-[#8b949e] hover:text-[#f85149] hover:bg-[#f85149]/10 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex px-3 pt-3 border-b border-[#30363d] bg-[#161b22]">
          <button 
            className={`px-4 py-2 text-[13px] font-semibold border-b-2 transition-colors ${activeTab === 'link' ? 'border-[#58a6ff] text-[#e6edf3]' : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'}`}
            onClick={() => setActiveTab('link')}
          >
            Share URL
          </button>
          <button 
            className={`px-4 py-2 text-[13px] font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${activeTab === 'embed' ? 'border-[#58a6ff] text-[#e6edf3]' : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9]'}`}
            onClick={() => setActiveTab('embed')}
          >
            <Code className="w-3.5 h-3.5" />Embed Badge
          </button>
        </div>

        <div className="p-5">
          {activeTab === 'link' ? (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] text-[#8b949e] mb-2 leading-relaxed">
                  Anyone with this link can view your GitVizz analysis:
                </p>
                <div className="flex items-center p-2.5 bg-[#161b22] border border-[#30363d] rounded-lg">
                  <span className="flex-1 text-[12px] text-[#58a6ff] font-mono truncate mr-2 select-all">
                    {shareUrl.replace(/^https?:\/\//, '')}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={handleCopyLink}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-lg text-[13px] font-semibold text-[#e6edf3] transition-colors"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-[#3fb950]" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? 'Copied!' : 'Copy Link'}
                </button>
                <a 
                  href={twitterUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#1da1f2] hover:bg-[#1a91da] text-white rounded-lg text-[13px] font-semibold transition-colors"
                >
                  <Twitter className="w-4 h-4" />
                  Share on Twitter
                </a>
              </div>

              <div className="border-t border-[#30363d] pt-4 mt-2">
                <p className="text-[12px] text-[#8b949e] mb-2">📸 Or share as image:</p>
                <button 
                  onClick={handleDownloadGraph}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-transparent hover:bg-[#21262d] border border-[#30363d] border-dashed rounded-lg text-[13px] font-semibold text-[#c9d1d9] transition-colors"
                >
                  <Download className="w-4 h-4 text-[#8b949e]" />
                  Download Graph Screenshot
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] text-[#8b949e] mb-2 leading-relaxed">
                  📛 README Badge<br />
                  Add this to your README to show your codebase health:
                </p>
                <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg flex items-center justify-center mb-3">
                  <img src={badgeUrl} alt="GitVizz Health Score" />
                </div>
                
                <div className="relative">
                  <pre className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg overflow-x-auto text-[11px] text-[#58a6ff] font-mono leading-relaxed pb-8">
                    {markdownBadge}
                  </pre>
                  <button 
                    onClick={handleCopyBadge}
                    className="absolute right-2 bottom-2 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded text-[11px] font-semibold text-[#e6edf3] flex items-center gap-1.5 transition-colors"
                  >
                    {copiedBadge ? <Check className="w-3.5 h-3.5 text-[#3fb950]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedBadge ? 'Copied' : 'Copy Markdown'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
