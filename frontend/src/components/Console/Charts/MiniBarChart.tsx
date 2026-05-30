import React from 'react';

interface MiniBarChartProps {
  data: { label: string; value: number }[];
  color?: string;
}

export const MiniBarChart: React.FC<MiniBarChartProps> = ({ data, color = 'var(--accent-cyan)' }) => {
  if (!data || data.length === 0) return <div>No data</div>;

  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', fontSize: '11px' }}>
      {data.map((item, idx) => {
        const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
              {item.label}
            </div>
            <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${percentage}%`, 
                  height: '100%', 
                  backgroundColor: color,
                  transition: 'width 0.3s ease-in-out'
                }} 
              />
            </div>
            <div style={{ width: '30px', textAlign: 'right', color: 'var(--text-muted)' }}>
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};
