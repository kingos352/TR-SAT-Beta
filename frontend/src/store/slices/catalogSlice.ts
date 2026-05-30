import type { StateCreator } from 'zustand';
import type { ConsoleState } from '../useConsoleStore';

export const createCatalogSlice: StateCreator<
  ConsoleState,
  [],
  [],
  Pick<
    ConsoleState,
    | 'catalogGroup'
    | 'catalogSearchQuery'
    | 'catalogResults'
    | 'selectedObjects'
    | 'maxSelectedObjects'
    | 'catalogLayerEnabled'
    | 'catalogLayerObjects'
    | 'catalogLayerLoading'
    | 'lastApiError'
    | 'setCatalogResults'
    | 'setCatalogGroup'
    | 'setCatalogSearchQuery'
    | 'selectObject'
    | 'removeSelectedObject'
    | 'setCatalogLayerEnabled'
    | 'setCatalogLayerObjects'
    | 'setCatalogLayerLoading'
  >
> = (set, _get) => ({
  // Initial state
  catalogGroup: 'stations',
  catalogSearchQuery: '',
  catalogResults: [],
  selectedObjects: [],
  maxSelectedObjects: 20,
  catalogLayerEnabled: false,
  catalogLayerObjects: [],
  catalogLayerLoading: false,
  lastApiError: null,

  // Actions
  setCatalogResults: (results) => set({ catalogResults: results }),

  setCatalogGroup: (group) => set({ catalogGroup: group }),

  setCatalogSearchQuery: (query) => set({ catalogSearchQuery: query }),

  selectObject: (obj) => set((state) => {
    const exists = state.selectedObjects.some((item) => item.norad_id === obj.norad_id);
    if (exists) return {};

    if (state.selectedObjects.length >= state.maxSelectedObjects) {
      const warningMsg = 'Maximum tracking selection limit is 20 objects.';
      return {
        logs: [...state.logs, `WARNING: ${warningMsg}`],
        lastApiError: warningMsg
      };
    }

    return {
      selectedObjects: [...state.selectedObjects, obj],
      lastApiError: null,
      logs: [...state.logs, `Selected: ${obj.name} (NORAD ID: ${obj.norad_id}) added to tracking set.`]
    };
  }),

  removeSelectedObject: (noradId) => set((state) => {
    const filtered = state.selectedObjects.filter((item) => item.norad_id !== noradId);
    const wasActive = state.activeObject?.norad_id === noradId;

    return {
      selectedObjects: filtered,
      activeObject: wasActive ? null : state.activeObject,
      activeState: wasActive ? null : state.activeState,
      activeAER: wasActive ? null : state.activeAER,
      activePasses: wasActive ? [] : state.activePasses,
      activeEphemeris: wasActive ? [] : state.activeEphemeris,
      detailedPasses: wasActive ? [] : state.detailedPasses,
      selectedDetailedPass: wasActive ? null : state.selectedDetailedPass,
      activeObjectReliability: wasActive ? null : state.activeObjectReliability,
      tleHistory: wasActive ? [] : state.tleHistory,
      decayIndicators: wasActive ? null : state.decayIndicators,
      illuminationState: wasActive ? null : state.illuminationState,
      relativeMotionResult: wasActive ? null : state.relativeMotionResult,
      replayEphemeris: wasActive ? [] : state.replayEphemeris,
      lastApiError: null,
      logs: [...state.logs, `Removed NORAD ID: ${noradId} from active selection set.`]
    };
  }),

  setCatalogLayerEnabled: (enabled) => set((state) => ({
    catalogLayerEnabled: enabled,
    logs: [...state.logs, `Catalog Layer visualization ${enabled ? 'ENABLED' : 'DISABLED'}.`]
  })),

  setCatalogLayerObjects: (objects) => set({ catalogLayerObjects: objects }),

  setCatalogLayerLoading: (loading) => set({ catalogLayerLoading: loading }),
});
