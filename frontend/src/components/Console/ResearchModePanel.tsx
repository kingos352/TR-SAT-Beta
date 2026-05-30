import React, { useEffect } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { LineChart } from './Charts/LineChart';
import { useTranslation } from '../../i18n/useTranslation';
import { ConjunctionResult } from '../../api/client';

const riskColor = (risk?: string): string => {
  if (risk === 'HIGH') return 'var(--accent-red)';
  if (risk === 'MEDIUM') return 'var(--accent-orange)';
  if (risk === 'LOW') return 'var(--accent-cyan)';
  return 'var(--text-muted)';
};

// 2-D encounter plane (B-plane): the miss point, the hard-body disk at the
// origin and the 1σ uncertainty ellipse, perpendicular to the relative velocity.
const EncounterPlaneDiagram: React.FC<{ res: ConjunctionResult }> = ({ res }) => {
  const cov = res.covariance_2d_km2;
  if (!cov) return null;
  const mx = res.miss_x_km ?? 0;
  const my = res.miss_y_km ?? 0;
  const a = cov[0][0], b = cov[0][1], c = cov[1][1];
  const trace = (a + c) / 2;
  const disc = Math.sqrt(Math.max(0, ((a - c) / 2) ** 2 + b * b));
  const sMajor = Math.sqrt(Math.max(trace + disc, 0));   // 1σ semi-major (km)
  const sMinor = Math.sqrt(Math.max(trace - disc, 0));   // 1σ semi-minor (km)
  const angleDeg = 0.5 * Math.atan2(2 * b, a - c) * 180 / Math.PI;
  const hbrKm = (res.hard_body_radius_m ?? 0) / 1000;
  const missMag = Math.hypot(mx, my);

  const size = 240, margin = 22, half = size / 2;
  const ext = Math.max(missMag + 2 * sMajor, 3 * sMajor, hbrKm * 4, 0.5) * 1.15;
  const scale = (half - margin) / ext;
  const toX = (x: number) => half + x * scale;
  const toY = (y: number) => half - y * scale;
  const hbrPx = Math.max(hbrKm * scale, 3);

  return (
    <svg width={size} height={size} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '4px' }}>
      {/* axes */}
      <line x1={margin} y1={half} x2={size - margin} y2={half} stroke="rgba(255,255,255,0.12)" />
      <line x1={half} y1={margin} x2={half} y2={size - margin} stroke="rgba(255,255,255,0.12)" />
      {/* 1σ uncertainty ellipse at the miss point */}
      <g transform={`translate(${toX(mx)}, ${toY(my)}) rotate(${-angleDeg})`}>
        <ellipse rx={sMajor * scale} ry={sMinor * scale} fill="rgba(14,165,233,0.12)" stroke="#0ea5e9" strokeWidth={1} />
      </g>
      {/* hard-body disk at origin */}
      <circle cx={half} cy={half} r={hbrPx} fill="rgba(244,63,94,0.25)" stroke="#f43f5e" strokeWidth={1} />
      {/* miss vector */}
      <line x1={half} y1={half} x2={toX(mx)} y2={toY(my)} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 2" />
      {/* miss point */}
      <circle cx={toX(mx)} cy={toY(my)} r={3} fill="#0ea5e9" />
    </svg>
  );
};

