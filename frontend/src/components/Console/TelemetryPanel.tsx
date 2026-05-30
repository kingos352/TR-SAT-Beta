import React, { useState, useCallback } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { getCatalogState, getCatalogEphemeris } from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';
import { SkeletonCard } from './Skeleton';

const TelemetryPanelInner: React.FC = () => {
  const activeObject = useConsoleStore(s => s.activeObject);
  const activeState = useConsoleStore(s => s.activeState);
  const setActiveState = useConsoleStore(s => s.setActiveState);
  const setActiveEphemeris = useConsoleStore(s => s.setActiveEphemeris);
  const addLog = useConsoleStore(s => s.addLog);
  const setApiStatus = useConsoleStore(s => s.setApiStatus);
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [orbitLoading, setOrbitLoading] = useState(false);

  const handleUpdateState = useCallback(async () => {
    if (!activeObject) return;
    if (activeObject.norad_id < 0) {
      addLog('Telemetry: Kullanıcı uyduları için katalog propagasyonu desteklenmiyor.');
      return;
    }
    setLoading(true);
    const nowUtc = new Date().toISOString();
    addLog(`Propagation: Querying state for ${activeObject.name} at ${nowUtc.substring(11, 19)} UTC...`);
    try {
      const state = await getCatalogState({
        norad_id: activeObject.norad_id,
        timestamp_utc: nowUtc
      });
      setActiveState(state);
      setApiStatus('connected');
      addLog(`Propagation success: Position computed. Alt: ${state.altitude_km.toFixed(1)} km, Lat/Lon: ${state.latitude_deg.toFixed(4)}°N, ${state.longitude_deg.toFixed(4)}°E.`);
    } catch (err: any) {
      setApiStatus('disconnected', err.message);
      addLog(`Propagation error: State query failed (${err.message})`);
    } finally {
      setLoading(false);
    }
  }, [activeObject, addLog, setActiveState, setApiStatus]);

  const handleUpdateOrbit = useCallback(async () => {
    if (!activeObject) {
      addLog('WARNING: No active object selected.');
      return;
    }
    if (activeObject.norad_id < 0) {
      addLog('Ephemeris: Kullanıcı uyduları için katalog efemerisi desteklenmiyor.');
      return;
    }
    setOrbitLoading(true);
    addLog(`Ephemeris: Generating orbit ephemeris for ${activeObject.name} (NORAD: ${activeObject.norad_id})...`);
    try {
      const now = new Date();
      let halfPeriodMs = 45 * 60 * 1000; // default 45 mins
      const meanMotion = activeObject.latest_tle?.mean_motion_rev_per_day;
      if (meanMotion && meanMotion > 0) {
        const periodMinutes = 1440 / meanMotion;
        halfPeriodMs = (periodMinutes / 2) * 60 * 1000;
      }
      // Cap at 24 hours to prevent extreme ranges
      if (halfPeriodMs > 24 * 60 * 60 * 1000) {
        halfPeriodMs = 24 * 60 * 60 * 1000;
      }

      const startTime = new Date(now.getTime() - halfPeriodMs).toISOString();
      const endTime = new Date(now.getTime() + halfPeriodMs).toISOString();

      let stepSeconds = 60;
      if (halfPeriodMs > 12 * 60 * 60 * 1000) {
        stepSeconds = 300; // 5 min steps for very long periods
      } else if (halfPeriodMs > 2 * 60 * 60 * 1000) {
        stepSeconds = 120; // 2 min steps for MEO/GEO
      }

      const ephemeris = await getCatalogEphemeris({
        norad_id: activeObject.norad_id,
        start_time_utc: startTime,
        end_time_utc: endTime,
        step_seconds: stepSeconds
      });

      setActiveEphemeris(ephemeris);
      setApiStatus('connected');
      addLog(`Ephemeris success: Generated ${ephemeris.length} points for 90-minute window.`);
    } catch (err: any) {
      setApiStatus('disconnected', err.message);
      addLog(`Ephemeris error: Failed to generate ephemeris (${err.message})`);
    } finally {
      setOrbitLoading(false);
    }
  }, [activeObject, addLog, setActiveEphemeris, setApiStatus]);

  if (!activeObject) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: '120px',
        color: 'var(--text-muted)',
        fontSize: '11px',
        fontStyle: 'italic'
      }}>
        {t('telemetry.select_object')}
      </div>
    );
  }

  const meanMotion = activeObject.latest_tle?.mean_motion_rev_per_day;
  const periodMin = meanMotion && meanMotion > 0 ? 1440 / meanMotion : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-bright)' }}>
            {activeObject.name}
          </h3>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {activeObject.object_type} · NORAD {activeObject.norad_id} · {t('telemetry.predicted_state_sgp4')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleUpdateState}
            disabled={loading}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: loading ? 'rgba(75, 85, 99, 0.5)' : 'var(--accent-cyan)',
              color: 'var(--text-bright)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? t('telemetry.propagating') : t('telemetry.update_state')}
          </button>
          <button
            onClick={handleUpdateOrbit}
            disabled={orbitLoading}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: orbitLoading ? 'rgba(75, 85, 99, 0.5)' : 'var(--accent-blue)',
              color: 'var(--text-bright)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: orbitLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {orbitLoading ? t('telemetry.computing') : t('telemetry.update_orbit')}
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px'
      }}>
        {/* NORAD ID Card */}
        <div style={{ background: 'var(--bg-panel-soft)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('telemetry.norad_id')}</div>
          <div className="mono-text" style={{ fontSize: '16px', color: 'var(--text-bright)', fontWeight: 'bold', marginTop: '2px' }}>
            {activeObject.norad_id}
          </div>
        </div>

        {/* COSPAR ID Card */}
        <div style={{ background: 'var(--bg-panel-soft)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('telemetry.cospar_id')}</div>
          <div className="mono-text" style={{ fontSize: '16px', color: 'var(--text-bright)', fontWeight: 'bold', marginTop: '2px' }}>
            {activeObject.cospar_id || 'UNKNOWN'}
          </div>
        </div>

        {/* Type Card */}
        <div style={{ background: 'var(--bg-panel-soft)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('telemetry.object_type')}</div>
          <div className="mono-text" style={{ fontSize: '14px', color: 'var(--accent-cyan)', fontWeight: 'bold', marginTop: '4px' }}>
            {activeObject.object_type}
          </div>
        </div>

        {/* Category Card */}
        <div style={{ background: 'var(--bg-panel-soft)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('telemetry.category')}</div>
          <div className="mono-text" style={{ fontSize: '14px', color: 'var(--text-bright)', fontWeight: 'bold', marginTop: '4px' }}>
            {activeObject.category}
          </div>
        </div>
      </div>

      {activeState ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px'
          }}>
            {/* Latitude Card */}
            <div style={{ background: 'var(--bg-panel-soft)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('telemetry.latitude')}</div>
              <div className="mono-text" style={{ fontSize: '13px', color: 'var(--accent-cyan)', fontWeight: 'bold', marginTop: '2px' }}>
                {activeState.latitude_deg.toFixed(4)}° N
              </div>
            </div>

            {/* Longitude Card */}
            <div style={{ background: 'var(--bg-panel-soft)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('telemetry.longitude')}</div>
              <div className="mono-text" style={{ fontSize: '13px', color: 'var(--accent-cyan)', fontWeight: 'bold', marginTop: '2px' }}>
                {activeState.longitude_deg.toFixed(4)}° E
              </div>
            </div>

            {/* Altitude Card */}
            <div style={{ background: 'var(--bg-panel-soft)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('telemetry.altitude')}</div>
              <div className="mono-text" style={{ fontSize: '13px', color: 'var(--text-bright)', fontWeight: 'bold', marginTop: '2px' }}>
                {activeState.altitude_km.toFixed(1)} km
              </div>
            </div>
          </div>

          {/* Period (derived from mean motion) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('telemetry.period')}</span>
            <strong className="mono-text" style={{ color: 'var(--text-bright)' }}>
              {periodMin != null ? `${periodMin.toFixed(1)} min` : '—'}
            </strong>
          </div>

          {/* Advanced Orbital Details — collapsed by default */}
          <details>
            <summary style={{ cursor: 'pointer', outline: 'none', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              {t('telemetry.advanced_details')}
            </summary>
          <div style={{
            background: 'var(--bg-panel-soft)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            marginTop: '6px'
          }}>
            <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
              {t('telemetry.ecef_coords')}
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <div>X: <strong className="mono-text" style={{ color: 'var(--text-bright)' }}>{activeState.ecef.x_km.toFixed(3)} km</strong></div>
              <div>Y: <strong className="mono-text" style={{ color: 'var(--text-bright)' }}>{activeState.ecef.y_km.toFixed(3)} km</strong></div>
              <div>Z: <strong className="mono-text" style={{ color: 'var(--text-bright)' }}>{activeState.ecef.z_km.toFixed(3)} km</strong></div>
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
              {t('telemetry.coord_note')}
            </div>
          </div>
          </details>

          {/* Reliability and Metadata */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginTop: '4px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>{t('telemetry.tle_age')} </span>
              <strong className="mono-text" style={{ color: 'var(--text-bright)' }}>
                {activeState.tle_age_days ? `${activeState.tle_age_days.toFixed(2)} days` : 'N/A'}
              </strong>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('telemetry.reliability')}</span>
              <span className="mono-text" style={{
                backgroundColor: activeState.reliability_status === 'FRESH' ? 'rgba(16, 185, 129, 0.15)' :
                                 activeState.reliability_status === 'AGING' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: activeState.reliability_status === 'FRESH' ? 'var(--accent-green)' :
                       activeState.reliability_status === 'AGING' ? 'var(--accent-orange)' : 'var(--accent-red)',
                border: `1px solid ${
                       activeState.reliability_status === 'FRESH' ? 'var(--accent-green)' :
                       activeState.reliability_status === 'AGING' ? 'var(--accent-orange)' : 'var(--accent-red)'}`,
                padding: '2px 6px',
                borderRadius: '12px',
                fontSize: '10px',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                {t(`reliability.${activeState.reliability_status.toLowerCase()}`)}
              </span>
            </div>
          </div>

          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>
            {t('telemetry.epoch')} <span className="mono-text">{activeState.timestamp_utc.replace('T', ' ').substring(0, 19)} UTC</span>
          </div>

        </div>
      ) : loading ? (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <SkeletonCard rows={4} />
        </div>
      ) : (
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '16px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-muted)',
          fontStyle: 'italic'
        }}>
          {t('telemetry.not_calculated')}
        </div>
      )}

    </div>
  );
};

export const TelemetryPanel = React.memo(TelemetryPanelInner);
