import React, { useState } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import type { GraphicsPreset, GraphicsSettings } from '../../store/slices/graphicsSlice';
import { useTranslation } from '../../i18n/useTranslation';

const PRESET_OPTIONS: { id: Exclude<GraphicsPreset, 'custom'>; labelKey: string; descKey: string }[] = [
  { id: 'low',    labelKey: 'graphics.preset_low',    descKey: 'graphics.preset_low_desc' },
  { id: 'medium', labelKey: 'graphics.preset_medium', descKey: 'graphics.preset_medium_desc' },
  { id: 'high',   labelKey: 'graphics.preset_high',   descKey: 'graphics.preset_high_desc' },
  { id: 'ultra',  labelKey: 'graphics.preset_ultra',  descKey: 'graphics.preset_ultra_desc' },
];

const MSAA_OPTIONS: GraphicsSettings['msaaSamples'][] = [1, 2, 4, 8];

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  cursor: 'pointer',
  fontSize: '11px',
};

const sliderRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  fontSize: '11px',
};

const sectionDividerStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border-color)',
  paddingTop: '8px',
  marginTop: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

export const GraphicsSettingsPanel: React.FC = () => {
  const graphics = useConsoleStore(s => s.graphics);
  const setPreset = useConsoleStore(s => s.setGraphicsPreset);
  const update = useConsoleStore(s => s.updateGraphicsSetting);
  const reset = useConsoleStore(s => s.resetGraphicsToDefaults);
  const { t } = useTranslation();

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const presetCard = (id: Exclude<GraphicsPreset, 'custom'>, labelKey: string, descKey: string) => {
    const active = graphics.preset === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setPreset(id)}
        style={{
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid',
          borderColor: active ? 'var(--accent-cyan)' : 'var(--border-color)',
          backgroundColor: active ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.01)',
          color: active ? 'var(--text-bright)' : 'var(--text-muted)',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 600 }}>{t(labelKey)}</div>
        <div style={{ fontSize: '9px', opacity: 0.85 }}>{t(descKey)}</div>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-bright)' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {t('graphics.section_title')}
      </div>

      {/* Preset cards (2x2 grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {PRESET_OPTIONS.map(o => presetCard(o.id, o.labelKey, o.descKey))}
      </div>

      {/* Custom-mode indicator */}
      {graphics.preset === 'custom' && (
        <div style={{
          fontSize: '10px',
          color: 'var(--accent-orange)',
          backgroundColor: 'rgba(249, 115, 22, 0.06)',
          border: '1px solid rgba(249, 115, 22, 0.25)',
          padding: '6px 8px',
          borderRadius: '4px'
        }}>
          {t('graphics.custom_active')}
        </div>
      )}

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setAdvancedOpen(v => !v)}
        style={{
          background: 'transparent',
          border: '1px solid var(--border-color)',
          color: 'var(--text-bright)',
          padding: '6px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {advancedOpen ? '▾ ' : '▸ '}{t('graphics.advanced')}
      </button>

      {advancedOpen && (
        <div style={sectionDividerStyle}>
          {/* Resolution */}
          <div style={sliderRowStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('graphics.resolution_scale')}</span>
              <span className="mono-text" style={{ color: 'var(--accent-cyan)' }}>×{graphics.resolutionScale.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={graphics.resolutionScale}
              onChange={(e) => update('resolutionScale', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>

          {/* MSAA */}
          <div style={sliderRowStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('graphics.msaa')}</span>
              <span className="mono-text" style={{ color: 'var(--accent-cyan)' }}>
                {graphics.msaaSamples === 1 ? t('graphics.off') : `${graphics.msaaSamples}×`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {MSAA_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update('msaaSamples', n)}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    borderRadius: '3px',
                    border: '1px solid',
                    borderColor: graphics.msaaSamples === n ? 'var(--accent-cyan)' : 'var(--border-color)',
                    backgroundColor: graphics.msaaSamples === n ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                    color: graphics.msaaSamples === n ? 'var(--text-bright)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '10px',
                  }}
                >
                  {n === 1 ? t('graphics.off') : `${n}×`}
                </button>
              ))}
            </div>
          </div>

          {/* Screen-space error (terrain detail) */}
          <div style={sliderRowStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('graphics.tile_detail')}</span>
              <span className="mono-text" style={{ color: 'var(--accent-cyan)' }}>{graphics.maximumScreenSpaceError.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={8.0}
              step={0.5}
              value={graphics.maximumScreenSpaceError}
              // Higher SSE value = coarser tiles. We invert the visual so leftmost = sharpest.
              onChange={(e) => update('maximumScreenSpaceError', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('graphics.sharper')}</span>
              <span>{t('graphics.coarser')}</span>
            </div>
          </div>

          {/* Polyline point cap */}
          <div style={sliderRowStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('graphics.polyline_points')}</span>
              <span className="mono-text" style={{ color: 'var(--accent-cyan)' }}>{graphics.polylinePoints}</span>
            </div>
            <input
              type="range"
              min={300}
              max={5000}
              step={100}
              value={graphics.polylinePoints}
              onChange={(e) => update('polylinePoints', parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>

          {/* Tile cache */}
          <div style={sliderRowStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('graphics.tile_cache')}</span>
              <span className="mono-text" style={{ color: 'var(--accent-cyan)' }}>{graphics.tileCacheSize}</span>
            </div>
            <input
              type="range"
              min={20}
              max={200}
              step={10}
              value={graphics.tileCacheSize}
              onChange={(e) => update('tileCacheSize', parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>

          {/* Toggles */}
          <label style={labelStyle}>
            <span>{t('graphics.fxaa')}</span>
            <input type="checkbox" checked={graphics.fxaa} onChange={(e) => update('fxaa', e.target.checked)} style={{ accentColor: 'var(--accent-cyan)' }} />
          </label>
          <label style={labelStyle}>
            <span>{t('graphics.sky_atmosphere')}</span>
            <input type="checkbox" checked={graphics.showSkyAtmosphere} onChange={(e) => update('showSkyAtmosphere', e.target.checked)} style={{ accentColor: 'var(--accent-cyan)' }} />
          </label>
          <label style={labelStyle}>
            <span>{t('graphics.sky_box')}</span>
            <input type="checkbox" checked={graphics.showSkyBox} onChange={(e) => update('showSkyBox', e.target.checked)} style={{ accentColor: 'var(--accent-cyan)' }} />
          </label>
          <label style={labelStyle}>
            <span>{t('graphics.sun')}</span>
            <input type="checkbox" checked={graphics.showSun} onChange={(e) => update('showSun', e.target.checked)} style={{ accentColor: 'var(--accent-cyan)' }} />
          </label>
          <label style={labelStyle}>
            <span>{t('graphics.moon')}</span>
            <input type="checkbox" checked={graphics.showMoon} onChange={(e) => update('showMoon', e.target.checked)} style={{ accentColor: 'var(--accent-cyan)' }} />
          </label>
          <label style={labelStyle}>
            <span>{t('graphics.ground_atmosphere')}</span>
            <input type="checkbox" checked={graphics.showGroundAtmosphere} onChange={(e) => update('showGroundAtmosphere', e.target.checked)} style={{ accentColor: 'var(--accent-cyan)' }} />
          </label>
          <label style={labelStyle}>
            <span>{t('graphics.fog')}</span>
            <input type="checkbox" checked={graphics.enableFog} onChange={(e) => update('enableFog', e.target.checked)} style={{ accentColor: 'var(--accent-cyan)' }} />
          </label>
          <label style={labelStyle}>
            <span>{t('graphics.terrain_depth')}</span>
            <input type="checkbox" checked={graphics.depthTestAgainstTerrain} onChange={(e) => update('depthTestAgainstTerrain', e.target.checked)} style={{ accentColor: 'var(--accent-cyan)' }} />
          </label>

          {/* Reset */}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid var(--accent-orange)',
              backgroundColor: 'transparent',
              color: 'var(--accent-orange)',
              cursor: 'pointer',
              fontSize: '11px',
              marginTop: '4px',
            }}
          >
            {t('graphics.reset')}
          </button>
        </div>
      )}
    </div>
  );
};
