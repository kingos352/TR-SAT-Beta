import React from 'react';

interface HistogramChartProps {
  data: { label: string; count: number }[];
  height?: number;
  color?: string;
}

export const HistogramChart: React.FC<HistogramChartProps> = ({ data, height = 80, color = 'var(--accent-orange)' }) => {
  if (!data || data.length === 0) return <div>No data</div>;

  const maxCount = Math.max(...data.map(d => d.count));
  
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: height, gap: '2px', width: '100%', paddingBottom: '20px', position: 'relative' }}>
      {data.map((item, idx) => {
        const hPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        
        return (
          <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative' }}>
            {/* Tooltip on hover (simple absolute position for now) */}
            <div 
              style={{
                height: `${hPct}%`,
                width: '100%',
                backgroundColor: color,
                opacity: 0.8,
                transition: 'height 0.3s ease',
                borderTopLeftRadius: '2px',
                borderTopRightRadius: '2px',
              }}
              title={`${item.label}: ${item.count}`}
            />
            {/* Label below */}
            <div style={{ 
              position: 'absolute', 
              bottom: '-18px', 
              fontSize: '9px', 
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              transform: 'scale(0.9)',
              textAlign: 'center',
              width: '100%'
            }}>
              {item.label.split(' ')[0]} {/* Abbreviate if needed */}
            </div>
          </div>
        );
      })}
    </div>
  );
};
