import type { StateCreator } from 'zustand';
import { getCatalogEphemeris } from '../../api/client';
import type { ConsoleState } from '../useConsoleStore';

export const createAnalysisSlice: StateCreator<
  ConsoleState,
  [],
  [],
  Pick<
    ConsoleState,
    | 'conjunctionResults'
    | 'activeConjunctionResult'
    | 'visibilityResults'
    | 'visibilityScanActive'
    | 'replayEnabled'
    | 'replayPlaying'
    | 'replayEphemeris'
    | 'replayStartUtc'
    | 'replayEndUtc'
    | 'replayCurrentUtc'
    | 'replaySpeed'
    | 'replayIndex'
    | 'replayMode'
    | 'replayError'
    | 'detailedPasses'
    | 'selectedDetailedPass'
    | 'isComputingDetailedPasses'
    | 'tleHistory'
    | 'decayIndicators'
    | 'illuminationState'
    | 'relativeMotionResult'
    | 'researchLoading'
    | 'researchError'
    | 'setConjunctionResults'
    | 'setActiveConjunctionResult'
    | 'setVisibilityResults'
    | 'setVisibilityScanActive'
    | 'setReplayEnabled'
    | 'setReplayPlaying'
    | 'setReplayEphemeris'
    | 'setReplayStartUtc'
    | 'setReplayEndUtc'
    | 'setReplayCurrentUtc'
    | 'setReplaySpeed'
    | 'setReplayIndex'
    | 'setReplayMode'
    | 'setReplayError'
    | 'clearReplay'
    | 'requestReplayEphemeris'
    | 'setDetailedPasses'
    | 'setSelectedDetailedPass'
    | 'setIsComputingDetailedPasses'
    | 'fetchDetailedPasses'
    | 'fetchTLEHistory'
    | 'fetchDecayIndicators'
    | 'fetchIllumination'
    | 'fetchRelativeMotion'
  >
