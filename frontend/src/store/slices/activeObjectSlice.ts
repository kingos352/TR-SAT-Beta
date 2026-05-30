import type { StateCreator } from 'zustand';
import { getCatalogEphemeris, getCatalogState } from '../../api/client';
import type { ConsoleState } from '../useConsoleStore';

export const createActiveObjectSlice: StateCreator<
  ConsoleState,
  [],
  [],
  Pick<
    ConsoleState,
    | 'activeObject'
    | 'activeState'
    | 'activeAER'
    | 'activePasses'
    | 'activeEphemeris'
    | 'activeObjectReliability'
    | 'reliabilityLoading'
    | 'reliabilityError'
    | 'reliabilitySummary'
    | 'setActiveObject'
    | 'setActiveState'
    | 'setActiveAER'
    | 'setActivePasses'
    | 'setActiveEphemeris'
    | 'fetchReliabilitySummary'
    | 'fetchActiveObjectReliability'
  >
> = (set, get) => ({
  // Initial state
  activeObject: null,
  activeState: null,
  activeAER: null,
  activePasses: [],
  activeEphemeris: [],
  activeObjectReliability: null,
  reliabilityLoading: false,
  reliabilityError: null,
  reliabilitySummary: null,

  // Actions
  setActiveObject: (obj) => set((state) => {
    // User-defined satellites (negative NORAD ID) → use numerical propagator endpoints
    if (obj && obj.norad_id < 0) {
      const satId = Math.abs(obj.norad_id);
      setTimeout(async () => {
        const store = get();
        const { getUserSatelliteState, getUserSatelliteEphemeris } = await import('../../api/client');

        // Current position
        const nowUtc = new Date().toISOString();
        getUserSatelliteState(satId, nowUtc)
          .then(state => store.setActiveState(state))
          .catch(err => store.addLog(`User Sat State error: ${err.message}`));

        // Orbit ephemeris — 30 min past + 150 min future (~2 LEO revolutions)
        const start = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const end   = new Date(Date.now() + 150 * 60 * 1000).toISOString();
        getUserSatelliteEphemeris(satId, { start_time_utc: start, end_time_utc: end, step_seconds: 60 })
          .then(eph => store.setActiveEphemeris(eph))
          .catch(err => store.addLog(`User Sat Ephemeris error: ${err.message}`));
      }, 0);
    }

    // Catalog satellites (positive NORAD ID) → use catalog API calls
    if (obj && obj.norad_id >= 0) {
      setTimeout(() => {
        const store = get();
        store.fetchActiveObjectReliability();

        // Auto-fetch current position (for the red dot)
        const nowUtc = new Date().toISOString();
        getCatalogState({ norad_id: obj.norad_id, timestamp_utc: nowUtc })
          .then(res => store.setActiveState(res))
          .catch(err => store.addLog(`Auto-Propagation error: ${err.message}`));

        // Auto-fetch orbit path
        let halfPeriodMs = 45 * 60 * 1000;
        const meanMotion = obj.latest_tle?.mean_motion_rev_per_day;
        if (meanMotion && meanMotion > 0) {
          const periodMinutes = 1440 / meanMotion;
          halfPeriodMs = (periodMinutes / 2) * 60 * 1000;
        }
        if (halfPeriodMs > 24 * 60 * 60 * 1000) {
          halfPeriodMs = 24 * 60 * 60 * 1000;
        }

        const startTime = new Date(new Date().getTime() - halfPeriodMs).toISOString();
        const endTime = new Date(new Date().getTime() + halfPeriodMs).toISOString();

        let stepSeconds = 60;
        if (halfPeriodMs >= 12 * 60 * 60 * 1000) {
          stepSeconds = 300;
        } else if (halfPeriodMs > 2 * 60 * 60 * 1000) {
          stepSeconds = 120;
        }

        getCatalogEphemeris({
          norad_id: obj.norad_id,
          start_time_utc: startTime,
          end_time_utc: endTime,
          step_seconds: stepSeconds
        })
          .then(ephemeris => store.setActiveEphemeris(ephemeris))
          .catch(err => store.addLog(`Auto-Ephemeris error: ${err.message}`));
      }, 0);
    }
    return {
      activeObject: obj,
      activeState: null,
      activeAER: null,
      activePasses: [],
      activeEphemeris: [],
      detailedPasses: [],
      selectedDetailedPass: null,
      activeObjectReliability: null,
      tleHistory: [],
      decayIndicators: null,
      illuminationState: null,
      relativeMotionResult: null,
      replayEphemeris: [],
      lastApiError: null,
      logs: obj
        ? [...state.logs, `Active target focus set to: ${obj.name} (NORAD: ${obj.norad_id}).`]
        : [...state.logs, `Active target focus cleared.`]
    };
  }),

  setActiveState: (state) => set({ activeState: state }),

  setActiveAER: (aer) => set({ activeAER: aer }),

  setActivePasses: (passes) => set({ activePasses: passes }),

  setActiveEphemeris: (ephemeris) => set({ activeEphemeris: ephemeris }),

  fetchReliabilitySummary: async () => {
    set({ reliabilityLoading: true, reliabilityError: null });
    try {
      const { getReliabilitySummary } = await import('../../api/client');
      const data = await getReliabilitySummary();
      set({ reliabilitySummary: data });
    } catch (err: any) {
      console.error(err);
      set({ reliabilityError: err.message || 'Failed to load reliability summary' });
    } finally {
      set({ reliabilityLoading: false });
    }
  },

  fetchActiveObjectReliability: async () => {
    const { activeObject } = get();
    if (!activeObject || activeObject.norad_id < 0) {
      set({ activeObjectReliability: null });
      return;
    }
    set({ reliabilityLoading: true, reliabilityError: null });
    try {
      const { getObjectReliability } = await import('../../api/client');
      const data = await getObjectReliability(activeObject.norad_id);
      set({ activeObjectReliability: data });
    } catch (err: any) {
      console.error(err);
      set({ reliabilityError: err.message || 'Failed to load object reliability' });
    } finally {
      set({ reliabilityLoading: false });
    }
  },
});
