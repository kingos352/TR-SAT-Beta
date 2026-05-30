import React, { useState } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { getCatalogAER, getCatalogPasses } from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';

export const ObserverPanel: React.FC = () => {
  const activeObject = useConsoleStore(s => s.activeObject);
  const observer = useConsoleStore(s => s.observer);
  const setObserver = useConsoleStore(s => s.setObserver);
  const activeAER = useConsoleStore(s => s.activeAER);
  const setActiveAER = useConsoleStore(s => s.setActiveAER);
  const activePasses = useConsoleStore(s => s.activePasses);
  const setActivePasses = useConsoleStore(s => s.setActivePasses);
  const addLog = useConsoleStore(s => s.addLog);
  const setApiStatus = useConsoleStore(s => s.setApiStatus);
  const { t } = useTranslation();

  // Form states initialized from Zustand
  const [stationName, setStationName] = useState(observer.name);
  const [lat, setLat] = useState(observer.latitude_deg);
  const [lon, setLon] = useState(observer.longitude_deg);
  const [elev, setElev] = useState(observer.elevation_m);
  const [minEl, setMinEl] = useState(observer.min_elevation_deg);

  const [aerLoading, setAerLoading] = useState(false);
  const [passesLoading, setPassesLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const updateObserverSettings = () => {
    const config = {
      name: stationName,
      latitude_deg: lat,
      longitude_deg: lon,
      elevation_m: elev,
      min_elevation_deg: minEl
    };
    setObserver(config);
  };

  const handleComputeAER = async () => {
    if (!activeObject || activeObject.norad_id < 0) return;
    updateObserverSettings();
    setAerLoading(true);
    const nowUtc = new Date().toISOString();
    addLog(`Observer Geometry: Computing topocentric AER relative to ${stationName} at ${nowUtc.substring(11, 19)} UTC...`);
    try {
      const aer = await getCatalogAER({
        norad_id: activeObject.norad_id,
        timestamp_utc: nowUtc,
        observer_latitude_deg: lat,
        observer_longitude_deg: lon,
        observer_elevation_m: elev
      });
      setActiveAER(aer);
      setApiStatus('connected');
      addLog(`Observer Geometry Success: Az: ${aer.azimuth_deg.toFixed(2)}°, El: ${aer.elevation_deg.toFixed(2)}°, Range: ${aer.range_km.toFixed(1)} km.`);
    } catch (err: any) {
      setApiStatus('disconnected', err.message);
      addLog(`Observer Geometry Error: AER computation failed (${err.message})`);
    } finally {
      setAerLoading(false);
    }
  };

  const handlePredictPasses = async () => {
    if (!activeObject || activeObject.norad_id < 0) return;
    updateObserverSettings();
    setPassesLoading(true);
    const startUtc = new Date();
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000); // 24 hours window
    addLog(`Pass Prediction: Scheduling 24-hour horizon calculations for ${activeObject.name}...`);
    try {
      const passes = await getCatalogPasses({
        norad_id: activeObject.norad_id,
        observer_latitude_deg: lat,
        observer_longitude_deg: lon,
        observer_elevation_m: elev,
        start_time_utc: startUtc.toISOString(),
        end_time_utc: endUtc.toISOString(),
        min_elevation_deg: minEl
      });
      setActivePasses(passes);
      setApiStatus('connected');
      addLog(`Pass Prediction Success: Detected ${passes.length} visible tracking windows.`);
    } catch (err: any) {
      setApiStatus('disconnected', err.message);
      addLog(`Pass Prediction Error: Calculation failed (${err.message})`);
    } finally {
      setPassesLoading(false);
    }
  };

  const formatPassTime = (isoString: string) => {
    return isoString.replace('T', ' ').substring(11, 19);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      
      {/* 1. Observer Station Configuration */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
        <div 
          onClick={() => setSettingsOpen(!settingsOpen)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
            {t('observer.station_coordinate_input')}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>{settingsOpen ? '▼' : '▶'}</span>
        </div>
        
        {settingsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <input
              type="text"
              placeholder={t('observer.station_name')}
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '4px',
                backgroundColor: 'rgba(3, 7, 18, 0.7)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-bright)',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>{t('observer.lat')}</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(3, 7, 18, 0.7)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-bright)',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>{t('observer.lon')}</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lon}
                  onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(3, 7, 18, 0.7)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-bright)',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>{t('observer.elev')}</label>
                <input
                  type="number"
                  value={elev}
                  onChange={(e) => setElev(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(3, 7, 18, 0.7)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-bright)',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>{t('observer.mask')}</label>
                <input
                  type="number"
                  value={minEl}
                  onChange={(e) => setMinEl(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(3, 7, 18, 0.7)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-bright)',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleComputeAER}
          disabled={aerLoading || !activeObject}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid var(--accent-blue)',
            backgroundColor: 'transparent',
            color: 'var(--accent-blue)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: (!activeObject || aerLoading) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {aerLoading ? t('observer.computing') : t('observer.compute_aer')}
        </button>
        <button
          onClick={handlePredictPasses}
          disabled={passesLoading || !activeObject}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: (!activeObject || passesLoading) ? 'rgba(75, 85, 99, 0.5)' : 'var(--accent-cyan)',
            color: 'var(--text-bright)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: (!activeObject || passesLoading) ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {passesLoading ? t('observer.predicting') : t('observer.predict_passes')}
        </button>
      </div>

      {/* 2. AER Output Display */}
      {activeAER && (
        <div style={{
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '6px',
          padding: '10px 12px'
        }}>
          <h3 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
            {t('observer.topocentric_horizon_coordinates')}
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <div>{t('observer.azimuth')} <strong className="mono-text" style={{ color: 'var(--text-bright)' }}>{activeAER.azimuth_deg.toFixed(2)}°</strong></div>
            <div>{t('observer.elevation')} <strong className="mono-text" style={{ color: 'var(--text-bright)' }}>{activeAER.elevation_deg.toFixed(2)}°</strong></div>
            <div>{t('observer.range')} <strong className="mono-text" style={{ color: 'var(--text-bright)' }}>{activeAER.range_km.toFixed(1)} km</strong></div>
          </div>
        </div>
      )}

      {/* 3. Pass Prediction Results */}
      {activePasses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {t('observer.visible_pass_predictor')}
          </h3>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '6px' }}>{t('observer.aos')}</th>
                  <th style={{ padding: '6px' }}>{t('observer.max')}</th>
                  <th style={{ padding: '6px' }}>{t('observer.los')}</th>
                  <th style={{ padding: '6px' }}>{t('observer.max_el')}</th>
                  <th style={{ padding: '6px' }}>{t('observer.range_km')}</th>
                </tr>
              </thead>
              <tbody>
                {activePasses.map((p, index) => (
                  <tr key={index} style={{ borderBottom: index < activePasses.length - 1 ? '1px solid rgba(75,85,99,0.15)' : 'none' }}>
                    <td className="mono-text" style={{ padding: '6px', color: 'var(--text-bright)' }}>{formatPassTime(p.aos_time_utc)}</td>
                    <td className="mono-text" style={{ padding: '6px', color: 'var(--text-bright)' }}>{formatPassTime(p.max_time_utc)}</td>
                    <td className="mono-text" style={{ padding: '6px', color: 'var(--text-bright)' }}>{formatPassTime(p.los_time_utc)}</td>
                    <td className="mono-text" style={{ padding: '6px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{p.max_elevation_deg.toFixed(1)}°</td>
                    <td className="mono-text" style={{ padding: '6px', color: 'var(--text-bright)' }}>{p.range_at_max_km ? p.range_at_max_km.toFixed(0) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
