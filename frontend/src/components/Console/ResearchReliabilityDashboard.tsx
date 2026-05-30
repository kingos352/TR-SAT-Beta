import React, { useEffect } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { DonutChart } from './Charts/DonutChart';
import { HistogramChart } from './Charts/HistogramChart';
import { useTranslation } from '../../i18n/useTranslation';

const ResearchReliabilityDashboardInner: React.FC = () => {
  const reliabilitySummary = useConsoleStore(s => s.reliabilitySummary);
  const activeObjectReliability = useConsoleStore(s => s.activeObjectReliability);
  const reliabilityLoading = useConsoleStore(s => s.reliabilityLoading);
  const reliabilityError = useConsoleStore(s => s.reliabilityError);
  const fetchReliabilitySummary = useConsoleStore(s => s.fetchReliabilitySummary);
  const activeObject = useConsoleStore(s => s.activeObject);
  const { t } = useTranslation();

  useEffect(() => {
    fetchReliabilitySummary();
  }, [fetchReliabilitySummary]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button 
          onClick={() => fetchReliabilitySummary()}
          disabled={reliabilityLoading}
          style={{
            background: 'var(--accent-cyan)',
            color: 'var(--bg-space-dark)',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: reliabilityLoading ? 'wait' : 'pointer',
            opacity: reliabilityLoading ? 0.7 : 1
          }}
        >
          {reliabilityLoading ? t('reliability.analyzing') : t('reliability.refresh')}
        </button>
      </div>

      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        padding: '12px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        fontStyle: 'italic',
        lineHeight: 1.4
      }}>
        {t('reliability.disclaimer')}
      </div>

      {reliabilityError && (
        <div style={{ color: 'var(--accent-orange)', fontSize: '12px', padding: '8px', border: '1px solid var(--accent-orange)', borderRadius: '4px' }}>
          {reliabilityError}
        </div>
      )}

      {reliabilitySummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <MetricCard label={t('reliability.average_age')} value={reliabilitySummary.average_age_days?.toFixed(2) || 'N/A'} color="var(--accent-cyan)" />
            <MetricCard label={t('reliability.median_age')} value={reliabilitySummary.median_age_days?.toFixed(2) || 'N/A'} color="#8B5CF6" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="chart-card">
              <h3 className="chart-title">{t('reliability.freshness_distribution')}</h3>
              <DonutChart 
                data={[
                  { label: t('reliability.fresh'), value: reliabilitySummary.fresh_count, color: '#10B981' },
                  { label: t('reliability.aging'), value: reliabilitySummary.aging_count, color: '#F59E0B' },
                  { label: t('reliability.stale'), value: reliabilitySummary.stale_count, color: 'var(--accent-orange)' },
                  { label: t('reliability.unknown'), value: reliabilitySummary.unknown_count, color: '#6B7280' }
                ].filter(d => d.value > 0)}
                size={90}
                holeSize={50}
              />
            </div>
            
            <div className="chart-card">
              <h3 className="chart-title">{t('reliability.age_histogram')}</h3>
              <HistogramChart data={reliabilitySummary.age_histogram} color="#3B82F6" />
            </div>
          </div>
        </div>
      )}

      {activeObject && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <h3 className="chart-title" style={{ marginBottom: '12px' }}>{t('reliability.active_object_reliability')}</h3>
          
          {reliabilityLoading && !activeObjectReliability ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('reliability.loading')}</div>
          ) : activeObjectReliability ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('reliability.norad_id')}</span>
                <span className="mono-text" style={{ color: 'var(--text-bright)' }}>{activeObjectReliability.norad_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('reliability.epoch')}</span>
                <span className="mono-text" style={{ color: 'var(--text-bright)' }}>{activeObjectReliability.tle_epoch_utc}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('reliability.age_days')}</span>
                <span className="mono-text" style={{ color: 'var(--text-bright)' }}>{activeObjectReliability.tle_age_days.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('reliability.label')}</span>
                <span style={{ 
                  color: activeObjectReliability.reliability_label === 'FRESH' ? '#10B981' : 
                         activeObjectReliability.reliability_label === 'AGING' ? '#F59E0B' : 
                         activeObjectReliability.reliability_label === 'STALE' ? 'var(--accent-orange)' : '#6B7280',
                  fontWeight: 'bold'
                }}>
                  {t(`reliability.${activeObjectReliability.reliability_label.toLowerCase()}`)}
                </span>
              </div>
              
              {activeObjectReliability.warnings && activeObjectReliability.warnings.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ color: 'var(--accent-orange)', marginBottom: '4px' }}>{t('reliability.warnings')}</div>
                  <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-muted)' }}>
                    {activeObjectReliability.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('reliability.no_data')}</div>
          )}
        </div>
      )}

    </div>
  );
};

export const ResearchReliabilityDashboard = React.memo(ResearchReliabilityDashboardInner);

const MetricCard: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
  <div style={{
    backgroundColor: 'rgba(0,0,0,0.2)',
    border: `1px solid ${color}40`,
    borderRadius: '6px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    borderLeft: `3px solid ${color}`
  }}>
    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
    <div className="mono-text" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-bright)' }}>{value}</div>
  </div>
);