> = (set, get) => ({
  // Initial state
  conjunctionResults: [],
  activeConjunctionResult: null,
  visibilityResults: [],
  visibilityScanActive: false,
  replayEnabled: false,
  replayPlaying: false,
  replayEphemeris: [],
  replayStartUtc: null,
  replayEndUtc: null,
  replayCurrentUtc: null,
  replaySpeed: 1,
  replayIndex: 0,
  replayMode: 'READY',
  replayError: null,
  detailedPasses: [],
  selectedDetailedPass: null,
  isComputingDetailedPasses: false,
  tleHistory: [],
  decayIndicators: null,
  illuminationState: null,
  relativeMotionResult: null,
  researchLoading: false,
  researchError: null,

  // Actions
  setConjunctionResults: (results) => set({ conjunctionResults: results }),

  setActiveConjunctionResult: (result) => set((state) => ({
    activeConjunctionResult: result,
    logs: result
      ? [...state.logs, `System: Highlighted conjunction TCA for Primary NORAD ${result.primary_norad_id} & Secondary NORAD ${result.secondary_norad_id}.`]
      : state.logs
  })),

  setVisibilityResults: (results) => set({ visibilityResults: results }),

  setVisibilityScanActive: (active) => set({ visibilityScanActive: active }),

  setReplayEnabled: (enabled) => set({ replayEnabled: enabled }),
  setReplayPlaying: (playing) => set({ replayPlaying: playing }),
  setReplayEphemeris: (ephemeris) => set({ replayEphemeris: ephemeris }),
  setReplayStartUtc: (utc) => set({ replayStartUtc: utc }),
  setReplayEndUtc: (utc) => set({ replayEndUtc: utc }),
  setReplayCurrentUtc: (utc) => set({ replayCurrentUtc: utc }),
  setReplaySpeed: (speed) => set({ replaySpeed: speed }),
  setReplayIndex: (index) => set({ replayIndex: index }),
  setReplayMode: (mode) => set({ replayMode: mode }),
  setReplayError: (error) => set({ replayError: error }),

  clearReplay: () => set({
    replayEnabled: false,
    replayPlaying: false,
    replayEphemeris: [],
    replayStartUtc: null,
    replayEndUtc: null,
    replayCurrentUtc: null,
    replaySpeed: 1,
    replayIndex: 0,
    replayMode: 'READY',
    replayError: null,
  }),

  requestReplayEphemeris: async (norad_id, start_time, end_time, step) => {
    if (norad_id < 0) {
      set({ replayError: 'Kullanıcı uyduları için replay efemerisi desteklenmiyor.' });
      return;
    }
    try {
      set({ replayMode: 'READY', replayError: null });
      const pts = Math.floor((new Date(end_time).getTime() - new Date(start_time).getTime()) / (step * 1000));
      if (pts > 5000) {
        throw new Error(`Requested points (${pts}) exceeds maximum allowed (5000). Please reduce duration or increase step size.`);
      }
      const data = await getCatalogEphemeris({
        norad_id,
        start_time_utc: start_time,
        end_time_utc: end_time,
        step_seconds: step
      });
      set({
        replayEphemeris: data,
        replayIndex: 0,
        replayEnabled: true,
        replayMode: 'READY',
        replayStartUtc: start_time,
        replayEndUtc: end_time,
        replayCurrentUtc: data.length > 0 ? data[0].timestamp_utc : null
      });
    } catch (err: any) {
      set({ replayError: err.message, replayMode: 'ERROR' });
    }
  },

  setDetailedPasses: (passes) => set({ detailedPasses: passes }),
  setSelectedDetailedPass: (pass) => set({ selectedDetailedPass: pass }),
  setIsComputingDetailedPasses: (computing) => set({ isComputingDetailedPasses: computing }),

  fetchDetailedPasses: async (startUtc, endUtc, minElev, stepSec) => {
    const { activeObject, observer } = get();
    if (!activeObject || activeObject.norad_id < 0) return;
    set({ isComputingDetailedPasses: true, selectedDetailedPass: null });
    try {
      const { getDetailedPasses } = await import('../../api/client');
      const passes = await getDetailedPasses(
        activeObject.norad_id,
        observer.latitude_deg,
        observer.longitude_deg,
        observer.elevation_m,
        startUtc,
        endUtc,
        minElev,
        stepSec
      );
      set({ detailedPasses: passes });
    } catch (err: any) {
      console.error(err);
      set({ detailedPasses: [] });
    } finally {
      set({ isComputingDetailedPasses: false });
    }
  },

  fetchTLEHistory: async (norad_id) => {
    set({ researchLoading: true, researchError: null });
    try {
      const { getHistoricalTLEs } = await import('../../api/client');
      const data = await getHistoricalTLEs(norad_id);
      set({ tleHistory: data });
    } catch (err: any) {
      console.error(err);
      set({ researchError: err.message || 'Failed to fetch TLE history' });
    } finally {
      set({ researchLoading: false });
    }
  },

  fetchDecayIndicators: async (norad_id) => {
    set({ researchLoading: true, researchError: null });
    try {
      const { getDecayIndicators } = await import('../../api/client');
      const data = await getDecayIndicators(norad_id);
      set({ decayIndicators: data });
    } catch (err: any) {
      console.error(err);
      set({ researchError: err.message || 'Failed to fetch decay indicators' });
    } finally {
      set({ researchLoading: false });
    }
  },

  fetchIllumination: async (norad_id, timestamp_utc) => {
    set({ researchLoading: true, researchError: null });
    try {
      const { getAdvancedIllumination } = await import('../../api/client');
      const data = await getAdvancedIllumination(norad_id, timestamp_utc);
      set({ illuminationState: data.illumination_state });
    } catch (err: any) {
      console.error(err);
      set({ researchError: err.message || 'Failed to fetch illumination state' });
    } finally {
      set({ researchLoading: false });
    }
  },

  fetchRelativeMotion: async (primary, secondary, tca_utc) => {
    set({ researchLoading: true, researchError: null });
    try {
      const { getAdvancedRelativeMotion } = await import('../../api/client');
      const data = await getAdvancedRelativeMotion(primary, secondary, tca_utc);
      set({ relativeMotionResult: data });
    } catch (err: any) {
      console.error(err);
      set({ researchError: err.message || 'Failed to fetch relative motion' });
    } finally {
      set({ researchLoading: false });
    }
  },
});
