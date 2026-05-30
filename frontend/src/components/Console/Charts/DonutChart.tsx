import React from 'react';

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  holeSize?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({ data, size = 100, holeSize = 60 }) => {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  if (total === 0) return <div>No data</div>;

  const center = size / 2;
  const radius = size / 2;

  let currentAngle = -90; // Start at top

  const createArc = (startAngle: number, endAngle: number) => {
    // Handling case where arc is 100% of circle
    if (endAngle - startAngle >= 359.9) {
      return `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center} ${center + radius} A ${radius} ${radius} 0 1 1 ${center} ${center - radius}`;
    }

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

    return [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {data.map((item, idx) => {
            const sliceAngle = (item.value / total) * 360;
            const path = createArc(currentAngle, currentAngle + sliceAngle);
            currentAngle += sliceAngle;
            
            return (
              <path 
                key={idx}
                d={path}
                fill={item.color}
              />
            );
          })}
          {/* Hole */}
          <circle cx={center} cy={center} r={holeSize / 2} fill="var(--bg-space-dark)" />
        </svg>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
        {data.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: item.color, borderRadius: '50%' }} />
            <span style={{ color: 'var(--text-bright)' }}>{item.label}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
              ({((item.value / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
