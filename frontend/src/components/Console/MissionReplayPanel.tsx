import React, { useState, useEffect, useRef } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { useTranslation } from '../../i18n/useTranslation';

const MissionReplayPanelInner: React.FC = () => {
  const activeObject = useConsoleStore(s => s.activeObject);
  const replayEnabled = useConsoleStore(s => s.replayEnabled);
  const replayPlaying = useConsoleStore(s => s.replayPlaying);
  const replayEphemeris = useConsoleStore(s => s.replayEphemeris);
  const replayCurrentUtc = useConsoleStore(s => s.replayCurrentUtc);
  const replaySpeed = useConsoleStore(s => s.replaySpeed);
  const replayIndex = useConsoleStore(s => s.replayIndex);
  const replayMode = useConsoleStore(s => s.replayMode);
  const replayError = useConsoleStore(s => s.replayError);
  const setReplayPlaying = useConsoleStore(s => s.setReplayPlaying);
  const setReplaySpeed = useConsoleStore(s => s.setReplaySpeed);
  const setReplayIndex = useConsoleStore(s => s.setReplayIndex);
  const setReplayCurrentUtc = useConsoleStore(s => s.setReplayCurrentUtc);
  const requestReplayEphemeris = useConsoleStore(s => s.requestReplayEphemeris);
  const { t } = useTranslation();

  const [followReplayObject, setFollowReplayObject] = useState(false);
  const [durationWindow, setDurationWindow] = useState<'90m' | '6h' | '24h'>('90m');
  const [stepSeconds, setStepSeconds] = useState<10 | 30 | 60>(60);
  const playIntervalRef = useRef<number | null>(null);

  const handleGenerate = () => {
    if (!activeObject) return;
    
    const now = new Date();
    const start = now.toISOString();
    let endMs = now.getTime();
    
    if (durationWindow === '90m') endMs += 90 * 60 * 1000;
    else if (durationWindow === '6h') endMs += 6 * 60 * 60 * 1000;
    else if (durationWindow === '24h') endMs += 24 * 60 * 60 * 1000;
    
    const end = new Date(endMs).toISOString();
    
    requestReplayEphemeris(activeObject.norad_id, start, end, stepSeconds);
  };

  const togglePlay = () => {
    if (replayMode === 'ERROR' || replayEphemeris.length === 0) return;
    if (replayIndex >= replayEphemeris.length - 1) {
      setReplayIndex(0);
    }
    setReplayPlaying(!replayPlaying);
  };

  const handleStop = () => {
    setReplayPlaying(false);
    setReplayIndex(0);
    if (replayEphemeris.length > 0) {
      setReplayCurrentUtc(replayEphemeris[0].timestamp_utc);
    }
  };

  useEffect(() => {
    if (replayPlaying && replayEphemeris.length > 0) {
      playIntervalRef.current = window.setInterval(() => {
        setReplayIndex(useConsoleStore.getState().replayIndex + 1);
      }, 1000 / replaySpeed); // Adjust based on speed, e.g., 60x speed = 1 frame per 16ms approx (if speed is multiplier)
      // Actually, if we just want to advance index every interval:
      // Let's do a fixed interval and advance by some amount.
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [replayPlaying, replaySpeed, replayEphemeris]);

  useEffect(() => {
    if (replayIndex >= replayEphemeris.length - 1 && replayPlaying) {
      setReplayPlaying(false);
    }
    if (replayEphemeris[replayIndex]) {
      setReplayCurrentUtc(replayEphemeris[replayIndex].timestamp_utc);
    }
  }, [replayIndex, replayEphemeris, replayPlaying]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {!activeObject ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '10px', textAlign: 'center', padding: '10px 0' }}>
          {t('mission_replay.select_object')}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('mission_replay.window')}</label>
              <select
                value={durationWindow}
                onChange={(e) => setDurationWindow(e.target.value as '90m' | '6h' | '24h')}
                style={{
                  width: '100%', padding: '6px', borderRadius: '6px',
                  backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
                  color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
                }}
              >
                <option value="90m">90 Minutes</option>
                <option value="6h">6 Hours</option>
                <option value="24h">24 Hours</option>
              </select>
            </div>
            
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('mission_replay.step')}</label>
              <select
                value={stepSeconds}
                onChange={(e) => setStepSeconds(parseInt(e.target.value) as 10 | 30 | 60)}
                style={{
                  width: '100%', padding: '6px', borderRadius: '6px',
                  backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
                  color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
                }}
              >
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            </div>
          </div>

          <button 
            onClick={handleGenerate}
            style={{
              padding: '8px', borderRadius: '6px', border: 'none',
              backgroundColor: 'var(--accent-blue)', color: 'var(--text-bright)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer', width: '100%'
            }}
          >
            {t('mission_replay.generate')}
          </button>
          
          {replayError && <div style={{ color: 'var(--status-error)', fontSize: '11px' }}>{replayError}</div>}
          
          {replayEnabled && replayEphemeris.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', borderTop: '1px solid rgba(75, 85, 99, 0.3)', paddingTop: '12px' }}>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    onClick={togglePlay} 
                    style={{ 
                      padding: '6px 12px', borderRadius: '4px', border: 'none',
                      backgroundColor: 'rgba(75, 85, 99, 0.5)', color: 'var(--text-bright)',
                      fontSize: '12px', cursor: 'pointer'
                    }}>
                    {replayPlaying ? '⏸' : '▶'}
                  </button>
                  <button 
                    onClick={handleStop} 
                    style={{ 
                      padding: '6px 12px', borderRadius: '4px', border: 'none',
                      backgroundColor: 'rgba(75, 85, 99, 0.5)', color: 'var(--text-bright)',
                      fontSize: '12px', cursor: 'pointer'
                    }}>
                    ⏹
                  </button>
                  <button 
                    onClick={() => useConsoleStore.getState().clearReplay()} 
                    style={{ 
                      padding: '6px 12px', borderRadius: '4px', border: 'none',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--status-error)',
                      fontSize: '11px', cursor: 'pointer', fontWeight: 600, marginLeft: '4px'
                    }}>
                    {t('mission_replay.clear')}
                  </button>
                </div>
                
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('mission_replay.speed')}</label>
                  <select
                    value={replaySpeed}
                    onChange={(e) => setReplaySpeed(Number(e.target.value))}
                    style={{
                      padding: '4px 8px', borderRadius: '4px',
                      backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid rgba(75, 85, 99, 0.3)',
                      color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
                    }}
                  >
                    <option value={1}>1x</option>
                    <option value={5}>5x</option>
                    <option value={10}>10x</option>
                    <option value={60}>60x</option>
                  </select>
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={replayEphemeris.length - 1}
                value={replayIndex}
                onChange={(e) => setReplayIndex(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
              />

              <div className="mono-text" style={{ fontSize: '11px', textAlign: 'center', color: 'var(--accent-blue)', fontWeight: 600 }}>
                {replayCurrentUtc ? new Date(replayCurrentUtc).toISOString().substring(0, 19).replace('T', ' ') : '--'}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-bright)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={followReplayObject}
                  onChange={(e) => setFollowReplayObject(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                {t('mission_replay.follow_object')}
              </label>

              <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.2' }}>
                {t('mission_replay.warning')}
              </p>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
};

export const MissionReplayPanel = React.memo(MissionReplayPanelInner);
