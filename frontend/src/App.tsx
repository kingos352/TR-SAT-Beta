import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from './api/client';
import { useTranslation } from './i18n/useTranslation';
import { StatusBar } from './components/Console/StatusBar';
import { CatalogIntelligence, DataSources, SystemLogs } from './components/Console/SidePanel';
import {
  Satellite, MapPin, Radio, Globe, Layers, Activity,
  ShieldCheck, FlaskConical, Database, Download, Terminal, Bot,
  Clock, UserCircle, CloudSun,
  type LucideIcon
} from 'lucide-react';
const CesiumViewer = React.lazy(() => import('./components/Globe/CesiumViewer').then(m => ({ default: m.CesiumViewer })));
import { TrackLegend } from './components/Globe/TrackLegend';
import { TelemetryPanel } from './components/Console/TelemetryPanel';
import { ObserverPanel } from './components/Console/ObserverPanel';
import { LiveTrackingPanel } from './components/Console/LiveTrackingPanel';
import { ConjunctionPanel } from './components/Console/ConjunctionPanel';
import { UserSatellitePanel } from './components/Console/UserSatellitePanel';
import { CatalogLayerPanel } from './components/Console/CatalogLayerPanel';
import { GroundStationVisibilityPanel } from './components/Console/GroundStationVisibilityPanel';
import { ExportPanel } from './components/Console/ExportPanel';
import { AssistantPanel } from './components/Console/AssistantPanel';
import { GlobeControlsPanel } from './components/Console/GlobeControlsPanel';
import { MissionReplayPanel } from './components/Console/MissionReplayPanel';
import { PassTimelinePanel } from './components/Console/PassTimelinePanel';
import { SpaceEnvironmentDashboard } from './components/Console/SpaceEnvironmentDashboard';
import { ResearchReliabilityDashboard } from './components/Console/ResearchReliabilityDashboard';
import { ResearchModePanel } from './components/Console/ResearchModePanel';
import { MissionWorkflowCard } from './components/Console/MissionWorkflowCard';
import { WeatherPanel } from './components/Console/WeatherPanel';
import { CollapsibleWrapper } from './components/Console/CollapsibleWrapper';
import { FirstBootSetup } from './components/Console/FirstBootSetup';
import { GuidedTour } from './components/Console/GuidedTour';
import { ResearchLabWorkspace } from './components/ResearchLab/ResearchLabWorkspace';
import { useConsoleStore } from './store/useConsoleStore';

// Fetches observation quality score independently of the WeatherPanel being open.
// Runs on mount and refreshes every 30 minutes so the header badge is always live.
function useWeatherScoreBackground() {
  const observer = useConsoleStore(s => s.observer);
  const setObservationScore = useConsoleStore(s => s.setObservationScore);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        latitude: String(observer.latitude_deg),
        longitude: String(observer.longitude_deg),
        current: 'cloud_cover,visibility,relative_humidity_2m,wind_speed_10m,precipitation',
        wind_speed_unit: 'kmh',
        timezone: 'auto',
        forecast_days: '1',
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      const c = json.current;
      let score = 100;
      score -= c.cloud_cover * 0.65;
      const visKm = c.visibility / 1000;
      if (visKm < 1) score -= 25; else if (visKm < 5) score -= 15; else if (visKm < 10) score -= 8; else if (visKm < 20) score -= 3;
      if (c.relative_humidity_2m > 90) score -= 12; else if (c.relative_humidity_2m > 80) score -= 6; else if (c.relative_humidity_2m > 70) score -= 2;
      if (c.wind_speed_10m > 50) score -= 10; else if (c.wind_speed_10m > 30) score -= 5;
      if (c.precipitation > 0) score -= 25;
      setObservationScore(Math.max(0, Math.min(100, Math.round(score))));
    } catch { /* silent — header badge simply stays hidden */ }
  }, [observer.latitude_deg, observer.longitude_deg, setObservationScore]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [refresh]);
}