const ResearchModePanelInner: React.FC = () => {
  const activeObject = useConsoleStore(s => s.activeObject);
  const tleHistory = useConsoleStore(s => s.tleHistory);
  const decayIndicators = useConsoleStore(s => s.decayIndicators);
  const illuminationState = useConsoleStore(s => s.illuminationState);
  const relativeMotionResult = useConsoleStore(s => s.relativeMotionResult);
  const researchLoading = useConsoleStore(s => s.researchLoading);
  const fetchTLEHistory = useConsoleStore(s => s.fetchTLEHistory);
  const fetchDecayIndicators = useConsoleStore(s => s.fetchDecayIndicators);
  const fetchIllumination = useConsoleStore(s => s.fetchIllumination);
  const fetchRelativeMotion = useConsoleStore(s => s.fetchRelativeMotion);
  const activeConjunctionResult = useConsoleStore(s => s.activeConjunctionResult);
  const { t } = useTranslation();

  useEffect(() => {
    if (activeObject && activeObject.norad_id >= 0) {
      fetchTLEHistory(activeObject.norad_id);
      fetchDecayIndicators(activeObject.norad_id);
      const now = new Date().toISOString();
      fetchIllumination(activeObject.norad_id, now);
    }
  }, [activeObject]);

  useEffect(() => {
    if (activeConjunctionResult && activeConjunctionResult.tca_time) {
      fetchRelativeMotion(
        activeConjunctionResult.primary_norad_id,
        activeConjunctionResult.secondary_norad_id,
        activeConjunctionResult.tca_time
      );
    }
  }, [activeConjunctionResult]);

  if (!activeObject) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        <p>{t('research.select_object')}</p>
      </div>
    );
  }

  // Formatting data for chart
  const mmData = tleHistory.map((pt, i) => ({ x: i, y: pt.mean_motion }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'var(--text-bright)', fontWeight: 500 }}>{t('research.target')} {activeObject.name} ({activeObject.norad_id})</div>
        {researchLoading && <span style={{ color: 'var(--accent-cyan)', fontSize: '10px', fontWeight: 600 }}>{t('research.computing')}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Illumination State */}
        <div>
          <h4 style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{t('research.illumination_state')}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{
              alignSelf: 'flex-start',
              padding: '4px 8px',
              borderRadius: '4px',
              fontWeight: 'bold',
              fontSize: '11px',
              letterSpacing: '0.05em',
              backgroundColor: illuminationState === 'SUNLIT' ? 'rgba(245, 158, 11, 0.12)' :
                               illuminationState === 'EARTH_SHADOW' ? 'rgba(99, 102, 241, 0.12)' :
                               'rgba(255, 255, 255, 0.05)',
              color: illuminationState === 'SUNLIT' ? '#f59e0b' :
                     illuminationState === 'EARTH_SHADOW' ? '#818cf8' :
                     'var(--text-muted)',
              border: '1px solid',
              borderColor: illuminationState === 'SUNLIT' ? 'rgba(245, 158, 11, 0.3)' :
                           illuminationState === 'EARTH_SHADOW' ? 'rgba(99, 102, 241, 0.3)' :
                           'var(--border-color)'
            }}>
              {illuminationState || 'UNKNOWN'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {t('research.illumination_warning')}
            </div>
          </div>
        </div>

        {/* Historical Evolution */}
        <div>
          <h4 style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{t('research.historical_evolution')}</h4>
          {tleHistory.length < 2 ? (
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '10px' }}>
              {t('research.insufficient_history')}
            </div>
          ) : (
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '6px', alignSelf: 'flex-start' }}>{t('research.mean_motion_trend')}</div>
              <LineChart data={mmData} width={340} height={120} color="#0ea5e9" xLabel="Epoch Seq" yLabel="MM" />
            </div>
          )}
        </div>

        {/* Decay Indicators */}
        {decayIndicators && (
          <div>
            <h4 style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{t('research.decay_indicators')}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '4px' }}>{t('research.mm_trend')}</div>
                <div className="mono-text" style={{ fontWeight: 600, fontSize: '12px', color: decayIndicators.mean_motion_trend && decayIndicators.mean_motion_trend > 0 ? '#f59e0b' : 'var(--text-bright)' }}>
                  {decayIndicators.mean_motion_trend !== null ? `+${decayIndicators.mean_motion_trend.toFixed(6)}` : 'N/A'}
                </div>
              </div>
              <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '4px' }}>{t('research.alt_trend')}</div>
                <div className="mono-text" style={{ fontWeight: 600, fontSize: '12px', color: decayIndicators.altitude_trend_km && decayIndicators.altitude_trend_km < 0 ? '#f43f5e' : 'var(--text-bright)' }}>
                  {decayIndicators.altitude_trend_km !== null ? `${decayIndicators.altitude_trend_km.toFixed(3)} km` : 'N/A'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', backgroundColor: 'rgba(0, 0, 0, 0.1)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '4px', lineHeight: 1.4 }}>
              {t('research.decay_warning')}
            </div>
          </div>
        )}

        {/* Relative Motion Around TCA */}
        {activeConjunctionResult && relativeMotionResult && (
          <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{t('research.relative_motion')}</h4>
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '4px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{t('research.speed_at_tca')}</span>
               <span className="mono-text" style={{ color: '#f43f5e', fontWeight: 'bold' }}>{relativeMotionResult.relative_speed_kmps.toFixed(3)} km/s</span>
            </div>
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '6px', alignSelf: 'flex-start' }}>{t('research.distance_vs_time')}</div>
               {relativeMotionResult.distance_curve.length > 0 && (
                 <LineChart 
                   data={relativeMotionResult.distance_curve.map((pt, i) => ({ x: i, y: pt.distance_km }))} 
                   width={340} 
                   height={120} 
                   color="#f43f5e" 
                   xLabel="Time Offset" 
                   yLabel="Dist(km)" 
                 />
               )}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>
              {t('research.relative_warning')}
            </div>
          </div>
        )}

        {/* Estimated Pc & Encounter Plane */}
        {activeConjunctionResult && activeConjunctionResult.covariance_2d_km2 && (
          <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{t('conjunction.encounter_plane')}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '4px' }}>{t('conjunction.pc')}</div>
                <div className="mono-text" style={{ fontWeight: 600, fontSize: '12px', color: riskColor(activeConjunctionResult.risk_level) }}>
                  {activeConjunctionResult.collision_probability != null ? activeConjunctionResult.collision_probability.toExponential(2) : 'N/A'}
                </div>
                <div style={{ color: riskColor(activeConjunctionResult.risk_level), fontSize: '9px', fontWeight: 600, marginTop: '2px' }}>{activeConjunctionResult.risk_level}</div>
              </div>
              <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '4px' }}>{t('conjunction.max_pc')} / {t('conjunction.hbr')}</div>
                <div className="mono-text" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-bright)' }}>
                  {activeConjunctionResult.max_collision_probability != null ? activeConjunctionResult.max_collision_probability.toExponential(2) : 'N/A'}
                </div>
                <div className="mono-text" style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '2px' }}>
                  {activeConjunctionResult.hard_body_radius_m != null ? `${activeConjunctionResult.hard_body_radius_m.toFixed(1)} m` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '4px' }}>
              <EncounterPlaneDiagram res={activeConjunctionResult} />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>
              {t('conjunction.encounter_plane_note')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ResearchModePanel = React.memo(ResearchModePanelInner);
