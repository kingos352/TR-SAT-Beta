import React from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { 
  exportEphemerisCSV, 
  exportConjunctionsCSV, 
  exportCatalogCSV, 
  exportGroundTrackGeoJSON, 
  exportCatalogGeoJSON, 
  exportTrajectoryCZML, 
  exportMissionReport 
} from '../../utils/exportSystem';
import { useTranslation } from '../../i18n/useTranslation';

const ExportPanelInner: React.FC = () => {
  const activeObject = useConsoleStore(s => s.activeObject);
  const activeEphemeris = useConsoleStore(s => s.activeEphemeris);
  const activeState = useConsoleStore(s => s.activeState);
  const activePasses = useConsoleStore(s => s.activePasses);
  const conjunctionResults = useConsoleStore(s => s.conjunctionResults);
  const catalogLayerObjects = useConsoleStore(s => s.catalogLayerObjects);
  const addLog = useConsoleStore(s => s.addLog);
  const { t } = useTranslation();

  const handleExportEphemerisCSV = () => {
    if (!activeObject || !activeEphemeris || activeEphemeris.length === 0) {
      addLog("Export Error: Update Orbit before exporting ephemeris.");
      return;
    }
    exportEphemerisCSV(activeEphemeris, activeObject.norad_id);
    addLog(`Export successful: Ephemeris CSV for ${activeObject.name}`);
  };

  const handleExportConjunctionsCSV = () => {
    if (!conjunctionResults || conjunctionResults.length === 0) return;
    exportConjunctionsCSV(conjunctionResults);
    addLog(t('export.success_conjunction'));
  };

  const handleExportCatalogCSV = () => {
    if (!catalogLayerObjects || catalogLayerObjects.length === 0) return;
    exportCatalogCSV(catalogLayerObjects);
    addLog(`${t('export.success_catalog_csv')} (${catalogLayerObjects.length})`);
  };

  const handleExportGroundTrackGeoJSON = () => {
    if (!activeObject || !activeEphemeris || activeEphemeris.length === 0) {
      addLog(t('export.error_geojson'));
      return;
    }
    exportGroundTrackGeoJSON(activeEphemeris, activeObject.norad_id);
    addLog(`${t('export.success_ground_track')} ${activeObject.name}`);
  };

  const handleExportCatalogGeoJSON = () => {
    if (!catalogLayerObjects || catalogLayerObjects.length === 0) return;
    exportCatalogGeoJSON(catalogLayerObjects);
    addLog(`${t('export.success_catalog_geojson')} (${catalogLayerObjects.length})`);
  };

  const handleExportCZML = () => {
    if (!activeObject || !activeEphemeris || activeEphemeris.length === 0) {
      addLog(t('export.error_czml'));
      return;
    }
    exportTrajectoryCZML(activeEphemeris, activeObject);
    addLog(`${t('export.success_czml')} ${activeObject.name}`);
  };

  const handleExportReportEN = () => {
    if (!activeObject) return;
    exportMissionReport('en', activeObject, activeState, activePasses, conjunctionResults);
    addLog(`${t('export.success_report_en')} ${activeObject.name}`);
  };

  const handleExportReportTR = () => {
    if (!activeObject) return;
    exportMissionReport('tr', activeObject, activeState, activePasses, conjunctionResults);
    addLog(`${t('export.success_report_tr')} ${activeObject.name}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Ephemeris & Trajectory Exports */}
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
            {t('export.active_trajectory')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button 
              onClick={handleExportEphemerisCSV}
              disabled={!activeObject || !activeEphemeris || activeEphemeris.length === 0}
              className="export-btn"
              style={{
                backgroundColor: 'rgba(34, 211, 238, 0.1)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(34, 211, 238, 0.3)',
                padding: '6px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: (!activeObject || !activeEphemeris || activeEphemeris.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (!activeObject || !activeEphemeris || activeEphemeris.length === 0) ? 0.4 : 1
              }}
            >
              {t('export.ephemeris_csv')}
            </button>
            <button 
              onClick={handleExportGroundTrackGeoJSON}
              disabled={!activeObject || !activeEphemeris || activeEphemeris.length === 0}
              className="export-btn"
              style={{
                backgroundColor: 'rgba(34, 211, 238, 0.1)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(34, 211, 238, 0.3)',
                padding: '6px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: (!activeObject || !activeEphemeris || activeEphemeris.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (!activeObject || !activeEphemeris || activeEphemeris.length === 0) ? 0.4 : 1
              }}
            >
              {t('export.ground_track_geojson')}
            </button>
            <button 
              onClick={handleExportCZML}
              disabled={!activeObject || !activeEphemeris || activeEphemeris.length === 0}
              className="export-btn"
              style={{
                gridColumn: '1 / span 2',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--accent-blue)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '6px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: (!activeObject || !activeEphemeris || activeEphemeris.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (!activeObject || !activeEphemeris || activeEphemeris.length === 0) ? 0.4 : 1
              }}
            >
              {t('export.trajectory_czml')}
            </button>
          </div>
        </div>

        {/* Catalog & Conjunction Exports */}
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
            {t('export.catalog_analysis')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button 
              onClick={handleExportConjunctionsCSV}
              disabled={!conjunctionResults || conjunctionResults.length === 0}
              className="export-btn"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--accent-red)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '6px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: (!conjunctionResults || conjunctionResults.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (!conjunctionResults || conjunctionResults.length === 0) ? 0.4 : 1
              }}
            >
              {t('export.conjunctions_csv')}
            </button>
            <button 
              onClick={handleExportCatalogCSV}
              disabled={!catalogLayerObjects || catalogLayerObjects.length === 0}
              className="export-btn"
              style={{
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                color: 'var(--accent-orange)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                padding: '6px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: (!catalogLayerObjects || catalogLayerObjects.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (!catalogLayerObjects || catalogLayerObjects.length === 0) ? 0.4 : 1
              }}
            >
              {t('export.catalog_csv')}
            </button>
            <button 
              onClick={handleExportCatalogGeoJSON}
              disabled={!catalogLayerObjects || catalogLayerObjects.length === 0}
              className="export-btn"
              style={{
                gridColumn: '1 / span 2',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                color: 'var(--accent-orange)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                padding: '6px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: (!catalogLayerObjects || catalogLayerObjects.length === 0) ? 'not-allowed' : 'pointer',
                opacity: (!catalogLayerObjects || catalogLayerObjects.length === 0) ? 0.4 : 1
              }}
            >
              {t('export.catalog_geojson')}
            </button>
          </div>
        </div>

        {/* Mission Reports */}
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
            {t('export.mission_reports')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button 
              onClick={handleExportReportEN}
              disabled={!activeObject}
              className="export-btn"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--text-bright)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '6px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: !activeObject ? 'not-allowed' : 'pointer',
                opacity: !activeObject ? 0.4 : 1
              }}
            >
              {t('export.report_en')}
            </button>
            <button 
              onClick={handleExportReportTR}
              disabled={!activeObject}
              className="export-btn"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--text-bright)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '6px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: !activeObject ? 'not-allowed' : 'pointer',
                opacity: !activeObject ? 0.4 : 1
              }}
            >
              {t('export.report_tr')}
            </button>
          </div>
        </div>

      </div>
  );
};

export const ExportPanel = React.memo(ExportPanelInner);
