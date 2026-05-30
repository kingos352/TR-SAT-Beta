import type { StateCreator } from 'zustand';
import type { ConsoleState } from '../useConsoleStore';

export const createSystemSlice: StateCreator<
  ConsoleState,
  [],
  [],
  Pick<
    ConsoleState,
    | 'language'
    | 'apiStatus'
    | 'observer'
    | 'logs'
    | 'activePanel'
    | 'liveTrackingEnabled'
    | 'liveConnectionStatus'
    | 'liveRateHz'
    | 'liveObjectStates'
    | 'lastTelemetryFrameUtc'
    | 'liveErrors'
    | 'catalogAnalyticsSummary'
    | 'analyticsLoading'
    | 'analyticsError'
    | 'analyticsFilters'
    | 'analyticsLastUpdated'
    | 'setLanguage'
    | 'setApiStatus'
    | 'setObserver'
    | 'addLog'
    | 'setActivePanel'
    | 'setLiveTrackingEnabled'
    | 'setLiveConnectionStatus'
    | 'setLiveRateHz'
    | 'setLiveObjectStates'
    | 'setLastTelemetryFrameUtc'
    | 'setLiveErrors'
    | 'setAnalyticsFilters'
    | 'fetchCatalogAnalytics'
    | 'observationScore'
    | 'setObservationScore'
    | 'researchLabOpen'
    | 'setResearchLabOpen'
  >
> = (set, get) => ({
  // Initial state
  language: 'en',
  apiStatus: 'checking',
  observer: {
    name: 'Nevşehir Ground Station',
    latitude_deg: 38.6244,
    longitude_deg: 34.7144,
    elevation_m: 1200.0,
    min_elevation_deg: 10.0
  },
  observationScore: null,
  setObservationScore: (score) => set({ observationScore: score }),
  researchLabOpen: false,
  setResearchLabOpen: (open) => set({ researchLabOpen: open }),
  logs: ['Console Initialized. System standby.'],
  activePanel: 'mission_control',
  liveTrackingEnabled: false,
  liveConnectionStatus: 'DISCONNECTED',
  liveRateHz: 1.0,
  liveObjectStates: {},
  lastTelemetryFrameUtc: null,
  liveErrors: [],
  catalogAnalyticsSummary: null,
  analyticsLoading: false,
  analyticsError: null,
  analyticsFilters: {},
  analyticsLastUpdated: null,

  // Actions
  setLanguage: (lang) => set({ language: lang }),

  setApiStatus: (status, error = null) => set((state) => {
    if (!error) return { apiStatus: status, lastApiError: null };
    const next = [...state.logs, `API ERROR: ${error}`];
    return { apiStatus: status, lastApiError: error, logs: next.length > 200 ? next.slice(-200) : next };
  }),

  setObserver: (config) => set({ observer: config }),

  addLog: (log) => set((state) => {
    const next = [...state.logs, log];
    return { logs: next.length > 200 ? next.slice(-200) : next };
  }),

  setActivePanel: (panel) => set({ activePanel: panel }),

  setLiveTrackingEnabled: (enabled) => set({ liveTrackingEnabled: enabled }),

  setLiveConnectionStatus: (status) => set({ liveConnectionStatus: status }),

  setLiveRateHz: (rate) => set({ liveRateHz: rate }),

  setLiveObjectStates: (states) => set({ liveObjectStates: states }),

  setLastTelemetryFrameUtc: (timestamp) => set({ lastTelemetryFrameUtc: timestamp }),

  setLiveErrors: (errors) => set({ liveErrors: errors }),

  setAnalyticsFilters: (filters) => set((state) => ({
    analyticsFilters: { ...state.analyticsFilters, ...filters }
  })),

  fetchCatalogAnalytics: async () => {
    set({ analyticsLoading: true, analyticsError: null });
    try {
      const { getCatalogAnalyticsSummary } = await import('../../api/client');
      const filters = get().analyticsFilters;
      const summary = await getCatalogAnalyticsSummary(filters);
      set({
        catalogAnalyticsSummary: summary,
        analyticsLastUpdated: new Date().toISOString()
      });
    } catch (err: any) {
      console.error(err);
      set({ analyticsError: err.message || 'Failed to load catalog analytics' });
    } finally {
      set({ analyticsLoading: false });
    }
  },
});
