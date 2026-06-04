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

  let minX = Math.min(...data.map(d => d.x));
  let maxX = Math.max(...data.map(d => d.x));
  let minY = Math.min(...data.map(d => d.y));
  let maxY = Math.max(...data.map(d => d.y));

  // Handle flat-line cases where all values are identical
  if (minY === maxY) {
    if (minY === 0) {
      minY = -1;
      maxY = 1;
    } else {
      const margin = Math.abs(minY) * 0.1;
      minY = minY - margin;
      maxY = maxY + margin;
    }
  }

  if (minX === maxX) {
    minX = minX - 1;
    maxX = maxX + 1;
  }

  const padding = 45;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const getX = (x: number) => padding + ((x - minX) / (maxX - minX)) * chartWidth;
  const getY = (y: number) => height - padding - ((y - minY) / (maxY - minY)) * chartHeight;

  const points = data.map(d => `${getX(d.x)},${getY(d.y)}`).join(' ');

  // Format Y axis labels dynamically based on value differences
  const formatYValue = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal === 0) return '0';
    if (absVal < 1e-5) return val.toExponential(3);
    
    const diff = maxY - minY;
    let precision = 1;
    if (diff > 0) {
      const log10 = Math.log10(diff);
      if (log10 < 0) {
        precision = Math.min(8, Math.max(1, Math.ceil(Math.abs(log10)) + 1));
      }
    }
    return val.toFixed(precision);
  };

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
      {yLabel && <text x={12} y={height / 2} fill="#888" fontSize="10" transform={`rotate(-90 12 ${height / 2})`} textAnchor="middle">{yLabel}</text>}
      {xLabel && <text x={width / 2} y={height - 8} fill="#888" fontSize="10" textAnchor="middle">{xLabel}</text>}
      {/* Min/Max Y */}
      <text x={padding - 5} y={padding + 5} fill="#888" fontSize="10" textAnchor="end">{formatYValue(maxY)}</text>
      <text x={padding - 5} y={height - padding} fill="#888" fontSize="10" textAnchor="end">{formatYValue(minY)}</text>
    </svg>
  );
};
