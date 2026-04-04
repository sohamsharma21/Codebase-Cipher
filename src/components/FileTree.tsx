import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { FileTreeNode } from '@/types';
import { getFileIcon, getFileColor } from '@/lib/parser';

interface FileTreeProps {
  nodes: FileTreeNode[];
  onSelectFile: (path: string) => void;
  selectedFile?: string;
  filter?: string;
}

function matchesFilter(node: FileTreeNode, filter: string): boolean {
  if (!filter) return true;
  const lowerFilter = filter.toLowerCase();
  if (node.name.toLowerCase().includes(lowerFilter)) return true;
  if (node.children) return node.children.some(c => matchesFilter(c, lowerFilter));
  return false;
}

function TreeItem({ node, onSelectFile, selectedFile, depth = 0, filter = '' }: {
  node: FileTreeNode;
  onSelectFile: (path: string) => void;
  selectedFile?: string;
  depth?: number;
  filter?: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1 || !!filter);
  const isSelected = selectedFile === node.path;

  if (!matchesFilter(node, filter)) return null;

  if (node.type === 'folder') {
    const shouldExpand = filter ? true : expanded;
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 w-full text-left py-0.5 px-1 rounded text-xs hover:bg-secondary/50 transition-colors"
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
          )}
          <span className="mr-1">📁</span>
          <span className="truncate text-foreground">{node.name}</span>
        </button>
        {expanded && node.children?.map(child => (
          <TreeItem key={child.path} node={child} onSelectFile={onSelectFile} selectedFile={selectedFile} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`flex items-center gap-1 w-full text-left py-0.5 px-1 rounded text-xs transition-colors ${
        isSelected ? 'bg-primary/20 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'
      }`}
      style={{ paddingLeft: depth * 12 + 16 }}
    >
      <span className="mr-1 text-[10px]">{getFileIcon(node.path)}</span>
      <span className="truncate" style={{ color: isSelected ? undefined : getFileColor(node.path) }}>
        {node.name}
      </span>
    </button>
  );
}

export default function FileTree({ nodes, onSelectFile, selectedFile }: FileTreeProps) {
  return (
    <div className="text-sm overflow-y-auto">
      {nodes.map(node => (
        <TreeItem key={node.path} node={node} onSelectFile={onSelectFile} selectedFile={selectedFile} />
      ))}
    </div>
  );
}