const LeftSidebar: React.FC = () => {
  const { t } = useTranslation();
  const setResearchLabOpen = useConsoleStore(s => s.setResearchLabOpen);
  // Restore the last-opened workspace panel across sessions.
  const [activePanelId, setActivePanelId] = useState<string | null>(() => {
    try { return localStorage.getItem('trsat_last_panel'); } catch { return null; }
  });

  const toggle = (id: string) =>
    setActivePanelId(prev => {
      const next = prev === id ? null : id;
      try {
        if (next) localStorage.setItem('trsat_last_panel', next);
        else localStorage.removeItem('trsat_last_panel');
      } catch { /* ignore storage failures */ }
      return next;
    });

  const panel = (
    id: string,
    title: string,
    icon: LucideIcon,
    content: React.ReactNode
  ) => (
    <CollapsibleWrapper
      key={id}
      title={title}
      icon={icon}
      isOpen={activePanelId === id}
      onToggle={() => toggle(id)}
    >
      {content}
    </CollapsibleWrapper>
  );

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    padding: '14px 14px 5px',
    opacity: 0.6,
  };

  return (
    <aside className="sidebar-dock sidebar-dock--overlay" style={{
      position: 'absolute',
      left: 0,
      top: '56px',
      width: '320px',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100% - 56px)',
      overflowY: 'auto',
      overflowX: 'hidden',
      zIndex: 20,
      paddingBottom: '8px',
    }}>
      <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <MissionWorkflowCard />
      </div>

      <div style={{ paddingTop: '2px' }}>
        <div style={sectionLabelStyle}>{t('nav.track')}</div>
        {panel('catalog', t('menus.catalog_intelligence'), Satellite, <CatalogIntelligence />)}
        {panel('globe', t('menus.globe_visualization'), Globe, <GlobeControlsPanel />)}
        {panel('layer', t('menus.catalog_layer_snapshot'), Layers, <CatalogLayerPanel />)}

        <div style={sectionLabelStyle}>{t('nav.observation')}</div>
        {panel('observer', t('menus.observer_station_config'), MapPin, <ObserverPanel />)}
        {panel('visibility', t('menus.ground_station_visibility'), Radio, <GroundStationVisibilityPanel />)}
        {panel('weather', t('menus.weather_observation'), CloudSun, <WeatherPanel />)}
        {panel('pass_timeline', t('menus.pass_timeline'), Clock, <PassTimelinePanel />)}

        <div style={sectionLabelStyle}>{t('nav.analysis')}</div>
        {panel('environment', t('menus.space_environment_dashboard'), Activity, <SpaceEnvironmentDashboard />)}

        <div style={sectionLabelStyle}>{t('nav.research')}</div>
        <button
          onClick={() => setResearchLabOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 9, width: 'calc(100% - 12px)', margin: '1px 6px 5px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-accent)', background: 'rgba(37,183,255,0.08)', color: 'var(--accent-blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
        >
          <FlaskConical size={14} strokeWidth={2} /> {t('research_lab.open')}
        </button>
        {panel('reliability', t('menus.tle_reliability_dashboard'), ShieldCheck, <ResearchReliabilityDashboard />)}
        {panel('research', t('menus.research_mode'), FlaskConical, <ResearchModePanel />)}

        <div style={sectionLabelStyle}>{t('nav.assets')}</div>
        {panel('user_satellite', t('menus.user_satellite'), UserCircle, <UserSatellitePanel />)}

        <div style={sectionLabelStyle}>{t('nav.system')}</div>
        {panel('datasources', t('menus.data_sources_ingestion'), Database, <DataSources />)}
        {panel('export', t('menus.export_system'), Download, <ExportPanel />)}
        {panel('logs', t('menus.system_event_logs'), Terminal, <SystemLogs />)}
        {panel('assistant', t('menus.mission_knowledge_assistant'), Bot, <AssistantPanel />)}
      </div>
    </aside>
  );
};

const RightSidebarEmpty: React.FC = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
    padding: '24px',
    opacity: 0.5,
  }}>
    <Satellite size={36} color="var(--text-muted)" strokeWidth={1.25} />
    <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
      Select a satellite<br />to inspect
    </p>
  </div>
);

