import React from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { useTranslation } from '../../i18n/useTranslation';
import { GraphicsSettingsPanel } from './GraphicsSettingsPanel';

export const GlobeControlsPanel: React.FC = () => {
  const activeObject = useConsoleStore(s => s.activeObject);
  const showOrbitPath = useConsoleStore(s => s.showOrbitPath);
  const setShowOrbitPath = useConsoleStore(s => s.setShowOrbitPath);
  const showGroundTrack = useConsoleStore(s => s.showGroundTrack);
  const setShowGroundTrack = useConsoleStore(s => s.setShowGroundTrack);
  const showObserver = useConsoleStore(s => s.showObserver);
  const setShowObserver = useConsoleStore(s => s.setShowObserver);
  const enableEarthLighting = useConsoleStore(s => s.enableEarthLighting);
  const setEnableEarthLighting = useConsoleStore(s => s.setEnableEarthLighting);
  const enableEarthRotation = useConsoleStore(s => s.enableEarthRotation);
  const setEnableEarthRotation = useConsoleStore(s => s.setEnableEarthRotation);
  const followActiveObject = useConsoleStore(s => s.followActiveObject);
  const setFollowActiveObject = useConsoleStore(s => s.setFollowActiveObject);
  const { t } = useTranslation();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      fontSize: '11px',
      color: 'var(--text-bright)'
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input 
          type="checkbox" 
          checked={showOrbitPath} 
          onChange={(e) => setShowOrbitPath(e.target.checked)}
          style={{ accentColor: 'var(--accent-cyan)' }}
        />
        {t('globe.show_orbit_path')}
      </label>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input 
          type="checkbox" 
          checked={showGroundTrack} 
          onChange={(e) => setShowGroundTrack(e.target.checked)}
          style={{ accentColor: 'var(--accent-cyan)' }}
        />
        {t('globe.show_ground_track')}
      </label>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input 
          type="checkbox" 
          checked={showObserver} 
          onChange={(e) => setShowObserver(e.target.checked)}
          style={{ accentColor: 'var(--accent-cyan)' }}
        />
        {t('globe.show_observer_station')}
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '2px' }}>
        <input 
          type="checkbox" 
          checked={enableEarthLighting} 
          onChange={(e) => setEnableEarthLighting(e.target.checked)}
          style={{ accentColor: 'var(--accent-orange)' }}
        />
        {t('globe.earth_sun_lighting')}
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input 
          type="checkbox" 
          checked={enableEarthRotation} 
          onChange={(e) => setEnableEarthRotation(e.target.checked)}
          style={{ accentColor: 'var(--accent-orange)' }}
        />
        {t('globe.real_time_earth_rotation')}
      </label>

      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: activeObject ? 'pointer' : 'not-allowed',
        borderTop: '1px solid var(--border-color)',
        paddingTop: '6px',
        opacity: activeObject ? 1 : 0.5
      }}>
        <input
          type="checkbox"
          checked={followActiveObject}
          onChange={(e) => setFollowActiveObject(e.target.checked)}
          disabled={!activeObject}
          style={{ accentColor: 'var(--accent-cyan)', cursor: activeObject ? 'pointer' : 'not-allowed' }}
        />
        {t('globe.camera_lock_follow')}
      </label>

      {/* Graphics quality controls — preset cards + advanced toggles. Persists
          to localStorage so user choices survive across sessions. */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
        <GraphicsSettingsPanel />
      </div>
    </div>
  );
};
