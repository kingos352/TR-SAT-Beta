import React, { useEffect } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { MiniBarChart } from './Charts/MiniBarChart';
import { DonutChart } from './Charts/DonutChart';
import { HistogramChart } from './Charts/HistogramChart';
import { useTranslation } from '../../i18n/useTranslation';

const SpaceEnvironmentDashboardInner: React.FC = () => {
  const catalogAnalyticsSummary = useConsoleStore(s => s.catalogAnalyticsSummary);
  const analyticsLoading = useConsoleStore(s => s.analyticsLoading);
  const analyticsError = useConsoleStore(s => s.analyticsError);
  const fetchCatalogAnalytics = useConsoleStore(s => s.fetchCatalogAnalytics);
  const { t } = useTranslation();

  useEffect(() => {
    // Initial fetch if we don't have it
    if (!catalogAnalyticsSummary && !analyticsLoading) {
      fetchCatalogAnalytics();
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button 
          onClick={() => fetchCatalogAnalytics()}
          disabled={analyticsLoading}
          style={{
            background: 'var(--accent-cyan)',
            color: 'var(--bg-space-dark)',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: analyticsLoading ? 'wait' : 'pointer',
            opacity: analyticsLoading ? 0.7 : 1
          }}
        >
          {analyticsLoading ? t('analytics.analyzing') : t('analytics.refresh')}
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
        {catalogAnalyticsSummary ? catalogAnalyticsSummary.disclaimer : t('analytics.disclaimer')}
      </div>

      {analyticsError && (
        <div style={{ color: 'var(--accent-orange)', fontSize: '12px', padding: '8px', border: '1px solid var(--accent-orange)', borderRadius: '4px' }}>
          {analyticsError}
        </div>
      )}

      {catalogAnalyticsSummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <MetricCard label={t('analytics.total_objects')} value={catalogAnalyticsSummary.total_objects.toLocaleString()} color="var(--accent-cyan)" />
            <MetricCard label={t('analytics.payloads')} value={catalogAnalyticsSummary.by_object_type['PAYLOAD']?.toLocaleString() || '0'} color="#10B981" />
            <MetricCard label={t('analytics.debris')} value={catalogAnalyticsSummary.by_object_type['DEBRIS']?.toLocaleString() || '0'} color="var(--accent-orange)" />
            <MetricCard label={t('analytics.stale_tle')} value={`${catalogAnalyticsSummary.stale_percentage.toFixed(1)}%`} color="#EF4444" />
          </div>

          {/* Charts Row 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="chart-card">
              <h3 className="chart-title">{t('analytics.object_type_distribution')}</h3>
              <DonutChart 
                data={Object.entries(catalogAnalyticsSummary.by_object_type).map(([k, v]) => ({
                  label: k,
                  value: v,
                  color: k === 'PAYLOAD' ? '#10B981' : k === 'DEBRIS' ? 'var(--accent-orange)' : k === 'ROCKET BODY' ? '#8B5CF6' : '#6B7280'
                }))}
                size={90}
                holeSize={50}
              />
            </div>
            
            <div className="chart-card">
              <h3 className="chart-title">{t('analytics.orbital_regime')}</h3>
              <DonutChart 
                data={Object.entries(catalogAnalyticsSummary.by_orbital_regime)
                  .filter(([_, v]) => v > 0)
                  .map(([k, v]) => ({
                  label: k,
                  value: v,
                  color: k === 'LEO' ? 'var(--accent-cyan)' : k === 'MEO' ? '#3B82F6' : k === 'GEO' ? '#8B5CF6' : k === 'HEO' ? '#F59E0B' : '#6B7280'
                }))}
                size={90}
                holeSize={50}
              />
            </div>
          </div>

          {/* Charts Row 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="chart-card">
              <h3 className="chart-title">{t('analytics.altitude_distribution')}</h3>
              <HistogramChart data={catalogAnalyticsSummary.altitude_bins} color="var(--accent-cyan)" />
            </div>

            <div className="chart-card">
              <h3 className="chart-title">{t('analytics.inclination_distribution')}</h3>
              <HistogramChart data={catalogAnalyticsSummary.inclination_bins} color="#8B5CF6" />
            </div>
          </div>

          {/* Sources */}
          <div className="chart-card">
            <h3 className="chart-title">{t('analytics.source_coverage')}</h3>
            <MiniBarChart 
              data={Object.entries(catalogAnalyticsSummary.by_source).map(([k, v]) => ({ label: k, value: v }))} 
              color="#10B981"
            />
          </div>

        </div>
      )}
    </div>
  );
};

export const SpaceEnvironmentDashboard = React.memo(SpaceEnvironmentDashboardInner);

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
