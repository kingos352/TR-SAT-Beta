import React from 'react';

interface Point {
  x: number;
  y: number;
}

interface LineChartProps {
  data: Point[];
  width: number;
  height: number;
  color?: string;
  yLabel?: string;
  xLabel?: string;
}

export const LineChart: React.FC<LineChartProps> = ({ data, width, height, color = '#38bdf8', yLabel, xLabel }) => {
  if (!data || data.length === 0) return <div style={{ fontSize: '12px', color: '#888' }}>No data available for chart</div>;

  const minX = Math.min(...data.map(d => d.x));
  const maxX = Math.max(...data.map(d => d.x));
  const minY = Math.min(...data.map(d => d.y));
  const maxY = Math.max(...data.map(d => d.y));

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const getX = (x: number) => padding + ((x - minX) / (maxX - minX || 1)) * chartWidth;
  const getY = (y: number) => height - padding - ((y - minY) / (maxY - minY || 1)) * chartHeight;

  const points = data.map(d => `${getX(d.x)},${getY(d.y)}`).join(' ');

  return (
    <svg width={width} height={height} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
      {/* Axes */}
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#555" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#555" />
      {/* Labels */}
      {yLabel && <text x={10} y={height / 2} fill="#888" fontSize="10" transform={`rotate(-90 10 ${height / 2})`}>{yLabel}</text>}
      {xLabel && <text x={width / 2} y={height - 10} fill="#888" fontSize="10" textAnchor="middle">{xLabel}</text>}
      {/* Min/Max Y */}
      <text x={padding - 5} y={padding + 5} fill="#888" fontSize="10" textAnchor="end">{maxY.toFixed(1)}</text>
      <text x={padding - 5} y={height - padding} fill="#888" fontSize="10" textAnchor="end">{minY.toFixed(1)}</text>
    </svg>
  );
};
