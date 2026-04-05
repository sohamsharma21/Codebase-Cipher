import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { getFileColor, getFileExtension, getFileIcon } from '@/lib/parser';
import type { NodeRole } from '@/types';

interface CustomNodeProps {
  data: { label: string; filePath: string; role?: NodeRole };
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
          {fileName}
        </span>
      </div>

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

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2 !border-0" />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
export default CustomNode;
