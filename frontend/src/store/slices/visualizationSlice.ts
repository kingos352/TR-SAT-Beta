import type { StateCreator } from 'zustand';
import type { ConsoleState } from '../useConsoleStore';

export const createVisualizationSlice: StateCreator<
  ConsoleState,
  [],
  [],
  Pick<
    ConsoleState,
    | 'showOrbitPath'
    | 'showGroundTrack'
    | 'showObserver'
    | 'followActiveObject'
    | 'enableEarthLighting'
    | 'enableEarthRotation'
    | 'cesiumDiagnostics'
    | 'setShowOrbitPath'
    | 'setShowGroundTrack'
    | 'setShowObserver'
    | 'setFollowActiveObject'
    | 'setEnableEarthLighting'
    | 'setEnableEarthRotation'
    | 'setCesiumDiagnostics'
  >
> = (set, _get) => ({
  // Initial state
  showOrbitPath: true,
  showGroundTrack: true,
  showObserver: true,
  followActiveObject: false,
  enableEarthLighting: false,
  enableEarthRotation: false,
  cesiumDiagnostics: { token: 'Missing', terrain: 'Fallback', imagery: 'Fallback' },

  // Actions
  setShowOrbitPath: (show) => set((state) => ({
    showOrbitPath: show,
    logs: [...state.logs, `Settings: Orbit path rendering ${show ? 'ENABLED' : 'DISABLED'}.`]
  })),

  setShowGroundTrack: (show) => set((state) => ({
    showGroundTrack: show,
    logs: [...state.logs, `Settings: Ground track rendering ${show ? 'ENABLED' : 'DISABLED'}.`]
  })),

  setShowObserver: (show) => set((state) => ({
    showObserver: show,
    logs: [...state.logs, `Settings: Observer station marker rendering ${show ? 'ENABLED' : 'DISABLED'}.`]
  })),

  setFollowActiveObject: (follow) => set((state) => ({
    followActiveObject: follow,
    logs: [...state.logs, `Settings: Camera lock tracking follow-mode ${follow ? 'ENABLED' : 'DISABLED'}.`]
  })),

  setEnableEarthLighting: (enable) => set((state) => ({
    enableEarthLighting: enable,
    logs: [...state.logs, `Settings: Earth lighting (sunlight) ${enable ? 'ENABLED' : 'DISABLED'}.`]
  })),

  setEnableEarthRotation: (enable) => set((state) => ({
    enableEarthRotation: enable,
    logs: [...state.logs, `Settings: Real-time Earth rotation ${enable ? 'ENABLED' : 'DISABLED'}.`]
  })),

  setCesiumDiagnostics: (diagnostics) => set({ cesiumDiagnostics: diagnostics }),
});
