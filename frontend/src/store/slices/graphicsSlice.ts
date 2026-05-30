import type { StateCreator } from 'zustand';
import type { ConsoleState } from '../useConsoleStore';

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra' | 'custom';

export interface GraphicsSettings {
  preset: GraphicsPreset;
  resolutionScale: number;          // 0.5 – 2.0
  msaaSamples: 1 | 2 | 4 | 8;       // 1 = disabled
  fxaa: boolean;
  maximumScreenSpaceError: number;  // 1.0 (sharp) – 8.0 (coarse)
  showSkyBox: boolean;              // stars
  showSkyAtmosphere: boolean;       // sky glow on the horizon
  showSun: boolean;
  showMoon: boolean;
  showGroundAtmosphere: boolean;
  enableFog: boolean;
  depthTestAgainstTerrain: boolean;
  tileCacheSize: number;            // 20 – 200
  polylinePoints: number;           // 500 – 10000 (orbit/track render cap)
}

const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

// Preset definitions. `custom` is not in here — it's what we switch to when the
// user touches an individual control after picking a preset.
export const GRAPHICS_PRESETS: Record<Exclude<GraphicsPreset, 'custom'>, Omit<GraphicsSettings, 'preset'>> = {
  low: {
    resolutionScale: 1.0,
    msaaSamples: 1,
    fxaa: false,
    maximumScreenSpaceError: 4.0,
    showSkyBox: false,
    showSkyAtmosphere: false,
    showSun: false,
    showMoon: false,
    showGroundAtmosphere: false,
    enableFog: false,
    depthTestAgainstTerrain: false,
    tileCacheSize: 30,
    polylinePoints: 500,
  },
  medium: {
    resolutionScale: 1.0,
    msaaSamples: 2,
    fxaa: true,
    maximumScreenSpaceError: 2.5,
    showSkyBox: true,
    showSkyAtmosphere: true,
    showSun: true,
    showMoon: true,
    showGroundAtmosphere: false,
    enableFog: false,
    depthTestAgainstTerrain: false,
    tileCacheSize: 40,
    polylinePoints: 1000,
  },
  high: {
    resolutionScale: Math.min(dpr, 1.5),
    msaaSamples: 4,
    fxaa: true,
    maximumScreenSpaceError: 2.0,
    showSkyBox: true,
    showSkyAtmosphere: true,
    showSun: true,
    showMoon: true,
    showGroundAtmosphere: true,
    enableFog: false,
    depthTestAgainstTerrain: true,
    tileCacheSize: 60,
    polylinePoints: 2000,
  },
  ultra: {
    resolutionScale: Math.min(dpr, 2.0),
    msaaSamples: 8,
    fxaa: true,
    maximumScreenSpaceError: 1.5,
    showSkyBox: true,
    showSkyAtmosphere: true,
    showSun: true,
    showMoon: true,
    showGroundAtmosphere: true,
    enableFog: true,
    depthTestAgainstTerrain: true,
    tileCacheSize: 100,
    polylinePoints: 5000,
  },
};

const STORAGE_KEY = 'trsat.graphicsSettings.v1';

function loadInitial(): GraphicsSettings {
  const fallback: GraphicsSettings = { preset: 'ultra', ...GRAPHICS_PRESETS.ultra };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    // Upgrade: if stored preset is 'high' or lower, promote to 'ultra' (RTX 4060).
    if (!parsed.preset || parsed.preset === 'high' || parsed.preset === 'medium' || parsed.preset === 'low') {
      return fallback;
    }
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function persist(settings: GraphicsSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota or private mode — non-fatal.
  }
}

export const createGraphicsSlice: StateCreator<
  ConsoleState,
  [],
  [],
  Pick<
    ConsoleState,
    | 'graphics'
    | 'setGraphicsPreset'
    | 'updateGraphicsSetting'
    | 'resetGraphicsToDefaults'
  >
> = (set, _get) => {
  const initial = loadInitial();
  return {
    graphics: initial,

    setGraphicsPreset: (preset) => set((state) => {
      const next: GraphicsSettings =
        preset === 'custom'
          ? { ...state.graphics, preset: 'custom' }
          : { preset, ...GRAPHICS_PRESETS[preset] };
      persist(next);
      return {
        graphics: next,
        logs: [...state.logs, `Graphics: preset switched to ${preset.toUpperCase()}.`]
      };
    }),

    // Generic single-field setter — flips the preset to `custom` so the UI
    // honestly reflects that the active config no longer matches any preset.
    updateGraphicsSetting: (key, value) => set((state) => {
      const next: GraphicsSettings = {
        ...state.graphics,
        [key]: value,
        preset: 'custom',
      } as GraphicsSettings;
      persist(next);
      return { graphics: next };
    }),

    resetGraphicsToDefaults: () => set((state) => {
      const next: GraphicsSettings = { preset: 'ultra', ...GRAPHICS_PRESETS.ultra };
      persist(next);
      return {
        graphics: next,
        logs: [...state.logs, `Graphics: reset to ULTRA preset.`]
      };
    }),
  };
};
