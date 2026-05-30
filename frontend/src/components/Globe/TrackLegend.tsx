import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { useTranslation } from '../../i18n/useTranslation';

// Glyph colours intentionally mirror what CesiumViewer actually draws:
//  - object position  → white accent (active silhouette/point)
//  - predicted track  → faded cyan polyline
//  - ground track     → dashed faded orange polyline
//  - ground station   → blue-violet point
const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span
    style={{
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 5px ${color}99`,
      border: '1px solid rgba(0,0,0,0.45)',
      flexShrink: 0,
    }}
  />
);

const LineGlyph: React.FC<{ color: string; dashed?: boolean }> = ({ color, dashed }) => (
  <span
    style={{
      width: 16,
      height: 0,
      borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
      flexShrink: 0,
    }}
  />
);

/**
 * Track overlay legend — a small, collapsible key for the globe's track
 * visualisation. Only shown once an object is being tracked, so it stays
 * unobtrusive during the global environment view.
 */
export const TrackLegend: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const activeObject = useConsoleStore((s) => s.activeObject);
  const showOrbitPath = useConsoleStore((s) => s.showOrbitPath);
  const showGroundTrack = useConsoleStore((s) => s.showGroundTrack);
  const showObserver = useConsoleStore((s) => s.showObserver);

  if (!activeObject) return null;

  const rows: { glyph: React.ReactNode; label: string }[] = [
    { glyph: <Dot color="#FFFFFF" />, label: t('legend.object_position') },
  ];
  if (showOrbitPath) rows.push({ glyph: <LineGlyph color="#5BE6E6" />, label: t('legend.predicted_track') });
  if (showGroundTrack) rows.push({ glyph: <LineGlyph color="#F5A833" dashed />, label: t('legend.ground_track') });
  if (showObserver) rows.push({ glyph: <Dot color="#7C5CFF" />, label: t('legend.ground_station') });

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        zIndex: 6,
        minWidth: 152,
        background: 'rgba(8, 18, 32, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        fontFamily: 'var(--font-ui)',
        userSelect: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 9px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {t('legend.title')}
        </span>
        <ChevronRight
          size={12}
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}
        />
      </button>

      {open && (
        <div style={{ padding: '2px 10px 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center' }}>{r.glyph}</span>
              <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrackLegend;
