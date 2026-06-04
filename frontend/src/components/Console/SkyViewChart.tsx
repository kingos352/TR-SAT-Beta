import React from 'react';
import { DetailedPassProfilePoint } from '../../api/client';

interface SkyViewChartProps {
  profile: DetailedPassProfilePoint[];
  width?: number;
  height?: number;
  maxElevation: number;
}

export const SkyViewChart: React.FC<SkyViewChartProps> = ({ profile, width = 300, height = 300, maxElevation }) => {
  if (!profile || profile.length === 0) return null;

  const cx = width / 2;
  const cy = height / 2;
  const rMax = Math.min(cx, cy) - 20;

  // Convert (azimuth, elevation) to (x, y)
  // center is elev=90, edge is elev=0
  // azimuth N=0, E=90, S=180, W=270
  // in SVG, y goes down. 
  // angle = az - 90 deg.
  const getXY = (az: number, el: number) => {
    const elClamped = Math.max(0, Math.min(90, el));
    const r = rMax * ((90 - elClamped) / 90);
    const thetaRad = (az - 90) * (Math.PI / 180);
    const x = cx + r * Math.cos(thetaRad);
    const y = cy + r * Math.sin(thetaRad);
    return { x, y };
  };

  const pathPoints = profile.map(p => getXY(p.azimuth_deg, p.elevation_deg));
  const pathD = `M ${pathPoints.map(p => `${p.x},${p.y}`).join(' L ')}`;

  // Find the point with max elevation
  let maxPt = profile[0];
  for (const p of profile) {
    if (p.elevation_deg > maxPt.elevation_deg) maxPt = p;
  }
  const maxXY = getXY(maxPt.azimuth_deg, maxPt.elevation_deg);
  const aosXY = pathPoints[0];
  const losXY = pathPoints[pathPoints.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {/* Circles for 0, 30, 60 elevation */}
        <circle cx={cx} cy={cy} r={rMax} fill="none" stroke="#333" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={rMax * (60/90)} fill="none" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx={cx} cy={cy} r={rMax * (30/90)} fill="none" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />

        {/* Crosshairs */}
        <line x1={cx} y1={cy - rMax} x2={cx} y2={cy + rMax} stroke="#333" strokeWidth="1" />
        <line x1={cx - rMax} y1={cy} x2={cx + rMax} y2={cy} stroke="#333" strokeWidth="1" />

        {/* Labels */}
        <text x={cx} y={cy - rMax - 5} fill="#666" fontSize="10" textAnchor="middle">N</text>
        <text x={cx + rMax + 10} y={cy + 3} fill="#666" fontSize="10" textAnchor="middle">E</text>
        <text x={cx} y={cy + rMax + 12} fill="#666" fontSize="10" textAnchor="middle">S</text>
        <text x={cx - rMax - 10} y={cy + 3} fill="#666" fontSize="10" textAnchor="middle">W</text>

        {/* Pass Path */}
        <path d={pathD} fill="none" stroke="#00d8ff" strokeWidth="2" opacity="0.8" />

        {/* Markers */}
        <circle cx={aosXY.x} cy={aosXY.y} r={4} fill="#4caf50" />
        <circle cx={losXY.x} cy={losXY.y} r={4} fill="#f44336" />
        <circle cx={maxXY.x} cy={maxXY.y} r={4} fill="#ffeb3b" />
        <text x={maxXY.x + 8} y={maxXY.y - 8} fill="#ffeb3b" fontSize="10" fontWeight="bold">
          MAX ({maxElevation.toFixed(0)}°)
        </text>
      </svg>
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px', fontSize: '10px', color: '#888' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, background: '#4caf50', borderRadius: '50%' }}></div> AOS</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, background: '#ffeb3b', borderRadius: '50%' }}></div> MAX</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, background: '#f44336', borderRadius: '50%' }}></div> LOS</span>
      </div>
    </div>
  );
};
