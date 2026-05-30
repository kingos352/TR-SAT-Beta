import React, { useState } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { screenVisibility, VisibilityResultItem } from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';

const GroundStationVisibilityPanelInner: React.FC = () => {
  const observer = useConsoleStore(s => s.observer);
  const visibilityResults = useConsoleStore(s => s.visibilityResults);
  const setVisibilityResults = useConsoleStore(s => s.setVisibilityResults);
  const visibilityScanActive = useConsoleStore(s => s.visibilityScanActive);
  const setVisibilityScanActive = useConsoleStore(s => s.setVisibilityScanActive);
  const setActiveObject = useConsoleStore(s => s.setActiveObject);
  const selectObject = useConsoleStore(s => s.selectObject);
  const selectedObjects = useConsoleStore(s => s.selectedObjects);
  const removeSelectedObject = useConsoleStore(s => s.removeSelectedObject);
  const addLog = useConsoleStore(s => s.addLog);
  const { t } = useTranslation();

  const [minElevation, setMinElevation] = useState<number>(10);
  const [highElevation, setHighElevation] = useState<number>(45);
  const [objectType, setObjectType] = useState<string>('ALL');
  const [limit, setLimit] = useState<number>(100);
  const [includeDebris, setIncludeDebris] = useState<boolean>(false);

  const handleScan = async () => {
    try {
      setVisibilityScanActive(true);
      const timestamp_utc = new Date().toISOString();
      addLog(`Visibility: Scanning for objects above ${minElevation}°...`);
      const res = await screenVisibility({
        timestamp_utc,
        observer_latitude_deg: observer.latitude_deg,
        observer_longitude_deg: observer.longitude_deg,
        observer_elevation_m: observer.elevation_m,
        min_elevation_deg: minElevation,
        object_type: objectType !== 'ALL' ? objectType : undefined,
        limit,
        include_debris: includeDebris
      });
      
      let results = res.objects; // 'objects' is the field from backend
      if (!includeDebris && objectType === 'ALL') {
        results = results.filter((r: VisibilityResultItem) => r.object_type !== 'DEBRIS');
      }

      setVisibilityResults(results);
      addLog(`Visibility scan complete. Found ${results.length} candidates.`);
    } catch (err: any) {
      addLog(`Visibility scan failed: ${err.message}`);
    } finally {
      setVisibilityScanActive(false);
    }
  };

  const isSelected = (noradId: string) => selectedObjects.some(o => String(o.norad_id) === String(noradId));

  const toggleSelection = (item: VisibilityResultItem) => {
    if (isSelected(item.norad_id)) {
      removeSelectedObject(parseInt(item.norad_id, 10));
    } else {
      selectObject({
        norad_id: parseInt(item.norad_id, 10),
        name: item.name,
        object_type: item.object_type || 'UNKNOWN',
        category: item.category || 'UNKNOWN',
        source: 'VISIBILITY',
        source_group: 'N/A',
        last_updated: new Date().toISOString()
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('visibility.min_elevation')}</label>
            <select 
              value={minElevation} 
              onChange={e => setMinElevation(Number(e.target.value))}
              style={{
                width: '100%', padding: '6px', borderRadius: '6px',
                backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
                color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
              }}
            >
              <option value="5">5°</option>
              <option value="10">10°</option>
              <option value="20">20°</option>
              <option value="30">30°</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('visibility.high_elevation')}</label>
            <select 
              value={highElevation} 
              onChange={e => setHighElevation(Number(e.target.value))}
              style={{
                width: '100%', padding: '6px', borderRadius: '6px',
                backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
                color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
              }}
            >
              <option value="45">45°</option>
              <option value="60">60°</option>
              <option value="75">75°</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('visibility.object_type')}</label>
            <select 
              value={objectType} 
              onChange={e => setObjectType(e.target.value)}
              style={{
                width: '100%', padding: '6px', borderRadius: '6px',
                backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
                color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
              }}
            >
              <option value="ALL">ALL</option>
              <option value="PAYLOAD">PAYLOAD</option>
              <option value="ROCKET_BODY">ROCKET_BODY</option>
              <option value="DEBRIS">DEBRIS</option>
              <option value="UNKNOWN">UNKNOWN</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('visibility.limit')}</label>
            <select 
              value={limit} 
              onChange={e => setLimit(Number(e.target.value))}
              style={{
                width: '100%', padding: '6px', borderRadius: '6px',
                backgroundColor: 'rgba(3, 7, 18, 0.7)', border: '1px solid var(--border-color)',
                color: 'var(--text-bright)', fontSize: '11px', outline: 'none'
              }}
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-bright)', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={includeDebris} 
            onChange={e => setIncludeDebris(e.target.checked)} 
            style={{ cursor: 'pointer' }}
          />
          {t('visibility.include_debris')}
        </label>

        <button
          onClick={handleScan}
          disabled={visibilityScanActive}
          style={{
            padding: '8px', borderRadius: '6px', border: 'none',
            backgroundColor: 'var(--accent-blue)', color: 'var(--text-bright)',
            fontSize: '11px', fontWeight: 600, cursor: visibilityScanActive ? 'not-allowed' : 'pointer',
            opacity: visibilityScanActive ? 0.7 : 1, width: '100%'
          }}
        >
          {visibilityScanActive ? t('visibility.scanning') : t('visibility.scan_visible_objects')}
        </button>

        <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.2' }}>
          {t('visibility.estimate_warning')}
        </p>

        {visibilityResults && visibilityResults.length > 0 && (
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                {t('visibility.candidates')} ({visibilityResults.length})
              </h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
              {visibilityResults.map((item: VisibilityResultItem) => (
                <div key={item.norad_id} style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(75, 85, 99, 0.3)',
                  borderRadius: '4px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-bright)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                      {item.name}
                    </div>
                    <span style={{ 
                      padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 600,
                      backgroundColor: item.visibility_class === 'OVERHEAD' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: item.visibility_class === 'OVERHEAD' ? 'var(--accent-green)' : 'var(--accent-blue)'
                    }}>
                      {item.visibility_class || t('visibility.observable')}
                    </span>
                  </div>
                  
                  <div className="mono-text" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '9px', color: 'var(--text-muted)' }}>
                    <div>NORAD: <span style={{ color: 'var(--text-bright)' }}>{item.norad_id}</span></div>
                    <div>{t('visibility.type')}: <span style={{ color: 'var(--text-bright)' }}>{item.object_type}</span></div>
                    <div>{t('visibility.el')}: <span style={{ color: 'var(--accent-green)' }}>{item.elevation_deg?.toFixed(1)}°</span></div>
                    <div>{t('visibility.az')}: <span style={{ color: 'var(--text-bright)' }}>{item.azimuth_deg?.toFixed(1)}°</span></div>
                    <div style={{ gridColumn: 'span 2' }}>{t('observer.range')} <span style={{ color: 'var(--text-bright)' }}>{item.range_km?.toFixed(0)} km</span></div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <button
                      onClick={() => setActiveObject({
                        norad_id: parseInt(item.norad_id, 10),
                        name: item.name,
                        object_type: item.object_type || 'UNKNOWN',
                        category: item.category || 'UNKNOWN',
                        source: 'VISIBILITY',
                        source_group: 'N/A',
                        last_updated: new Date().toISOString()
                      })}
                      style={{
                        flex: 1, padding: '4px', borderRadius: '4px', border: 'none',
                        backgroundColor: 'rgba(75, 85, 99, 0.5)', color: 'var(--text-bright)',
                        fontSize: '9px', cursor: 'pointer'
                      }}
                    >
                      {t('visibility.set_active')}
                    </button>
                    <button
                      onClick={() => toggleSelection(item)}
                      style={{
                        flex: 1, padding: '4px', borderRadius: '4px', border: isSelected(item.norad_id) ? '1px solid var(--accent-orange)' : 'none',
                        backgroundColor: isSelected(item.norad_id) ? 'rgba(249, 115, 22, 0.1)' : 'rgba(75, 85, 99, 0.5)', 
                        color: isSelected(item.norad_id) ? 'var(--accent-orange)' : 'var(--text-bright)',
                        fontSize: '9px', cursor: 'pointer'
                      }}
                    >
                      {isSelected(item.norad_id) ? t('visibility.tracking') : t('visibility.track')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {visibilityResults && visibilityResults.length === 0 && !visibilityScanActive && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '10px 0', fontSize: '10px' }}>
            {t('visibility.no_objects')}
          </div>
        )}
      </div>
  );
};

export const GroundStationVisibilityPanel = React.memo(GroundStationVisibilityPanelInner);