const App: React.FC = () => {
  useWeatherScoreBackground();
  const { t } = useTranslation();
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [rightActivePanel, setRightActivePanel] = useState<string | null>(null);
  const activeObject = useConsoleStore(s => s.activeObject);
  const liveConnectionStatus = useConsoleStore(s => s.liveConnectionStatus);
  const replayEnabled = useConsoleStore(s => s.replayEnabled);
  const activeConjunctionResult = useConsoleStore(s => s.activeConjunctionResult);

  const toggleRight = (id: string) =>
    setRightActivePanel(prev => (prev === id ? null : id));

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/config/status`);
        if (response.ok) {
          const data = await response.json();
          setSetupRequired(data.setup_required);
        } else {
          setSetupRequired(false);
        }
      } catch (error) {
        console.error('Failed to check setup status:', error);
        setSetupRequired(false);
      }
    };
    checkSetupStatus();
  }, []);

  if (setupRequired === null) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #050B14 0%, #0a1628 100%)',
        color: 'var(--text-primary)',
        gap: '16px',
      }}>
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '18px',
          letterSpacing: '0.12em',
          color: 'var(--accent-blue)',
        }}>
          TR-SAT
        </div>
        <div style={{
          width: '28px',
          height: '28px',
          border: '2px solid rgba(37, 183, 255, 0.15)',
          borderTop: '2px solid var(--accent-blue)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (setupRequired) {
    return <FirstBootSetup />;
  }

  // Contextual globe mode badge — reflects the active workflow rather than a static label.
  const objName = activeObject?.name ?? '';
  const modeText = !activeObject
    ? t('system.mode_global')
    : activeConjunctionResult
      ? t('system.mode_conjunction')
      : replayEnabled
        ? `${t('system.mode_replay')} · ${objName}`
        : liveConnectionStatus === 'LIVE'
          ? `${t('system.mode_live')} · ${objName} · SGP4`
          : `${t('system.mode_predicted')} · ${objName} · SGP4`;

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      overflow: 'hidden',
    }}>
      {/* Globe fills the entire viewport — all panels float above it */}
      <main style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
      }}>

      {/* Top Status Bar — absolute overlay */}
      <StatusBar />

        {/* Left Dock — floating overlay */}
        <LeftSidebar />
        <React.Suspense fallback={
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            gap: '16px',
          }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.12em', opacity: 0.5, fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
              LOADING 3D VISUALIZATION ENGINE
            </div>
            <div style={{
              width: '28px',
              height: '28px',
              border: '2px solid rgba(37, 183, 255, 0.15)',
              borderTop: '2px solid var(--accent-blue)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        }>
          <CesiumViewer />
        </React.Suspense>

        {/* Orbit label — below header, centered */}
        <div style={{
          position: 'absolute',
          top: '68px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(8, 18, 32, 0.7)',
          backdropFilter: 'blur(8px)',
          padding: '5px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-accent)',
          color: 'var(--accent-blue)',
          fontSize: '10px',
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          zIndex: 5,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          {modeText}
        </div>

        {/* Track overlay legend — collapsible key, bottom-left of globe */}
        <TrackLegend />

        {/* Right Dock — floating overlay */}
        <aside className="sidebar-dock sidebar-dock--overlay" style={{
          position: 'absolute',
          right: 0,
          top: '56px',
          width: '360px',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100% - 56px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          zIndex: 20,
        }}>
          {!activeObject ? (
            <RightSidebarEmpty />
          ) : (
            <>
              <CollapsibleWrapper
                title={t('menus.telemetry_orbital_state')}
                icon={Satellite}
                isOpen={rightActivePanel === 'telemetry'}
                onToggle={() => toggleRight('telemetry')}
              >
                <TelemetryPanel />
              </CollapsibleWrapper>

              {/* keepMounted: WebSocket connection must persist regardless of panel visibility */}
              <CollapsibleWrapper
                title={t('menus.live_tracking')}
                icon={Radio}
                isOpen={rightActivePanel === 'live_tracking'}
                onToggle={() => toggleRight('live_tracking')}
                keepMounted={true}
              >
                <LiveTrackingPanel />
              </CollapsibleWrapper>

              <CollapsibleWrapper
                title={t('menus.mission_replay')}
                icon={Activity}
                isOpen={rightActivePanel === 'mission_replay'}
                onToggle={() => toggleRight('mission_replay')}
              >
                <MissionReplayPanel />
              </CollapsibleWrapper>

              <CollapsibleWrapper
                title={t('menus.conjunction_analysis')}
                icon={ShieldCheck}
                isOpen={rightActivePanel === 'conjunction'}
                onToggle={() => toggleRight('conjunction')}
              >
                <ConjunctionPanel />
              </CollapsibleWrapper>
            </>
          )}

          {/* Footer */}
          <div style={{
            marginTop: 'auto',
            padding: '20px 16px 14px',
            textAlign: 'center',
            fontSize: '10px',
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            opacity: 0.5,
            borderTop: '1px solid var(--border-subtle)',
          }}>
            Powered by Ersan Yüksekkaya
          </div>
        </aside>
      </main>

      <GuidedTour />
      <ResearchLabWorkspace />
    </div>
  );
};

export default App;
