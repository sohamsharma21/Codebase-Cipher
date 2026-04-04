import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FolderOpen, Folder } from 'lucide-react';

interface ClusterNodeProps {
  data: {
    label: string;
    fileCount: number;
    clusterId: string;
    isExpanded: boolean;
  };
  selected?: boolean;
}

const ClusterNode = memo(({ data, selected }: ClusterNodeProps) => {
  return (
    <div
      className={`relative rounded-lg border px-4 py-3 min-w-[160px] max-w-[200px] transition-all duration-300 cursor-pointer group
        ${selected ? 'border-primary bg-primary/10' : 'border-border/60 bg-card/80 hover:bg-card hover:border-border'}
      `}
      style={{
        backdropFilter: 'blur(8px)',
      }}
      title={`${data.label} — ${data.fileCount} files (click to expand)`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2 !border-0" />

      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
          {data.isExpanded
            ? <FolderOpen className="w-3.5 h-3.5 text-primary" />
            : <Folder className="w-3.5 h-3.5 text-primary" />
          }
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground truncate">{data.label}</div>
          <div className="text-[10px] text-muted-foreground">{data.fileCount} files</div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2 !border-0" />
    </div>
  );
});

ClusterNode.displayName = 'ClusterNode';
export default ClusterNode;
