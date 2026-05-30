import React, { useState, useCallback } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { getCatalogSnapshot, CatalogSnapshotObject, CatalogObject } from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';

const CatalogLayerPanelInner: React.FC = () => {
  const catalogLayerEnabled = useConsoleStore(s => s.catalogLayerEnabled);
  const setCatalogLayerEnabled = useConsoleStore(s => s.setCatalogLayerEnabled);
  const catalogLayerObjects = useConsoleStore(s => s.catalogLayerObjects);
  const setCatalogLayerObjects = useConsoleStore(s => s.setCatalogLayerObjects);
  const catalogLayerLoading = useConsoleStore(s => s.catalogLayerLoading);
  const setCatalogLayerLoading = useConsoleStore(s => s.setCatalogLayerLoading);
  const setActiveObject = useConsoleStore(s => s.setActiveObject);
  const addLog = useConsoleStore(s => s.addLog);
  const { t } = useTranslation();

  const [limit, setLimit] = useState<number>(1000);
  const [objectType, setObjectType] = useState<string>('ALL');
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  
  const typesList = ['ALL', 'PAYLOAD', 'ROCKET_BODY', 'DEBRIS', 'UNKNOWN'];
  const categoriesList = ['ALL', 'Space Station', 'Communication', 'Navigation', 'Weather', 'Earth Observation', 'Mega-constellation', 'Science', 'Debris', 'Rocket Body', 'Unknown'];
  const MAX_LIMIT = 50000;
  const limitList = [500, 1000, 2000, 5000, MAX_LIMIT];

  const handleLoadRefresh = useCallback(async () => {
    setCatalogLayerLoading(true);
    addLog(`Catalog Layer: Requesting snapshot of up to ${limit} objects...`);
    try {
      const res = await getCatalogSnapshot({
        limit,
        object_type: objectType !== 'ALL' ? objectType : undefined,
        category: category !== 'ALL' ? category : undefined,
        search: search || undefined
      });
      setCatalogLayerObjects(res.objects);
      setCatalogLayerEnabled(true);
      addLog(`Catalog Layer: Loaded ${res.returned_count} objects into visualization layer.`);
    } catch (err: any) {
      addLog(`Catalog Layer Error: ${err.message}`);
    } finally {
      setCatalogLayerLoading(false);
    }
  }, [limit, objectType, category, search, addLog, setCatalogLayerLoading, setCatalogLayerObjects, setCatalogLayerEnabled]);

  const handleClear = useCallback(() => {
    setCatalogLayerObjects([]);
    setCatalogLayerEnabled(false);
    addLog('Catalog Layer: Cleared objects and disabled visualization.');
  }, [setCatalogLayerObjects, setCatalogLayerEnabled, addLog]);

  const handleSetActive = useCallback((obj: CatalogSnapshotObject) => {
    const catalogObj: CatalogObject = {
      norad_id: obj.norad_id,
      name: obj.name,
      object_type: obj.object_type,
      category: obj.category,
      source: 'SNAPSHOT',
      source_group: 'UNKNOWN',
      last_updated: new Date().toISOString()
    };
    setActiveObject(catalogObj);
    addLog(`Catalog Layer: Set active object to ${obj.name} (NORAD: ${obj.norad_id})`);
  }, [setActiveObject, addLog]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid var(--accent-orange)',
          borderRadius: '6px',
          padding: '10px 14px',
          fontSize: '11px',
          color: 'var(--accent-orange)',
          fontWeight: 600,
          lineHeight: '1.4'
        }}>
          {t('catalog_layer.warning_snapshot')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('catalog_layer.search_query')}</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('catalog_layer.search_placeholder')}
              style={{
                width: '100%', padding: '6px', borderRadius: '6px',
                backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
                color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('catalog_layer.object_type')}</label>
            <select
              value={objectType}
              onChange={(e) => setObjectType(e.target.value)}
              style={{
                width: '100%', padding: '6px', borderRadius: '6px',
                backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
                color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
              }}
            >
              {typesList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('catalog_layer.category')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%', padding: '6px', borderRadius: '6px',
                backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
                color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
              }}
            >
              {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('catalog_layer.limit')}</label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              style={{
                width: '100%', padding: '6px', borderRadius: '6px',
                backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
                color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
              }}
            >
              {limitList.map(l => <option key={l} value={l}>{l === MAX_LIMIT ? t('catalog_layer.limit_max') : l}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleLoadRefresh}
            disabled={catalogLayerLoading}
            style={{
              flex: 2, padding: '8px', borderRadius: '6px', border: 'none',
              backgroundColor: 'var(--accent-blue)', color: 'var(--text-bright)',
              fontSize: '11px', fontWeight: 600, cursor: catalogLayerLoading ? 'not-allowed' : 'pointer',
              opacity: catalogLayerLoading ? 0.7 : 1
            }}
          >
            {catalogLayerObjects.length > 0 ? t('catalog_layer.refresh_snapshot') : t('catalog_layer.load_snapshot')}
          </button>
          <button
            onClick={handleClear}
            style={{
              flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--accent-red)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            {t('catalog_layer.clear')}
          </button>
        </div>

        {catalogLayerObjects.length > 0 && (
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                {t('catalog_layer.loaded_objects')} ({catalogLayerObjects.length})
              </h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-bright)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={catalogLayerEnabled} 
                  onChange={(e) => setCatalogLayerEnabled(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
                {t('catalog_layer.show_on_globe')}
              </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
              {catalogLayerObjects.map(obj => (
                <div key={obj.norad_id} style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(75, 85, 99, 0.3)',
                  borderRadius: '4px',
                  padding: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '10px'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{obj.name}</div>
                    <div className="mono-text" style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '2px' }}>
                      {obj.norad_id} | {obj.object_type}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSetActive(obj)}
                    style={{
                      padding: '3px 6px', borderRadius: '4px', border: 'none',
                      backgroundColor: 'var(--accent-green)', color: 'var(--text-bright)',
                      fontSize: '9px', cursor: 'pointer'
                    }}
                  >
                    {t('catalog_layer.focus')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
};

export const CatalogLayerPanel = React.memo(CatalogLayerPanelInner);
