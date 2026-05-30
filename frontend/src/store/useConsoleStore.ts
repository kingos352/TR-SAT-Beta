import { create } from 'zustand';
import type { CatalogObject, SatelliteState, ObserverAER, PassWindow, ConjunctionResult, CatalogSnapshotObject } from '../api/client';
import { createCatalogSlice } from './slices/catalogSlice';
import { createActiveObjectSlice } from './slices/activeObjectSlice';
import { createVisualizationSlice } from './slices/visualizationSlice';
import { createAnalysisSlice } from './slices/analysisSlice';
import { createSystemSlice } from './slices/systemSlice';
import { createGraphicsSlice, type GraphicsSettings, type GraphicsPreset } from './slices/graphicsSlice';

export interface ObserverConfig {
  name: string;
  latitude_deg: number;
  longitude_deg: number;
  elevation_m: number;
  min_elevation_deg: number;
}

export interface ConsoleState {
  language: 'en' | 'tr';
  apiStatus: 'checking' | 'connected' | 'disconnected';
  lastApiError: string | null;
  catalogGroup: string;
  catalogSearchQuery: string;
  catalogResults: CatalogObject[];
  selectedObjects: CatalogObject[];
  activeObject: CatalogObject | null;
  maxSelectedObjects: number;
  observer: ObserverConfig;
  activeState: SatelliteState | null;
  activeAER: ObserverAER | null;
  activePasses: PassWindow[];
  activeEphemeris: SatelliteState[];
  showOrbitPath: boolean;
  showGroundTrack: boolean;
  showObserver: boolean;
  followActiveObject: boolean;
  enableEarthLighting: boolean;
  enableEarthRotation: boolean;
  liveTrackingEnabled: boolean;
  liveConnectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'LIVE' | 'PAUSED' | 'ERROR';
  liveRateHz: number;
  liveObjectStates: Record<number, SatelliteState>;
  lastTelemetryFrameUtc: string | null;
  liveErrors: string[];
  logs: string[];
  activePanel: 'mission_control' | 'catalog' | 'globe_config' | 'data_sources' | 'conjunction' | 'catalog_layer' | 'research';

  // Conjunction State
  conjunctionResults: ConjunctionResult[];
  activeConjunctionResult: ConjunctionResult | null;

  // Visibility State
  visibilityResults: any[];
  visibilityScanActive: boolean;

  // Catalog Layer State
  catalogLayerEnabled: boolean;
  catalogLayerObjects: CatalogSnapshotObject[];
  catalogLayerLoading: boolean;

  // Space Environment Dashboard
  catalogAnalyticsSummary: import('../api/client').CatalogAnalyticsSummary | null;
  analyticsLoading: boolean;
  analyticsError: string | null;
  analyticsFilters: {
    source?: string;
    source_group?: string;
    category?: string;
    object_type?: string;
  };
  analyticsLastUpdated: string | null;
  fetchCatalogAnalytics: () => Promise<void>;
  setAnalyticsFilters: (filters: Partial<ConsoleState['analyticsFilters']>) => void;

  // Reliability State
  reliabilitySummary: import('../api/client').ReliabilitySummary | null;
  activeObjectReliability: import('../api/client').ObjectReliabilityDetail | null;
  reliabilityLoading: boolean;
  reliabilityError: string | null;
  fetchReliabilitySummary: () => Promise<void>;
  fetchActiveObjectReliability: () => Promise<void>;

  // Replay State
  replayEnabled: boolean;
  replayPlaying: boolean;
  replayEphemeris: SatelliteState[];
  replayStartUtc: string | null;
  replayEndUtc: string | null;
  replayCurrentUtc: string | null;
  replaySpeed: number;
  replayIndex: number;
  replayMode: 'READY' | 'PLAYING' | 'PAUSED' | 'ERROR';
  replayError: string | null;

  // Detailed Passes State
  detailedPasses: import('../api/client').DetailedPassWindow[];
  selectedDetailedPass: import('../api/client').DetailedPassWindow | null;
  isComputingDetailedPasses: boolean;

  // Research State
  tleHistory: import('../api/client').HistoricalTLEPoint[];
  decayIndicators: import('../api/client').OrbitalDecayIndicators | null;
  illuminationState: import('../api/client').IlluminationStateResponse['illumination_state'] | null;
  relativeMotionResult: import('../api/client').RelativeMotionResult | null;
  researchLoading: boolean;
  researchError: string | null;

  // Observation quality (set by WeatherPanel, read by StatusBar)
  observationScore: number | null;
  setObservationScore: (score: number | null) => void;

  // Research Lab workspace overlay
  researchLabOpen: boolean;
  setResearchLabOpen: (open: boolean) => void;

