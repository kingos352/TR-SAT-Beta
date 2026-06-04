import React from 'react';
import { DetailedPassProfilePoint } from '../../api/client';

interface ElevationProfileChartProps {
  profile: DetailedPassProfilePoint[];
  width?: number;
  height?: number;
  minElevationThreshold: number;
}

export const ElevationProfileChart: React.FC<ElevationProfileChartProps> = ({ profile, width = 400, height = 200, minElevationThreshold }) => {
  if (!profile || profile.length === 0) return null;

  const padding = { top: 20, right: 30, bottom: 30, left: 40 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // X axis: time, Y axis: elevation (0 to 90)
  const tStart = new Date(profile[0].timestamp_utc).getTime();
  const tEnd = new Date(profile[profile.length - 1].timestamp_utc).getTime();
  const tSpan = Math.max(1, tEnd - tStart);

  const getX = (timestamp: string) => {
    const t = new Date(timestamp).getTime();
    return padding.left + ((t - tStart) / tSpan) * graphWidth;
  };

  const getY = (elev: number) => {
    const clamped = Math.max(0, Math.min(90, elev));
    return padding.top + graphHeight - (clamped / 90) * graphHeight;
  };

  const pathD = `M ${profile.map(p => `${getX(p.timestamp_utc)},${getY(p.elevation_deg)}`).join(' L ')}`;

  // Find max pt
  let maxPt = profile[0];
  for (const p of profile) {
    if (p.elevation_deg > maxPt.elevation_deg) maxPt = p;
  }
  const maxXY = { x: getX(maxPt.timestamp_utc), y: getY(maxPt.elevation_deg) };

  // Threshold line
  const threshY = getY(minElevationThreshold);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + graphHeight} stroke="#333" strokeWidth="1" />
        <line x1={padding.left} y1={padding.top + graphHeight} x2={padding.left + graphWidth} y2={padding.top + graphHeight} stroke="#333" strokeWidth="1" />

        {/* Y Axis Labels (0, 30, 60, 90) */}
        {[0, 30, 60, 90].map(val => (
          <g key={val}>
            <text x={padding.left - 5} y={getY(val) + 4} fill="#666" fontSize="10" textAnchor="end">{val}°</text>
            <line x1={padding.left} y1={getY(val)} x2={padding.left + graphWidth} y2={getY(val)} stroke="#222" strokeWidth="1" strokeDasharray="2 2" />
          </g>
        ))}

        {/* Threshold Line */}
        <line x1={padding.left} y1={threshY} x2={padding.left + graphWidth} y2={threshY} stroke="#f44336" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
        <text x={padding.left + graphWidth - 5} y={threshY - 5} fill="#f44336" fontSize="9" textAnchor="end" opacity="0.8">Horizon ({minElevationThreshold}°)</text>

        {/* X Axis Labels (AOS, LOS) */}
        <text x={padding.left} y={padding.top + graphHeight + 15} fill="#888" fontSize="10" textAnchor="middle">
          {new Date(profile[0].timestamp_utc).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
        </text>
        <text x={padding.left + graphWidth} y={padding.top + graphHeight + 15} fill="#888" fontSize="10" textAnchor="middle">
          {new Date(profile[profile.length - 1].timestamp_utc).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
        </text>

        {/* Line */}
        <path d={pathD} fill="none" stroke="#00d8ff" strokeWidth="2" />

        {/* Fill under line */}
        <path d={`${pathD} L ${padding.left + graphWidth},${padding.top + graphHeight} L ${padding.left},${padding.top + graphHeight} Z`} fill="rgba(0, 216, 255, 0.1)" stroke="none" />

        {/* Max point */}
        <circle cx={maxXY.x} cy={maxXY.y} r={4} fill="#ffeb3b" />
        <text x={maxXY.x} y={maxXY.y - 10} fill="#ffeb3b" fontSize="10" fontWeight="bold" textAnchor="middle">
          {maxPt.elevation_deg.toFixed(1)}°
        </text>
      </svg>
    </div>
  );
};
