import React, { useCallback } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { useTelemetrySocket } from '../../hooks/useTelemetrySocket';
import { useTranslation } from '../../i18n/useTranslation';
import { API_BASE_URL } from '../../api/client';

const WS_ENDPOINT = "/api/v1/ws/telemetry";
const WS_URL = (() => {
  const explicit = import.meta.env.VITE_WS_BASE_URL;
  if (explicit) return `${explicit.replace(/\/$/, "")}${WS_ENDPOINT}`;
  if (!API_BASE_URL) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${WS_ENDPOINT}`;
  }
  const wsBase = API_BASE_URL
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")
    .replace(/\/$/, "");
  return `${wsBase}${WS_ENDPOINT}`;
})();

const LiveTrackingPanelInner: React.FC = () => {
  const selectedObjects = useConsoleStore(s => s.selectedObjects);
  const liveTrackingEnabled = useConsoleStore(s => s.liveTrackingEnabled);
  const liveConnectionStatus = useConsoleStore(s => s.liveConnectionStatus);
  const liveRateHz = useConsoleStore(s => s.liveRateHz);
  const lastTelemetryFrameUtc = useConsoleStore(s => s.lastTelemetryFrameUtc);
  const liveErrors = useConsoleStore(s => s.liveErrors);
  // Only subscribe to the count — not the full Record — so position updates at 5Hz
  // don't trigger a re-render of this panel.
  const liveObjectCount = useConsoleStore(s => Object.keys(s.liveObjectStates || {}).length);
  const setLiveTrackingEnabled = useConsoleStore(s => s.setLiveTrackingEnabled);
  const setLiveRateHz = useConsoleStore(s => s.setLiveRateHz);
  const setLiveObjectStates = useConsoleStore(s => s.setLiveObjectStates);
  const { t } = useTranslation();

  const { pause, resume, stop, connect, disconnect } = useTelemetrySocket();

  const handleStop = useCallback(() => {
    stop();
    disconnect();
    setLiveObjectStates({});
  }, [stop, disconnect, setLiveObjectStates]);

  const handleToggleTracking = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    setLiveTrackingEnabled(enabled);
    if (!enabled) {
      stop();
      disconnect();
      setLiveObjectStates({});
    }
  }, [setLiveTrackingEnabled, stop, disconnect, setLiveObjectStates]);

  const rates = [5, 10, 20, 30, 60];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={liveTrackingEnabled}
            onChange={handleToggleTracking}
            style={{ accentColor: 'var(--accent-green)' }}
          />
          {t('live_tracking.enable')}
        </label>
      </div>

      {liveTrackingEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
          {selectedObjects.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--accent-orange)', fontStyle: 'italic', backgroundColor: 'rgba(249, 115, 22, 0.05)', border: '1px solid rgba(249, 115, 22, 0.2)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
              {t('live_tracking.warning_select')}
            </div>
          ) : (
            <>
              {/* Connection stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                <div style={{ background: 'var(--bg-panel-soft)', border: '1px solid var(--border-color)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>{t('live_tracking.socket_status')}</div>
                  <div className="mono-text" style={{ 
                    fontWeight: 'bold', 
                    marginTop: '2px',
                    color: liveConnectionStatus === 'LIVE' ? 'var(--accent-green)' : 
                           liveConnectionStatus === 'PAUSED' ? 'var(--accent-orange)' : 'var(--accent-red)'
                  }}>{liveConnectionStatus}</div>
                </div>
                
                <div style={{ background: 'var(--bg-panel-soft)', border: '1px solid var(--border-color)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>{t('live_tracking.last_frame')}</div>
                  <div className="mono-text" style={{ fontWeight: 'bold', marginTop: '2px', color: 'var(--text-bright)' }}>
                    {lastTelemetryFrameUtc ? lastTelemetryFrameUtc.substring(11, 19) + ' UTC' : 'WAITING'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {liveConnectionStatus === 'DISCONNECTED' && (
                  <button
                    onClick={connect}
                    disabled={selectedObjects.length === 0}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: selectedObjects.length === 0 ? 'rgba(75, 85, 99, 0.2)' : 'var(--accent-green)',
                      color: 'var(--text-bright)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: selectedObjects.length === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {t('live_tracking.start')}
                  </button>
                )}

                {liveConnectionStatus === 'CONNECTING' && (
                  <button
                    disabled
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: 'rgba(75, 85, 99, 0.2)',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'not-allowed'
                    }}
                  >
                    {t('live_tracking.connecting')}
                  </button>
                )}

                {liveConnectionStatus === 'LIVE' && (
                  <>
                    <button
                      onClick={pause}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: 'var(--accent-orange)',
                        color: 'var(--text-bright)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {t('live_tracking.pause')}
                    </button>
                    <button
                      onClick={handleStop}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: 'var(--accent-red)',
                        color: 'var(--text-bright)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {t('live_tracking.stop')}
                    </button>
                  </>
                )}

                {liveConnectionStatus === 'PAUSED' && (
                  <>
                    <button
                      onClick={resume}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: 'var(--accent-green)',
                        color: 'var(--text-bright)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {t('live_tracking.resume')}
                    </button>
                    <button
                      onClick={handleStop}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: 'var(--accent-red)',
                        color: 'var(--text-bright)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {t('live_tracking.stop')}
                    </button>
                  </>
                )}

                {liveConnectionStatus === 'ERROR' && (
                  <>
                    <button
                      onClick={connect}
                      style={{
                        flex: 2,
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: 'var(--accent-green)',
                        color: 'var(--text-bright)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {t('live_tracking.retry')}
                    </button>
                    <button
                      onClick={handleStop}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: 'var(--accent-red)',
                        color: 'var(--text-bright)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {t('live_tracking.stop')}
                    </button>
                  </>
                )}
              </div>

              {/* Rate Hz selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('live_tracking.rate')}</span>
                <div style={{ display: 'flex', gap: '4px', flexGrow: 1 }}>
                  {rates.map(r => (
                    <button
                      key={r}
                      onClick={() => setLiveRateHz(r)}
                      style={{
                        flex: 1,
                        padding: '3px 0',
                        borderRadius: '3px',
                        border: '1px solid',
                        borderColor: liveRateHz === r ? 'var(--accent-cyan)' : 'var(--border-color)',
                        backgroundColor: liveRateHz === r ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                        color: liveRateHz === r ? 'var(--text-bright)' : 'var(--text-muted)',
                        fontSize: '10px',
                        fontWeight: liveRateHz === r ? 600 : 400,
                        cursor: 'pointer'
                      }}
                    >
                      {r}Hz
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* WS Diagnostic Details */}
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-color)',
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            color: 'var(--text-muted)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('live_tracking.ws_url')}</span>
              <span className="mono-text" style={{ color: 'var(--text-bright)' }}>{WS_URL}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('live_tracking.target_ids')}</span>
              <span className="mono-text" style={{ color: 'var(--text-bright)' }}>
                {selectedObjects.map(o => o.norad_id).join(', ') || 'None'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('live_tracking.object_count')}</span>
              <span className="mono-text" style={{ color: 'var(--text-bright)' }}>
                {liveObjectCount}
              </span>
            </div>
            {liveErrors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid var(--border-color)', paddingTop: '4px', marginTop: '2px' }}>
                <span style={{ color: 'var(--accent-red)' }}>{t('live_tracking.errors')}</span>
                {liveErrors.map((err, i) => (
                  <span key={i} className="mono-text" style={{ color: 'var(--accent-red)' }}>• {err}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <details style={{
        fontSize: '10px',
        color: 'var(--text-muted)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        padding: '6px 8px',
        marginTop: '8px'
      }}>
        <summary style={{ cursor: 'pointer', outline: 'none', fontWeight: 600 }}>
          {t('live_tracking.warning_title')}
        </summary>
        <div style={{ marginTop: '6px', lineHeight: '1.4' }}>
          {t('live_tracking.warning_body')}
        </div>
      </details>
    </div>
  );
};

export const LiveTrackingPanel = React.memo(LiveTrackingPanelInner);