  // Cesium Diagnostics
  cesiumDiagnostics: { token: string, terrain: string, imagery: string };
  setCesiumDiagnostics: (diagnostics: { token: string, terrain: string, imagery: string }) => void;

  // Graphics Quality
  graphics: GraphicsSettings;
  setGraphicsPreset: (preset: GraphicsPreset) => void;
  updateGraphicsSetting: <K extends keyof Omit<GraphicsSettings, 'preset'>>(key: K, value: GraphicsSettings[K]) => void;
  resetGraphicsToDefaults: () => void;

  // Actions
  setLanguage: (lang: 'en' | 'tr') => void;
  setApiStatus: (status: 'checking' | 'connected' | 'disconnected', error?: string | null) => void;
  setCatalogResults: (results: CatalogObject[]) => void;
  setCatalogGroup: (group: string) => void;
  setCatalogSearchQuery: (query: string) => void;
  selectObject: (obj: CatalogObject) => void;
  removeSelectedObject: (noradId: number) => void;
  setActiveObject: (obj: CatalogObject | null) => void;
  setObserver: (config: ObserverConfig) => void;
  setActiveState: (state: SatelliteState | null) => void;
  setActiveAER: (aer: ObserverAER | null) => void;
  setActivePasses: (passes: PassWindow[]) => void;
  setActiveEphemeris: (ephemeris: SatelliteState[]) => void;
  setShowOrbitPath: (show: boolean) => void;
  setShowGroundTrack: (show: boolean) => void;
  setShowObserver: (show: boolean) => void;
  setFollowActiveObject: (follow: boolean) => void;
  setEnableEarthLighting: (enable: boolean) => void;
  setEnableEarthRotation: (enable: boolean) => void;
  setLiveTrackingEnabled: (enabled: boolean) => void;
  setLiveConnectionStatus: (status: 'DISCONNECTED' | 'CONNECTING' | 'LIVE' | 'PAUSED' | 'ERROR') => void;
  setLiveRateHz: (rate: number) => void;
  setLiveObjectStates: (states: Record<number, SatelliteState>) => void;
  setLastTelemetryFrameUtc: (timestamp: string | null) => void;
  setLiveErrors: (errors: string[]) => void;
  addLog: (log: string) => void;
  setActivePanel: (panel: 'mission_control' | 'catalog' | 'globe_config' | 'data_sources' | 'conjunction' | 'catalog_layer' | 'research') => void;
  setConjunctionResults: (results: ConjunctionResult[]) => void;
  setActiveConjunctionResult: (result: ConjunctionResult | null) => void;

  setCatalogLayerEnabled: (enabled: boolean) => void;
  setCatalogLayerObjects: (objects: CatalogSnapshotObject[]) => void;
  setCatalogLayerLoading: (loading: boolean) => void;

  setVisibilityResults: (results: any[]) => void;
  setVisibilityScanActive: (active: boolean) => void;

  // Replay Actions
  setReplayEnabled: (enabled: boolean) => void;
  setReplayPlaying: (playing: boolean) => void;
  setReplayEphemeris: (ephemeris: SatelliteState[]) => void;
  setReplayStartUtc: (utc: string | null) => void;
  setReplayEndUtc: (utc: string | null) => void;
  setReplayCurrentUtc: (utc: string | null) => void;
  setReplaySpeed: (speed: number) => void;
  setReplayIndex: (index: number) => void;
  setReplayMode: (mode: 'READY' | 'PLAYING' | 'PAUSED' | 'ERROR') => void;
  setReplayError: (error: string | null) => void;
  clearReplay: () => void;
  requestReplayEphemeris: (norad_id: number, start_time: string, end_time: string, step: number) => Promise<void>;

  setDetailedPasses: (passes: import('../api/client').DetailedPassWindow[]) => void;
  setSelectedDetailedPass: (pass: import('../api/client').DetailedPassWindow | null) => void;
  setIsComputingDetailedPasses: (computing: boolean) => void;
  fetchDetailedPasses: (startUtc: string, endUtc: string, minElev: number, stepSec: number) => Promise<void>;

  fetchTLEHistory: (norad_id: number) => Promise<void>;
  fetchDecayIndicators: (norad_id: number) => Promise<void>;
  fetchIllumination: (norad_id: number, timestamp_utc: string) => Promise<void>;
  fetchRelativeMotion: (primary: number, secondary: number, tca_utc: string) => Promise<void>;
}

export const useConsoleStore = create<ConsoleState>()((...a) => ({
  ...createCatalogSlice(...a),
  ...createActiveObjectSlice(...a),
  ...createVisualizationSlice(...a),
  ...createAnalysisSlice(...a),
  ...createSystemSlice(...a),
  ...createGraphicsSlice(...a),
}));
