import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useConsoleStore } from '../../store/useConsoleStore';
import { SkyViewChart } from './SkyViewChart';
import { ElevationProfileChart } from './ElevationProfileChart';
import { useTranslation } from '../../i18n/useTranslation';

const PassTimelinePanelInner: React.FC = () => {
  const activeObject = useConsoleStore(s => s.activeObject);
  const detailedPasses = useConsoleStore(s => s.detailedPasses);
  const selectedDetailedPass = useConsoleStore(s => s.selectedDetailedPass);
  const isComputingDetailedPasses = useConsoleStore(s => s.isComputingDetailedPasses);
  const setSelectedDetailedPass = useConsoleStore(s => s.setSelectedDetailedPass);
  const fetchDetailedPasses = useConsoleStore(s => s.fetchDetailedPasses);
  const { t } = useTranslation();
  const [horizonHours, setHorizonHours] = useState(24);
  const [minElev, setMinElev] = useState(10);

  // Drag state
  const [modalPos, setModalPos] = useState({ x: window.innerWidth / 2 - 360, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setModalPos({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y
        });
      }
    };
    const handleGlobalMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - modalPos.x,
      y: e.clientY - modalPos.y
    };
  };

  const handleCompute = () => {
    const startUtc = new Date().toISOString();
    const endUtc = new Date(Date.now() + horizonHours * 3600 * 1000).toISOString();
    fetchDetailedPasses(startUtc, endUtc, minElev, 30);
  };

  const getQualityColor = (quality: string) => {
    switch(quality) {
      case 'OVERHEAD': return '#9c27b0';
      case 'EXCELLENT': return '#4caf50';
      case 'GOOD': return '#ffeb3b';
      case 'LOW': return '#f44336';
      default: return '#888';
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (!activeObject) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        <p>{t('pass_timeline.select_object')}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '11px' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 8px' }}>
        {t('pass_timeline.warning')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('pass_timeline.horizon')}</label>
          <select 
            value={horizonHours} 
            onChange={e => setHorizonHours(Number(e.target.value))}
            style={{
              width: '100%', padding: '6px', borderRadius: '6px',
              backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
              color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
            }}
          >
            <option value={6}>6 Hours</option>
            <option value={24}>24 Hours</option>
            <option value={72}>3 Days</option>
            <option value={168}>7 Days</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('pass_timeline.min_elev')}</label>
          <select 
            value={minElev} 
            onChange={e => setMinElev(Number(e.target.value))}
            style={{
              width: '100%', padding: '6px', borderRadius: '6px',
              backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
              color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
            }}
          >
            <option value={5}>5°</option>
            <option value={10}>10°</option>
            <option value={20}>20°</option>
            <option value={30}>30°</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={handleCompute} 
          disabled={isComputingDetailedPasses}
          style={{ 
            flex: 1,
            background: isComputingDetailedPasses ? 'rgba(75, 85, 99, 0.5)' : 'var(--accent-blue)', 
            color: 'var(--text-bright)', 
            border: 'none', 
            padding: '8px', 
            cursor: isComputingDetailedPasses ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '11px',
            borderRadius: '6px'
          }}
        >
          {isComputingDetailedPasses ? t('pass_timeline.computing') : t('pass_timeline.compute')}
        </button>
        
        {detailedPasses.length > 0 && (
          <button
            onClick={async () => {
              const { exportDetailedPassesCSV } = await import('../../utils/exportSystem');
              exportDetailedPassesCSV(detailedPasses, activeObject.norad_id);
            }}
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-bright)',
              border: '1px solid var(--border-color)',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '11px',
              borderRadius: '6px'
            }}
          >
            {t('pass_timeline.export')}
          </button>
        )}
      </div>

      {detailedPasses.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h3 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
            {t('pass_timeline.passes')} ({detailedPasses.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
            {detailedPasses.map((pass, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedDetailedPass(pass)}
                style={{
                  background: selectedDetailedPass === pass ? 'rgba(14, 165, 233, 0.1)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid',
                  borderColor: selectedDetailedPass === pass ? 'var(--accent-cyan)' : 'rgba(75, 85, 99, 0.3)',
                  padding: '8px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--text-bright)' }}>
                    {new Date(pass.aos_time_utc).toLocaleDateString()}
                  </span>
                  <span style={{ 
                    background: getQualityColor(pass.quality_label), 
                    color: pass.quality_label === 'GOOD' || pass.quality_label === 'LOW' ? '#000' : '#fff', 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    fontSize: '9px', 
                    fontWeight: 'bold' 
                  }}>
                    {pass.quality_label}
                  </span>
                </div>
                <div className="mono-text" style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('pass_timeline.rise')} {formatTime(pass.aos_time_utc)}</span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{t('pass_timeline.max')} {pass.max_elevation_deg.toFixed(1)}°</span>
                </div>
                <div className="mono-text" style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('pass_timeline.dur')} {Math.round(pass.duration_seconds / 60)}m {Math.round(pass.duration_seconds % 60)}s</span>
                  <span>{t('pass_timeline.r')} {pass.range_at_max_km?.toFixed(0)} km</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Pass Details & Charts Modal popup */}
      {selectedDetailedPass && createPortal(
        <div style={{
          position: 'fixed',
          top: `${modalPos.y}px`,
          left: `${modalPos.x}px`,
          width: '800px',
          height: 'auto',
          background: 'rgba(11, 20, 35, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(14, 165, 233, 0.4)',
          borderRadius: '16px',
          zIndex: 9999,
          padding: '24px',
          boxShadow: '0 30px 60px -12px rgba(0,0,0,1), 0 0 30px rgba(14, 165, 233, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          animation: 'fadeInScale 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
        }}>
          <style>{`
            @keyframes fadeInScale {
              from { opacity: 0; transform: scale(0.95) translateY(10px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
          <div 
            onMouseDown={handleHeaderMouseDown}
            style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px',
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
          >
            <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>
              {t('pass_timeline.detailed_profile')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({new Date(selectedDetailedPass.aos_time_utc).toLocaleDateString()})</span>
            </h3>
            <button 
              onClick={() => setSelectedDetailedPass(null)} 
              style={{ 
                background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: 'none', 
                cursor: 'pointer', fontSize: '20px', width: '32px', height: '32px', 
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                transition: 'all 0.2s ease', outline: 'none', lineHeight: 1
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--text-bright)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.transform = 'scale(1)'; }}
              title="Close"
            >
              &times;
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 500 }}>{t('pass_timeline.rise_az')}</div>
              <div className="mono-text" style={{ fontSize: '18px', color: 'var(--accent-green)', fontWeight: 'bold', textShadow: '0 0 10px rgba(16, 185, 129, 0.4)' }}>{selectedDetailedPass.azimuth_aos_deg?.toFixed(1)}°</div>
            </div>
            <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 500 }}>{t('pass_timeline.max_az')}</div>
              <div className="mono-text" style={{ fontSize: '18px', color: 'var(--accent-orange)', fontWeight: 'bold', textShadow: '0 0 10px rgba(245, 158, 11, 0.4)' }}>{selectedDetailedPass.azimuth_max_deg?.toFixed(1)}°</div>
            </div>
            <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 500 }}>{t('pass_timeline.set_az')}</div>
              <div className="mono-text" style={{ fontSize: '18px', color: 'var(--accent-red)', fontWeight: 'bold', textShadow: '0 0 10px rgba(239, 68, 68, 0.4)' }}>{selectedDetailedPass.azimuth_los_deg?.toFixed(1)}°</div>
            </div>
            <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 500 }}>{t('pass_timeline.max_el')}</div>
              <div className="mono-text" style={{ fontSize: '18px', color: 'var(--accent-cyan)', fontWeight: 'bold', textShadow: '0 0 10px rgba(14, 165, 233, 0.5)' }}>{selectedDetailedPass.max_elevation_deg?.toFixed(1)}°</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexGrow: 1, alignItems: 'stretch' }}>
            <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: 'var(--text-bright)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '8px', opacity: 0.8, textTransform: 'uppercase' }}>
                {t('pass_timeline.polar_sky_view')}
              </div>
              <SkyViewChart 
                profile={selectedDetailedPass.elevation_profile} 
                maxElevation={selectedDetailedPass.max_elevation_deg} 
                width={240} 
                height={240} 
              />
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
              <div style={{ color: 'var(--text-bright)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '8px', opacity: 0.8, textTransform: 'uppercase' }}>
                {t('pass_timeline.elevation_profile')}
              </div>
              <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', width: '100%' }}>
                <ElevationProfileChart 
                  profile={selectedDetailedPass.elevation_profile} 
                  minElevationThreshold={minElev} 
                  width={420} 
                  height={240} 
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export const PassTimelinePanel = React.memo(PassTimelinePanelInner);
