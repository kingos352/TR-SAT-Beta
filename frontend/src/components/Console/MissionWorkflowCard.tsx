import React, { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

export const MissionWorkflowCard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div style={{
      borderBottom: '1px solid var(--border-color)', 
      paddingBottom: '16px',
      marginBottom: '16px'
    }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <h2 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-bright)', margin: 0, fontWeight: 600 }}>
          {t('system.modules_overview')}
        </h2>
        <span style={{ color: 'var(--text-muted)' }}>{isOpen ? '▼' : '▶'}</span>
      </div>
      
      {isOpen && (
        <div style={{
          marginTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '10px',
          color: 'var(--text-muted)'
        }}>
          <div style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', marginTop: '4px', fontSize: '9px', textTransform: 'uppercase' }}>{t('system.left_dock')}</div>
          
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.catalog_intelligence')}:</strong> {t('system.search_catalog')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.observer_station_config')}:</strong> {t('system.observer_station')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.ground_station_visibility')}:</strong> {t('system.ground_station_visibility')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.globe_visualization')}:</strong> {t('system.globe_visualization')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.catalog_layer_snapshot')}:</strong> {t('system.catalog_layer')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.space_environment_dashboard')}:</strong> {t('system.space_environment')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.tle_reliability_dashboard')}:</strong> {t('system.tle_reliability')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.research_mode')}:</strong> {t('system.research_mode')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.data_sources_ingestion')}:</strong> {t('system.data_sources')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.export_system')}:</strong> {t('system.export_system')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.system_event_logs')}:</strong> {t('system.system_event_logs')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>•</span>
            <span><strong>{t('menus.mission_knowledge_assistant')}:</strong> {t('system.knowledge_assistant')}</span>
          </div>

          <div style={{ color: 'var(--accent-blue)', fontWeight: 'bold', marginTop: '8px', fontSize: '9px', textTransform: 'uppercase' }}>{t('system.right_dock')}</div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-blue)' }}>•</span>
            <span><strong>{t('menus.telemetry_orbital_state')}:</strong> {t('system.telemetry')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-blue)' }}>•</span>
            <span><strong>{t('menus.live_tracking')}:</strong> {t('system.live_tracking')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-blue)' }}>•</span>
            <span><strong>{t('menus.mission_replay')}:</strong> {t('system.mission_replay')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-blue)' }}>•</span>
            <span><strong>{t('menus.pass_timeline')}:</strong> {t('system.pass_timeline')}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--accent-blue)' }}>•</span>
            <span><strong>{t('menus.conjunction_analysis')}:</strong> {t('system.conjunction')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
