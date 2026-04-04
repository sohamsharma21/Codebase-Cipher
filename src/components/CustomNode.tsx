import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { getFileColor, getFileExtension, getFileIcon } from '@/lib/parser';

interface CustomNodeProps {
  data: { label: string; filePath: string };
  selected?: boolean;
}

const CustomNode = memo(({ data, selected }: CustomNodeProps) => {
  const ext = getFileExtension(data.filePath);
  const color = getFileColor(data.filePath);
  const icon = getFileIcon(data.filePath);
  const fileName = data.filePath.split('/').pop() || data.filePath;

  return (
    <div
      className={`relative rounded-lg border px-3 py-2 min-w-[160px] max-w-[220px] transition-all duration-200 cursor-pointer ${
        selected ? 'animate-pulse-glow' : ''
      }`}
      style={{
        background: selected ? '#1c2333' : '#161b22',
        borderColor: selected ? '#58a6ff' : '#30363d',
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
      title={data.filePath}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2 !border-0" />

      <div className="flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-medium truncate" style={{ color: '#e6edf3' }}>
          {fileName}
        </span>
      </div>

      {ext && (
        <span
          className="absolute bottom-1 right-2 text-[10px] font-mono px-1 rounded"
          style={{ background: '#21262d', color }}
        >
          .{ext}
        </span>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2 !border-0" />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
export default CustomNode;
