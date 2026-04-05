import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const BaseNode = ({ data, selected, width, height, borderColor, children }: any) => {
  return (
    <div 
      className="group/node relative transition-all duration-300"
      title={data.filePath}
      style={{
        width, minHeight: height,
        background: selected ? '#1c2333' : '#161b22',
        border: `1px solid ${selected ? '#58a6ff' : borderColor}`,
        borderLeft: `4px solid ${data.color || borderColor}`,
        borderRadius: 8, padding: 12,
        boxShadow: selected ? `0 0 0 2px ${borderColor}40, 0 4px 20px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#484f58', width: 6, height: 6, border: 'none' }} />
      {/* Code Quality Badge Support */}
      {data.badge && (
        <div className="absolute -top-3 -right-3 z-50 text-[11px] leading-none bg-[#161b22] border border-[#30363d] rounded-full p-1.5 shadow-lg">
          {{'Clean': '🟢', 'Complex': '🟡', 'Risky': '🔴', 'Core': '🔵', 'HotPath': '⚡'}[data.badge as string] || '🟢'}
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#30363d]/50">
        <span className="text-[13px]">{data.icon}</span>
        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: data.color }}>
          {data.label}
        </span>
      </div>

      <div className="text-[12px] font-bold text-white mb-2 overflow-hidden text-ellipsis whitespace-nowrap">
        {data.filePath?.split('/').pop() || data.filePath}
      </div>

      {children}

      <Handle type="source" position={Position.Bottom} style={{ background: '#484f58', width: 6, height: 6, border: 'none' }} />
    </div>
  );
};

export const WorkflowNode = memo(({ data, selected }: any) => {
  const isEntryPoint = data.entityType === 'ENTRY_POINT';
  const isDB = data.entityType === 'DATABASE';
  
  if (isEntryPoint) {
    return (
      <BaseNode data={data} selected={selected} width={220} height={100} borderColor="#d29922">
        <div className="text-[10px] text-[#8b949e] font-mono leading-relaxed mt-2">
          {data.filePath}<br/>
          {data.summary || 'Initializes application'}
        </div>
      </BaseNode>
    );
  }

  if (isDB) {
    return (
      <BaseNode data={data} selected={selected} width={240} height={120} borderColor="#f85149">
        <div className="text-[10px] text-[#8b949e] font-mono">
          <div className="text-[#c9d1d9] mb-1 font-sans font-semibold">Detected Operations</div>
          <div className="max-h-[60px] overflow-y-auto pr-1">
            {data.dbOps?.map((op: any, i: number) => (
              <div key={i} className="truncate">» {op.op}: {op.label}</div>
            )) || 'No specific ops detected'}
          </div>
        </div>
      </BaseNode>
    );
  }

  if (data.entityType === 'API_ROUTE') {
    return (
      <BaseNode data={data} selected={selected} width={200} height={90} borderColor="#58a6ff">
         {data.routes?.map((r: any, i: number) => {
           if (i > 1) return null; // show max 2
           return (
             <div key={i} className="flex gap-1.5 items-center mb-1 text-[9px] font-mono whitespace-nowrap overflow-hidden">
               <span className="bg-[#58a6ff]/20 text-[#58a6ff] px-1 py-0.5 rounded">{r.method}</span>
               <span className="text-[#c9d1d9] truncate">{r.path}</span>
             </div>
           );
         })}
         {data.routes?.length > 2 && <div className="text-[9px] text-[#8b949e]">+{data.routes.length - 2} more</div>}
      </BaseNode>
    );
  }

  // Generic render for Middleware, Controllers, Models, Components, Configs
  return (
    <BaseNode data={data} selected={selected} width={180} height={80} borderColor={data.color || '#30363d'}>
      <div className="text-[10px] text-[#8b949e] font-mono truncate">
        {data.summary ? data.summary : `${data.importsCount || 0} imports`}
      </div>
    </BaseNode>
  );
});
WorkflowNode.displayName = 'WorkflowNode';

export const LaneNode = memo(({ data }: any) => {
  return (
    <div style={{
      width: 4000,
      height: data.height,
      backgroundColor: data.color,
      borderTop: `1px dashed ${data.borderColor}`,
      borderBottom: `1px dashed ${data.borderColor}`,
      pointerEvents: 'none',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        left: 20,
        top: 20,
        color: data.borderColor.replace('0.3', '0.8'),
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.1em'
      }}>
        {data.label}
      </div>
    </div>
  );
});
LaneNode.displayName = 'LaneNode';
