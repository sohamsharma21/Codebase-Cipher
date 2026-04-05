import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { getFileColor, getFileExtension, getFileIcon } from '@/lib/parser';
import type { NodeRole } from '@/types';

interface CustomNodeProps {
<<<<<<< HEAD
  data: {
    label: string;
    filePath: string;
    importCount?: number;
    usedByCount?: number;
    isEntry?: boolean;
    isCore?: boolean;
    isLeaf?: boolean;
    hasIssue?: boolean;
    folder?: string;
    badge?: 'Clean' | 'Complex' | 'Risky' | 'Core' | 'HotPath';
    badgeReason?: string;
  };
=======
  data: { label: string; filePath: string; role?: NodeRole };
>>>>>>> origin/main
  selected?: boolean;
}

const roleColors: Record<NodeRole, string> = {
  entry: '#3fb950',
  route: '#58a6ff',
  service: '#bc8cff',
  database: '#d29922',
  middleware: '#3fb950',
  component: '#58a6ff',
  utility: '#8b949e',
  config: '#8b949e',
  model: '#d29922',
  test: '#8b949e',
};

const roleIcons: Record<NodeRole, string> = {
  entry: '⚡',
  route: '🌐',
  service: '⚙️',
  database: '🗄️',
  middleware: '🛡️',
  component: '🧩',
  utility: '🔧',
  config: '📋',
  model: '📦',
  test: '🧪',
};

const CustomNode = memo(({ data, selected }: CustomNodeProps) => {
  const ext = getFileExtension(data.filePath);
  const color = getFileColor(data.filePath);
  const icon = getFileIcon(data.filePath);
  const fileName = data.filePath.split('/').pop() || data.filePath;
<<<<<<< HEAD
  const folder = data.folder || data.filePath.split('/').slice(0, -1).join('/') || '';

  // Node sizing based on importance
  const width = data.isEntry ? 196 : data.isCore ? 170 : data.isLeaf ? 130 : 150;

  // Border colors
  const borderColor = selected
    ? '#58a6ff'
    : data.isEntry
    ? '#d29922'
    : data.isCore
    ? '#388bfd'
    : data.isLeaf
    ? '#484f58'
    : '#30363d';

  const nodeStyle: React.CSSProperties = {
    background: selected ? '#1c2333' : '#161b22',
    border: `1px solid ${borderColor}`,
    borderLeft: `4px solid ${color}`,
    borderRadius: 8,
    padding: '7px 10px 7px 10px',
    width,
    minWidth: width,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    boxShadow: selected
      ? `0 0 0 2px ${borderColor}40, 0 4px 20px rgba(0,0,0,0.5)`
      : data.isEntry
      ? '0 0 12px rgba(210,153,34,0.2)'
      : data.isCore
      ? '0 0 10px rgba(56,139,253,0.15)'
      : '0 2px 8px rgba(0,0,0,0.3)',
  };

  const badgeEmoji = {
    'Clean': '🟢',
    'Complex': '🟡',
    'Risky': '🔴',
    'Core': '🔵',
    'HotPath': '⚡',
  }[data.badge || 'Clean'] || '🟢';

  return (
    <div style={nodeStyle} title={data.filePath} className="group/node relative">
      {/* Code Quality Badge */}
      {data.badge && (
        <div 
          className="absolute -top-3 -right-3 z-50 text-[11px] leading-none bg-[#161b22] border border-[#30363d] rounded-full p-1.5 shadow-lg cursor-help group/badge transition-transform hover:scale-110"
        >
          {badgeEmoji}
          
          {/* Custom tooltip to avoid standard title delay */}
          <div className="absolute opacity-0 pointer-events-none group-hover/badge:opacity-100 -right-2 top-full mt-2 w-48 p-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg shadow-xl shadow-black/50 transition-opacity text-[#c9d1d9] text-[10px] font-sans break-words whitespace-normal z-[100]">
            <span className="font-bold text-[#e6edf3] uppercase text-[9px] mb-1 block tracking-wider">{data.badge}</span>
            <span className="leading-relaxed">{data.badgeReason}</span>
          </div>
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#484f58', width: 6, height: 6, border: 'none' }}
      />

      {/* Top row: type badge + folder + warning */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'monospace',
            padding: '1px 5px',
            borderRadius: 3,
            background: `${color}22`,
            color,
            border: `1px solid ${color}44`,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          {ext || 'file'}
        </span>

        {folder && (
          <span style={{ fontSize: 9, color: '#484f58', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {folder.split('/').length > 2
              ? `…/${folder.split('/').slice(-2).join('/')}`
              : folder}
          </span>
        )}

        {(data.isEntry || data.hasIssue) && (
          <span style={{ fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>
            {data.isEntry ? '⭐' : '⚠️'}
          </span>
        )}
      </div>

      {/* Filename */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: selected ? '#ffffff' : '#e6edf3',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
=======
  const role = data.role || 'utility';
  const rc = roleColors[role];

  return (
    <div
      className={`relative rounded-lg border px-3 py-2 min-w-[160px] max-w-[220px] transition-all duration-200 cursor-pointer ${
        selected ? 'animate-pulse-glow' : ''
      }`}
      style={{
        background: selected ? '#1c2333' : '#161b22',
        borderColor: selected ? '#58a6ff' : '#30363d',
        borderLeftWidth: 4,
        borderLeftColor: rc,
      }}
      title={`${data.filePath} (${role})`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2 !border-0" />

      <div className="flex items-center gap-2">
        <span className="text-sm">{roleIcons[role]}</span>
        <span className="text-xs font-medium truncate" style={{ color: '#e6edf3' }}>
>>>>>>> origin/main
          {fileName}
        </span>
      </div>

<<<<<<< HEAD
      {/* Bottom row: import/used-by counts */}
      {((data.importCount !== undefined) || (data.usedByCount !== undefined)) && (
        <div style={{ display: 'flex', gap: 8, fontSize: 9, color: '#6e7681', fontFamily: 'monospace' }}>
          {data.importCount !== undefined && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ color: '#58a6ff' }}>↙</span>
              {data.importCount} imports
            </span>
          )}
          {data.usedByCount !== undefined && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ color: '#3fb950' }}>↗</span>
              {data.usedByCount} used by
            </span>
          )}
        </div>
      )}
=======
      <div className="flex items-center justify-between mt-0.5">
        {ext && (
          <span
            className="text-[10px] font-mono px-1 rounded"
            style={{ background: '#21262d', color }}
          >
            .{ext}
          </span>
        )}
        <span className="text-[9px] font-medium px-1 rounded" style={{ color: rc, opacity: 0.8 }}>
          {role}
        </span>
      </div>
>>>>>>> origin/main

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#484f58', width: 6, height: 6, border: 'none' }}
      />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
export default CustomNode;
