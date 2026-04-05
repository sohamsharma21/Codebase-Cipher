import { getSmoothStepPath, EdgeProps, BaseEdge } from '@xyflow/react';

export const SmartEdge = ({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style = {}, markerEnd, id, data
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const animatedStyle = data?.animated ? { ...style, strokeDasharray: '4,4', animation: 'flow 1s linear infinite' } : style;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={animatedStyle} id={id} />
      {data?.label && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect x="-30" y="-10" width="60" height="20" fill="#0d1117" rx="4" stroke={style?.stroke || '#30363d'} />
          <text x="0" y="4" fontSize="10" fill={style?.stroke || '#c9d1d9'} textAnchor="middle" fontWeight="bold">
            {data.label as string}
          </text>
        </g>
      )}
      <style>{`
        @keyframes flow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -8; }
        }
      `}</style>
    </>
  );
};
