import React, { useState } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { screenConjunction, ConjunctionScreenRequest, screenDebrisWatch } from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';
import { SkeletonCard } from './Skeleton';

const ConjunctionPanelInner: React.FC = () => {
  const selectedObjects = useConsoleStore(s => s.selectedObjects);
  const activeObject = useConsoleStore(s => s.activeObject);
  const setConjunctionResults = useConsoleStore(s => s.setConjunctionResults);
  const conjunctionResults = useConsoleStore(s => s.conjunctionResults);
  const setActiveConjunctionResult = useConsoleStore(s => s.setActiveConjunctionResult);
  const addLog = useConsoleStore(s => s.addLog);
  const { t } = useTranslation();

  // Reframe backend risk levels into experimental, non-operational language.
  const riskLabel = (level?: string | null): string => {
    if (level === 'HIGH') return t('conjunction.risk_high');
    if (level === 'MEDIUM') return t('conjunction.risk_medium');
    if (level === 'LOW') return t('conjunction.risk_low');
    return level ?? '—';
  };
  
  const [mode, setMode] = useState<'selected_vs_selected' | 'primary_vs_catalog' | 'primary_vs_debris'>('selected_vs_selected');
  const [horizonDays, setHorizonDays] = useState(3);
  const [coarseStep, setCoarseStep] = useState(60);
  const [refineStep, setRefineStep] = useState(1);
  const [includeRocketBodies, setIncludeRocketBodies] = useState(false);
  const [sortBy, setSortBy] = useState<'pc' | 'distance'>('pc');
  const [loading, setLoading] = useState(false);
  const [debrisWatchLoading, setDebrisWatchLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const handleScreen = async () => {
    if (!activeObject) {
      addLog('Conjunction: No active primary object selected.');
      return;
    }
    
    setLoading(true);
    setConjunctionResults([]);
    setActiveConjunctionResult(null);
    
    const now = new Date();
    const end = new Date(now.getTime() + horizonDays * 86400 * 1000);
    
    const req: ConjunctionScreenRequest = {
      mode,
      primary_norad_ids: [activeObject.norad_id],
      start_time: now.toISOString(),
      end_time: end.toISOString(),
      coarse_step_seconds: coarseStep,
      refine_step_seconds: refineStep,
      max_candidates: 100,
    };

    if (mode === 'primary_vs_debris') {
      req.include_rocket_bodies = includeRocketBodies;
    }

    if (mode === 'selected_vs_selected') {
      const secondaryIds = selectedObjects
        .map(o => o.norad_id)
        .filter(id => id !== activeObject.norad_id);
        
      if (secondaryIds.length === 0) {
        addLog('Conjunction: No secondary objects available in selected list.');
        setLoading(false);
        return;
      }
      req.secondary_norad_ids = secondaryIds;
    }
    
    try {
      addLog(`Conjunction: Initiating screening for NORAD ${activeObject.norad_id} over ${horizonDays} days...`);
      const res = await screenConjunction(req);
      setConjunctionResults(res.results);
      addLog(`Conjunction: Screening completed in ${res.computation_time_ms.toFixed(0)}ms. Found ${res.results.length} events.`);
    } catch (err: any) {
      addLog(`ERROR Conjunction: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Catalog-wide debris scan — runs without any selected object.
  const handleDebrisWatch = async () => {
    setDebrisWatchLoading(true);
    setConjunctionResults([]);
    setActiveConjunctionResult(null);

    const now = new Date();
    const end = new Date(now.getTime() + horizonDays * 86400 * 1000);

    try {
      addLog(`Debris Watch: Scanning the catalog for the highest-risk debris conjunctions over ${horizonDays} day(s)... (heavy scan, may take ~10-30s)`);
      const res = await screenDebrisWatch({
        start_time: now.toISOString(),
        end_time: end.toISOString(),
        coarse_step_seconds: coarseStep,
        refine_step_seconds: refineStep,
        include_rocket_bodies: includeRocketBodies,
      });
      setConjunctionResults(res.results);
      addLog(`Debris Watch: Completed in ${res.computation_time_ms.toFixed(0)}ms. Found ${res.results.length} candidate conjunctions.`);
    } catch (err: any) {
      addLog(`ERROR Debris Watch: ${err.message}`);
    } finally {
      setDebrisWatchLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      <details style={{
        fontSize: '10px',
        color: 'var(--text-muted)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        padding: '6px 8px'
      }}>
        <summary style={{ cursor: 'pointer', outline: 'none', fontWeight: 600 }}>
          {t('conjunction.warning_title')}
        </summary>
        <div style={{ marginTop: '6px', lineHeight: '1.4' }}>
          {t('conjunction.warning_body')}
        </div>
      </details>
      
      <div style={{ background: 'var(--bg-panel-soft)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
        <div 
          onClick={() => setSettingsOpen(!settingsOpen)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('conjunction.parameters')}</span>
          <span style={{ color: 'var(--text-muted)' }}>{settingsOpen ? '▼' : '▶'}</span>
        </div>
        {settingsOpen && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', marginTop: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ color: 'var(--text-muted)' }}>{t('conjunction.mode')}</label>
              <select 
                value={mode} 
                onChange={e => setMode(e.target.value as any)}
                style={{ 
                  backgroundColor: 'rgba(0,0,0,0.3)', 
                  color: 'var(--text-bright)', 
                  border: '1px solid var(--border-color)', 
                  padding: '4px', 
                  borderRadius: 'var(--radius-sm)' 
                }}
              >
                <option value="selected_vs_selected">{t('conjunction.mode_selected')}</option>
                <option value="primary_vs_catalog">{t('conjunction.mode_catalog')}</option>
                <option value="primary_vs_debris">{t('conjunction.mode_debris')}</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ color: 'var(--text-muted)' }}>{t('conjunction.horizon')}</label>
              <input 
                type="number" 
                value={horizonDays} 
                onChange={e => setHorizonDays(Number(e.target.value))}
                min={1} max={7}
                style={{ 
                  backgroundColor: 'rgba(0,0,0,0.3)', 
                  color: 'var(--text-bright)', 
                  border: '1px solid var(--border-color)', 
                  padding: '4px', 
                  borderRadius: 'var(--radius-sm)' 
                }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ color: 'var(--text-muted)' }}>{t('conjunction.coarse_step')}</label>
              <input 
                type="number" 
                value={coarseStep} 
                onChange={e => setCoarseStep(Number(e.target.value))}
                min={10} max={300}
                style={{ 
                  backgroundColor: 'rgba(0,0,0,0.3)', 
                  color: 'var(--text-bright)', 
                  border: '1px solid var(--border-color)', 
                  padding: '4px', 
                  borderRadius: 'var(--radius-sm)' 
                }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ color: 'var(--text-muted)' }}>{t('conjunction.refine_step')}</label>
              <input 
                type="number" 
                value={refineStep} 
                onChange={e => setRefineStep(Number(e.target.value))}
                min={0.1} max={5} step={0.1}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  color: 'var(--text-bright)',
                  border: '1px solid var(--border-color)',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </div>

            {mode === 'primary_vs_debris' && (
              <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeRocketBodies}
                  onChange={e => setIncludeRocketBodies(e.target.checked)}
                />
                {t('conjunction.include_rocket_bodies')}
              </label>
            )}
          </div>
        )}
      </div>
      
      <button 
        onClick={handleScreen}
        disabled={loading || !activeObject}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          backgroundColor: !activeObject ? 'rgba(75, 85, 99, 0.5)' : 'var(--accent-cyan)',
          color: 'var(--text-bright)',
          fontSize: '12px',
          fontWeight: 600,
          cursor: (!activeObject || loading) ? 'not-allowed' : 'pointer',
          marginTop: '4px'
        }}
      >
        {loading ? t('conjunction.screening') : t('conjunction.run_screen')}
      </button>

      <div style={{
        backgroundColor: 'rgba(244, 63, 94, 0.06)',
        border: '1px solid rgba(244, 63, 94, 0.4)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-red)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('conjunction.debris_watch_title')}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {t('conjunction.debris_watch_note')}
        </div>
        <button
          onClick={handleDebrisWatch}
          disabled={debrisWatchLoading}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            backgroundColor: debrisWatchLoading ? 'rgba(75, 85, 99, 0.5)' : 'var(--accent-red)',
            color: 'var(--text-bright)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: debrisWatchLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {debrisWatchLoading ? t('conjunction.debris_watch_scanning') : t('conjunction.debris_watch_scan')}
        </button>
      </div>

      {(loading || debrisWatchLoading) && conjunctionResults.length === 0 && (
        <div style={{ marginTop: '8px' }}>
          <SkeletonCard rows={3} />
        </div>
      )}

      {conjunctionResults.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
              {t('conjunction.results')} ({conjunctionResults.length})
            </h3>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'pc' | 'distance')}
              style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: 'var(--text-bright)', border: '1px solid var(--border-color)', padding: '2px 4px', borderRadius: 'var(--radius-sm)', fontSize: '10px' }}
            >
              <option value="pc">{t('conjunction.sort_by')}: {t('conjunction.sort_pc')}</option>
              <option value="distance">{t('conjunction.sort_by')}: {t('conjunction.sort_distance')}</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
            {[...conjunctionResults].sort((a, b) =>
              sortBy === 'pc'
                ? (b.collision_probability ?? 0) - (a.collision_probability ?? 0)
                : a.miss_distance_km - b.miss_distance_km
            ).map((res, idx) => {
              const relSpeed = res.relative_speed_km_per_s ?? 0;
              const pc = res.collision_probability;

              let riskColor = 'var(--text-muted)';
              if (res.risk_level === 'HIGH') riskColor = 'var(--accent-red)';
              else if (res.risk_level === 'MEDIUM') riskColor = 'var(--accent-orange)';
              else if (res.risk_level === 'LOW') riskColor = 'var(--accent-cyan)';

              return (
                <div
                  key={idx}
                  onClick={() => setActiveConjunctionResult(res)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid',
                    borderColor: riskColor,
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                  className="mono-text"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: riskColor, fontWeight: 600, marginBottom: '2px' }}>
                    <span>{riskLabel(res.risk_level ?? res.severity)}</span>
                    <span>{t('conjunction.pc')} {pc != null ? pc.toExponential(2) : '—'}</span>
                  </div>
                  <div style={{ color: 'var(--text-bright)' }}>{t('conjunction.tca')} {res.tca_time.replace('T', ' ').substring(0, 19)}</div>
                  <div style={{ color: 'var(--text-muted)' }}>P: {res.primary_norad_id} | S: {res.secondary_norad_id}{res.secondary_object_type ? ` (${res.secondary_object_type})` : ''}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>{res.miss_distance_km.toFixed(2)} km</span>
                    <span>{t('conjunction.rel_speed')} {relSpeed.toFixed(2)} km/s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const ConjunctionPanel = React.memo(ConjunctionPanelInner);
