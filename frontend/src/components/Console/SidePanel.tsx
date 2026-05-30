import React from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import {
  syncCatalogGroup,
  searchCatalog,
  getSpaceTrackStatus,
  testSpaceTrackAuth,
  syncSpaceTrackNorad,
  syncSpaceTrackObjectType
} from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';
import { SkeletonBlock } from './Skeleton';

// CelesTrak groups list. "debris" is an aggregate over the real CelesTrak debris
// clouds; the specific clouds are also selectable individually.
const groupsList = [
  'active', 'stations', 'visual', 'geo', 'weather', 'noaa',
  'gps-ops', 'galileo', 'starlink', 'oneweb', 'science',
  'debris', 'fengyun-1c-debris', 'cosmos-2251-debris', 'iridium-33-debris', 'cosmos-1408-debris'
];

// RSO Category filters
const categoriesList = [
  'ALL', 'Space Station', 'Communication', 'Navigation', 'Weather', 
  'Earth Observation', 'Mega-constellation', 'Science', 'Debris', 'Rocket Body', 'Unknown'
];

// Object Type filters
const typesList = ['ALL', 'PAYLOAD', 'ROCKET_BODY', 'DEBRIS', 'UNKNOWN'];

const CatalogIntelligenceInner: React.FC = () => {
  const catalogResults = useConsoleStore(s => s.catalogResults);
  const setCatalogResults = useConsoleStore(s => s.setCatalogResults);
  const selectedObjects = useConsoleStore(s => s.selectedObjects);
  const selectObject = useConsoleStore(s => s.selectObject);
  const removeSelectedObject = useConsoleStore(s => s.removeSelectedObject);
  const activeObject = useConsoleStore(s => s.activeObject);
  const setActiveObject = useConsoleStore(s => s.setActiveObject);
  const addLog = useConsoleStore(s => s.addLog);
  const setApiStatus = useConsoleStore(s => s.setApiStatus);
  const lastApiError = useConsoleStore(s => s.lastApiError);

  // Search Form States
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [searchType, setSearchType] = React.useState<string>('ALL');
  const [searchCategory, setSearchCategory] = React.useState<string>('ALL');
  const [searchLoading, setSearchLoading] = React.useState<boolean>(false);
  const { t } = useTranslation();

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchLoading(true);
    addLog(`Catalog Query: Searching elements (Query: "${searchQuery}", Type: "${searchType}", Category: "${searchCategory}")...`);
    try {
      const res = await searchCatalog({
        q: searchQuery || undefined,
        object_type: searchType,
        category: searchCategory,
        limit: 100
      });
      setCatalogResults(res);
      setApiStatus('connected');
      addLog(`Catalog Query: Search returned ${res.length} matching Resident Space Objects.`);
    } catch (err: any) {
      setApiStatus('disconnected', err.message);
      addLog(`Catalog Query Error: Search failed (${err.message})`);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type="text"
          placeholder={t('catalog.search_placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '4px',
            backgroundColor: 'rgba(3, 7, 18, 0.7)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-bright)',
            fontSize: '12px',
            outline: 'none'
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            style={{ flex: 1, padding: '6px', borderRadius: '4px', backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)', color: 'var(--text-bright)', fontSize: '11px', outline: 'none' }}
          >
            {typesList.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
            style={{ flex: 1, padding: '6px', borderRadius: '4px', backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)', color: 'var(--text-bright)', fontSize: '11px', outline: 'none' }}
          >
            {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={searchLoading}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--accent-cyan)', color: '#050b14', fontSize: '12px', fontWeight: 600, cursor: searchLoading ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s', opacity: searchLoading ? 0.7 : 1 }}
        >
          {searchLoading ? t('catalog.searching') : t('catalog.search_button')}
        </button>
      </form>

      {searchLoading && catalogResults.length === 0 && (
        <div style={{ marginTop: '4px' }}>
          <SkeletonBlock rows={5} />
        </div>
      )}

      {catalogResults.length > 0 && (
        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('catalog.results')} ({catalogResults.length})</div>
          {catalogResults.map((obj) => (
            <div key={obj.norad_id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(75, 85, 99, 0.2)', borderRadius: '4px', padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{obj.name}</div>
                <div className="mono-text" style={{ color: 'var(--accent-cyan)', fontSize: '9px' }}>{obj.norad_id} | {obj.category}</div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => selectObject(obj)} style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--accent-blue)', backgroundColor: 'transparent', color: 'var(--accent-blue)', fontSize: '9px', cursor: 'pointer' }}>{t('catalog.select')}</button>
                <button onClick={() => setActiveObject(obj)} style={{ padding: '3px 6px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--accent-green)', color: 'var(--text-bright)', fontSize: '9px', cursor: 'pointer' }}>{t('catalog.focus')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedObjects.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('catalog.tracking_set')} ({selectedObjects.length}/20)</div>
          {lastApiError && <div className="mono-text" style={{ color: 'var(--accent-red)', fontSize: '10px' }}>⚠️ {lastApiError}</div>}
          {selectedObjects.map((obj) => (
            <div key={obj.norad_id} style={{ backgroundColor: activeObject?.norad_id === obj.norad_id ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.01)', border: '1px solid', borderColor: activeObject?.norad_id === obj.norad_id ? 'var(--accent-green)' : 'rgba(75, 85, 99, 0.2)', borderRadius: '4px', padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{obj.name}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setActiveObject(obj)} disabled={activeObject?.norad_id === obj.norad_id} style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', backgroundColor: activeObject?.norad_id === obj.norad_id ? 'rgba(75, 85, 99, 0.3)' : 'var(--accent-green)', color: 'var(--text-bright)', fontSize: '9px', cursor: activeObject?.norad_id === obj.norad_id ? 'default' : 'pointer' }}>{t('catalog.focus')}</button>
                <button onClick={() => removeSelectedObject(obj.norad_id)} style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--accent-red)', color: 'var(--text-bright)', fontSize: '9px', cursor: 'pointer' }}>{t('catalog.remove')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CatalogIntelligence = React.memo(CatalogIntelligenceInner);

const DataSourcesInner: React.FC = () => {
  const addLog = useConsoleStore(s => s.addLog);
  const setApiStatus = useConsoleStore(s => s.setApiStatus);

  // Sync Form States
  const [syncGroup, setSyncGroup] = React.useState<string>('stations');
  const [syncFormat, setSyncFormat] = React.useState<'tle' | 'omm'>('tle');
  const [syncLoading, setSyncLoading] = React.useState<boolean>(false);
  const [syncResult, setSyncResult] = React.useState<any>(null);

  // Space-Track States
  const [stStatus, setStStatus] = React.useState<string>('Unknown');
  const [stLoading, setStLoading] = React.useState<boolean>(false);
  const [stNoradId, setStNoradId] = React.useState<string>('');
  const { t } = useTranslation();

  const handleSync = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    addLog(`Ingestion: Initiated ${syncFormat.toUpperCase()} synchronization for CelesTrak group '${syncGroup}'...`);
    try {
      const res = await syncCatalogGroup(syncGroup, syncFormat);
      setSyncResult(res);
      setApiStatus('connected');
      if (res.warning) {
        addLog(`Ingestion warning: ${res.warning}`);
      } else {
        addLog(`Ingestion success: Synchronized '${syncGroup}' group. Fetched: ${res.fetched_count}, Inserted: ${res.inserted_objects} objects.`);
      }
    } catch (err: any) {
      setApiStatus('disconnected', err.message);
      addLog(`Ingestion error: Synchronization failed for '${syncGroup}' (${err.message})`);
    } finally {
      setSyncLoading(false);
    }
  };

  const checkStStatus = async () => {
    setStLoading(true);
    addLog(`Space-Track: Checking configuration status...`);
    try {
      const res = await getSpaceTrackStatus();
      setStStatus(res.is_configured ? 'Configured' : 'Not Configured');
      addLog(`Space-Track Status: ${res.is_configured ? 'Configured' : 'Not Configured'} - ${res.message}`);
    } catch (err: any) {
      setStStatus('Error');
      addLog(`Space-Track Status Error: ${err.message}`);
    } finally {
      setStLoading(false);
    }
  };

  const testStAuth = async () => {
    setStLoading(true);
    addLog(`Space-Track: Testing authentication...`);
    try {
      const res = await testSpaceTrackAuth();
      addLog(`Space-Track Auth Test: ${res.success ? 'Success' : 'Failed'} - ${res.message}`);
    } catch (err: any) {
      addLog(`Space-Track Auth Test Error: ${err.message}`);
    } finally {
      setStLoading(false);
    }
  };

  const syncStNorad = async () => {
    if (!stNoradId) return;
    const norad = parseInt(stNoradId, 10);
    if (isNaN(norad)) {
      addLog(`Space-Track Sync Error: Invalid NORAD ID.`);
      return;
    }

    setStLoading(true);
    addLog(`Space-Track: Initiating sync for NORAD ID ${norad}...`);
    try {
      const res = await syncSpaceTrackNorad(norad);
      addLog(`Space-Track Sync Success: Fetched ${res.fetched_count}, Inserted TLEs ${res.inserted_tles}.`);
    } catch (err: any) {
      addLog(`Space-Track Sync Error: ${err.message}`);
    } finally {
      setStLoading(false);
    }
  };

  const syncStRocketBodies = async () => {
    setStLoading(true);
    addLog(`Space-Track: Initiating bulk rocket-body sync...`);
    try {
      const res = await syncSpaceTrackObjectType('rocket-body');
      addLog(`Space-Track Rocket Bodies: Fetched ${res.fetched_count}, Inserted ${res.inserted_objects} objects (${res.inserted_tles} TLEs, ${res.skipped_count} skipped).`);
    } catch (err: any) {
      addLog(`Space-Track Rocket Body Sync Error: ${err.message}`);
    } finally {
      setStLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* CelesTrak */}
      <div>
        <div style={{ fontSize: '10px', color: 'var(--text-bright)', marginBottom: '6px' }}>{t('data_sources.celestrak_sync')}</div>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
          {(['tle', 'omm'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => setSyncFormat(fmt)}
              disabled={syncLoading}
              style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid', borderColor: syncFormat === fmt ? 'var(--accent-blue)' : 'var(--border-color)', background: syncFormat === fmt ? 'rgba(37,183,255,0.12)' : 'transparent', color: syncFormat === fmt ? 'var(--accent-blue)' : 'var(--text-muted)', fontSize: '10px', fontWeight: 600, cursor: syncLoading ? 'not-allowed' : 'pointer' }}
            >
              {fmt === 'tle' ? 'Legacy TLE' : 'OMM JSON'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={syncGroup} onChange={(e) => setSyncGroup(e.target.value)} disabled={syncLoading} style={{ flexGrow: 1, padding: '6px', borderRadius: '4px', backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)', color: 'var(--text-bright)', fontSize: '11px', outline: 'none' }}>
            {groupsList.map(g => <option key={g} value={g}>{g.toUpperCase()}</option>)}
          </select>
          <button onClick={handleSync} disabled={syncLoading} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: syncLoading ? 'rgba(75, 85, 99, 0.5)' : 'var(--accent-blue)', color: 'var(--text-bright)', fontSize: '11px', fontWeight: 600, cursor: syncLoading ? 'not-allowed' : 'pointer' }}>
            {syncLoading ? t('data_sources.syncing') : t('data_sources.sync')}
          </button>
        </div>
        {syncResult && (
          <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>
              <span>Fetched: </span><span style={{ color: 'var(--accent-blue)' }}>{syncResult.fetched_count}</span>
              <span style={{ margin: '0 6px' }}>|</span>
              <span>New: </span><span style={{ color: 'var(--accent-green)' }}>{syncResult.inserted_objects}</span>
              <span style={{ margin: '0 6px' }}>|</span>
              <span>Updated: </span><span style={{ color: 'var(--accent-cyan)' }}>{syncResult.updated_objects}</span>
            </div>
            <div>
              <span>TLEs: </span><span style={{ color: 'var(--accent-cyan)' }}>{syncResult.inserted_tles}</span>
              {syncResult.skipped_count > 0 && (
                <><span style={{ margin: '0 6px' }}>|</span><span style={{ color: 'var(--accent-orange)' }}>Skipped: {syncResult.skipped_count}</span></>
              )}
            </div>
            {syncResult.warning && (
              <div style={{ color: 'var(--accent-orange)', marginTop: '2px' }}>{syncResult.warning}</div>
            )}
          </div>
        )}
      </div>

      {/* Space-Track */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '6px' }}>
          <span style={{ color: 'var(--text-bright)' }}>{t('data_sources.spacetrack')}</span>
          <span style={{ color: stStatus === 'Configured' ? 'var(--accent-green)' : 'var(--text-muted)' }}>{stStatus}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button onClick={checkStStatus} disabled={stLoading} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-bright)', fontSize: '10px', cursor: 'pointer' }}>{t('data_sources.check')}</button>
          <button onClick={testStAuth} disabled={stLoading} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-bright)', fontSize: '10px', cursor: 'pointer' }}>{t('data_sources.test_auth')}</button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" placeholder={t('data_sources.norad_id_placeholder')} value={stNoradId} onChange={(e) => setStNoradId(e.target.value)} disabled={stLoading} style={{ flexGrow: 1, padding: '6px', borderRadius: '4px', backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)', color: 'var(--text-bright)', fontSize: '11px', outline: 'none' }} />
          <button onClick={syncStNorad} disabled={stLoading || !stNoradId} style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: stLoading || !stNoradId ? 'rgba(75, 85, 99, 0.5)' : 'var(--accent-blue)', color: 'var(--text-bright)', fontSize: '11px', fontWeight: 600, cursor: stLoading || !stNoradId ? 'not-allowed' : 'pointer' }}>{t('data_sources.sync')}</button>
        </div>
        <button onClick={syncStRocketBodies} disabled={stLoading} style={{ width: '100%', marginTop: '8px', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: stLoading ? 'rgba(75, 85, 99, 0.5)' : 'transparent', color: 'var(--text-bright)', fontSize: '11px', fontWeight: 600, cursor: stLoading ? 'not-allowed' : 'pointer' }}>
          {t('data_sources.sync_rocket_bodies')}
        </button>
      </div>
    </div>
  );
};

export const DataSources = React.memo(DataSourcesInner);

const SystemLogsInner: React.FC = () => {
  const logs = useConsoleStore(s => s.logs);
  const cesiumDiagnostics = useConsoleStore(s => s.cesiumDiagnostics);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        backgroundColor: 'rgba(3, 7, 18, 0.6)', padding: '6px 10px',
        borderRadius: '4px', fontSize: '10px', color: 'rgba(255,255,255,0.7)',
        display: 'flex', flexDirection: 'column', gap: '2px',
        border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Share Tech Mono, monospace'
      }}>
        <div style={{ marginBottom: '2px', color: 'var(--text-bright)' }}>Cesium Diagnostics:</div>
        <div>ION TOKEN: <span style={{ color: cesiumDiagnostics.token === 'Configured' ? '#4ade80' : '#f87171' }}>{cesiumDiagnostics.token}</span></div>
        <div>TERRAIN: <span style={{ color: cesiumDiagnostics.terrain === 'Ion Terrain' ? '#4ade80' : '#fbbf24' }}>{cesiumDiagnostics.terrain}</span></div>
        <div>IMAGERY: <span style={{ color: cesiumDiagnostics.imagery === 'Ion Imagery' ? '#4ade80' : '#fbbf24' }}>{cesiumDiagnostics.imagery}</span></div>
      </div>
      
      <div className="mono-text" style={{ maxHeight: '150px', overflowY: 'auto', backgroundColor: 'rgba(3, 7, 18, 0.6)', border: '1px solid rgba(75, 85, 99, 0.2)', borderRadius: '4px', padding: '8px', fontSize: '10px', color: 'var(--accent-green)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {logs.slice(-30).map((log, index) => (
        <div key={index}>{`> ${log}`}</div>
      ))}
      </div>
    </div>
  );
};

export const SystemLogs = React.memo(SystemLogsInner);
