import React from 'react';

interface SkeletonLineProps {
  width?: string;
  height?: string;
  style?: React.CSSProperties;
}

export const SkeletonLine: React.FC<SkeletonLineProps> = ({
  width = '100%',
  height = '12px',
  style
}) => (
  <div style={{
    width,
    height,
    borderRadius: '2px',
    background: 'linear-gradient(90deg, rgba(59,130,246,0.08) 25%, rgba(59,130,246,0.18) 50%, rgba(59,130,246,0.08) 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-shimmer 1.5s infinite',
    ...style
  }} />
);

export const SkeletonBlock: React.FC<{ rows?: number; gap?: string }> = ({
  rows = 3,
  gap = '10px'
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap }}>
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonLine
        key={i}
        width={i === rows - 1 ? '65%' : '100%'}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div style={{
    background: 'rgba(11, 25, 44, 0.6)',
    border: '1px solid rgba(59, 130, 246, 0.15)',
    borderRadius: '4px',
    padding: '12px',
  }}>
    <SkeletonBlock rows={rows} />
  </div>
);
