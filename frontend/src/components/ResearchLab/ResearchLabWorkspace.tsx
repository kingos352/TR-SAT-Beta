import React, { useEffect, useState, useCallback } from 'react';
import { FlaskConical } from 'lucide-react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { useTranslation } from '../../i18n/useTranslation';
import { LineChart } from '../Console/Charts/LineChart';
import type {
  HistoricalTLEPoint,
  PassWindow,
  RelativeMotionResult,
  ConjunctionResult,
} from '../../api/client';

const MU = 398600.4418;
const R_EARTH = 6378.137;
const SOFTWARE_VERSION = '4.0.0';

type ModuleId = 'overview' | 'validation' | 'evolution' | 'passes' | 'relative' | 'conjunction' | 'numerical' | 'repro';

// ─── tiny shared primitives ──────────────────────────────────────────────────

const lbl: React.CSSProperties = { fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' };
const val: React.CSSProperties = { fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 };
const secTitle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' };

const Field: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div><div style={lbl}>{label}</div><div className={mono ? 'mono-text' : undefined} style={val}>{value}</div></div>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ background: 'var(--bg-panel-soft)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
    <div style={secTitle}>{title}</div>
    {children}
  </div>
);

const Spinner: React.FC = () => (
  <div style={{ width: 20, height: 20, border: '2px solid rgba(37,183,255,0.15)', borderTop: '2px solid var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
);

const Disclaimer: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', lineHeight: 1.5 }}>
    ⓘ {text}
  </div>
);

const primaryBtn: React.CSSProperties = { padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent-blue)', color: '#050B14', fontSize: '12px', fontWeight: 700, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500, cursor: 'pointer' };

const inputStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'var(--font-ui)', width: '100%', boxSizing: 'border-box' };

// ─── Orbit Evolution module ──────────────────────────────────────────────────

const OrbitEvolutionModule: React.FC<{ noradId: number; objectName: string }> = ({ noradId, objectName }) => {
  const [points, setPoints] = useState<HistoricalTLEPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<'mm' | 'perigee' | 'apogee' | 'incl' | 'ecc' | 'bstar'>('mm');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { getHistoricalTLEs } = await import('../../api/client');
      const data = await getHistoricalTLEs(noradId);
      setPoints(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [noradId]);

  useEffect(() => { load(); }, [load]);

  const metricOptions: { id: typeof metric; label: string; unit: string }[] = [
    { id: 'mm', label: 'Mean Motion', unit: 'rev/day' },
    { id: 'perigee', label: 'Perigee', unit: 'km' },
    { id: 'apogee', label: 'Apogee', unit: 'km' },
    { id: 'incl', label: 'Inclination', unit: '°' },
    { id: 'ecc', label: 'Eccentricity', unit: '' },
    { id: 'bstar', label: 'BSTAR', unit: '' },
  ];

  const getY = (p: HistoricalTLEPoint): number => {
    const a = p.mean_motion > 0 ? Math.cbrt(MU / Math.pow((p.mean_motion * 2 * Math.PI) / 86400, 2)) : 0;
    switch (metric) {
      case 'mm': return p.mean_motion;
      case 'perigee': return a > 0 ? a * (1 - p.eccentricity) - R_EARTH : 0;
      case 'apogee':  return a > 0 ? a * (1 + p.eccentricity) - R_EARTH : 0;
      case 'incl':    return p.inclination;
      case 'ecc':     return p.eccentricity;
      case 'bstar':   return p.bstar;
    }
  };

  const chartData = points.map((p, i) => ({ x: i, y: getY(p) }));
  const cur = metricOptions.find(m => m.id === metric)!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px', overflowY: 'auto', height: '100%' }}>
      <Card title="Orbit Evolution">
        <div style={{ marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
          {objectName} · {points.length} historical records
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {metricOptions.map(m => (
            <button key={m.id} onClick={() => setMetric(m.id)} style={{ ...ghostBtn, ...(metric === m.id ? { borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)', background: 'rgba(37,183,255,0.08)' } : {}) }}>
              {m.label}
            </button>
          ))}
        </div>
        {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Spinner /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span></div>}
        {error && <div style={{ color: 'var(--accent-danger)', fontSize: 12 }}>{error}</div>}
        {!loading && !error && points.length < 2 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0' }}>
            Insufficient historical TLE records. Sync this object over time to build an evolution timeline.
          </div>
        )}
        {!loading && !error && points.length >= 2 && (
          <LineChart data={chartData} width={560} height={200} color="var(--accent-cyan)" yLabel={`${cur.label} (${cur.unit})`} xLabel="Record index (oldest → newest)" />
        )}
      </Card>
      <Disclaimer text="Historical TLE evolution is derived from publicly available orbital elements. Trend indicators are heuristic — not a high-fidelity orbit determination product." />
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={load} style={ghostBtn}>Refresh</button>
        {!loading && points.length > 0 && (
          <button
            onClick={() => {
              const csv = ['epoch,mean_motion,inclination,eccentricity,bstar', ...points.map(p => `${p.epoch},${p.mean_motion},${p.inclination},${p.eccentricity},${p.bstar}`)].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `trsat_evolution_${noradId}.csv`; a.click(); URL.revokeObjectURL(url);
            }}
            style={primaryBtn}
          >
            Export CSV
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Pass Analysis module ────────────────────────────────────────────────────

const PassAnalysisModule: React.FC<{ noradId: number; objectName: string }> = ({ noradId, objectName }) => {
  const observer = useConsoleStore(s => s.observer);
  const [passes, setPasses] = useState<PassWindow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizonDays, setHorizonDays] = useState(3);
  const [minElev, setMinElev] = useState(10);

  const run = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { getCatalogPasses } = await import('../../api/client');
      const now = new Date();
      const end = new Date(now.getTime() + horizonDays * 86400_000);
      const data = await getCatalogPasses({
        norad_id: noradId,
        observer_latitude_deg: observer.latitude_deg,
        observer_longitude_deg: observer.longitude_deg,
        observer_elevation_m: observer.elevation_m,
        start_time_utc: now.toISOString(),
        end_time_utc: end.toISOString(),
        min_elevation_deg: minElev,
      });
      setPasses(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [noradId, observer, horizonDays, minElev]);

  const dur = (aos: string, los: string) => {
    const s = Math.round((new Date(los).getTime() - new Date(aos).getTime()) / 1000);
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };
  const ts = (s: string) => s.replace('T', ' ').substring(0, 16);

  const exportPasses = () => {
    const csv = ['AOS_UTC,TCA_UTC,LOS_UTC,MaxEl_deg,Duration', ...passes.map(p => `${p.aos_time_utc},${p.max_time_utc},${p.los_time_utc},${p.max_elevation_deg.toFixed(1)},${dur(p.aos_time_utc, p.los_time_utc)}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `trsat_passes_${noradId}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px', overflowY: 'auto', height: '100%' }}>
      <Card title="Pass Analysis">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={lbl}>Horizon (days)</div>
            <input type="number" min={1} max={14} value={horizonDays} onChange={e => setHorizonDays(Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <div style={lbl}>Min Elevation (°)</div>
            <input type="number" min={0} max={90} value={minElev} onChange={e => setMinElev(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Station: {observer.name} · {objectName}
        </div>
        <button onClick={run} disabled={loading} style={primaryBtn}>
          {loading ? <Spinner /> : 'Compute Passes'}
        </button>
        {error && <div style={{ color: 'var(--accent-danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}
      </Card>

      {passes.length > 0 && (
        <Card title={`Results (${passes.length} geometric passes)`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Best: {passes.reduce((b, p) => p.max_elevation_deg > b.max_elevation_deg ? p : b).max_elevation_deg.toFixed(1)}° max el
            </div>
            <button onClick={exportPasses} style={ghostBtn}>Export CSV</button>
          </div>
          <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {passes.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 60px 50px', gap: '8px', fontSize: '11px', padding: '5px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', borderLeft: `2px solid ${p.max_elevation_deg >= 60 ? 'var(--accent-success)' : p.max_elevation_deg >= 20 ? 'var(--accent-blue)' : 'var(--border-subtle)'}` }}>
                <span className="mono-text" style={{ color: 'var(--text-muted)' }}>{ts(p.aos_time_utc)}</span>
                <span className="mono-text" style={{ color: 'var(--text-muted)' }}>{ts(p.max_time_utc)}</span>
                <span className="mono-text" style={{ color: 'var(--text-muted)' }}>{ts(p.los_time_utc)}</span>
                <span className="mono-text" style={{ color: 'var(--accent-blue)' }}>{p.max_elevation_deg.toFixed(1)}°</span>
                <span className="mono-text" style={{ color: 'var(--text-muted)' }}>{dur(p.aos_time_utc, p.los_time_utc)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Disclaimer text="Pass predictions use TLE/GP-based SGP4 propagation and observer topocentric geometry. Geometric passes only — not guaranteed optical visibility." />
    </div>
  );
};

// ─── Relative Motion module ──────────────────────────────────────────────────

const RelativeMotionModule: React.FC<{ primaryId: number; primaryName: string }> = ({ primaryId, primaryName }) => {
  const [secondaryId, setSecondaryId] = useState('');
  const [windowH, setWindowH] = useState(24);
  const [result, setResult] = useState<RelativeMotionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const secId = parseInt(secondaryId.trim(), 10);
    if (!secId) { setError('Enter a valid secondary NORAD ID.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const { getAdvancedRelativeMotion } = await import('../../api/client');
      const now = new Date();
      const tca = new Date(now.getTime() + (windowH / 2) * 3600_000).toISOString();
      const data = await getAdvancedRelativeMotion(primaryId, secId, tca);
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const chartData = result?.distance_curve?.map((pt, i) => ({ x: i, y: pt.distance_km })) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px', overflowY: 'auto', height: '100%' }}>
      <Card title="Relative Motion">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={lbl}>Primary</div>
            <div style={{ ...val, color: 'var(--accent-blue)' }}>{primaryName} ({primaryId})</div>
          </div>
          <div>
            <div style={lbl}>Secondary NORAD ID</div>
            <input type="number" min={1} placeholder="e.g. 25545" value={secondaryId} onChange={e => setSecondaryId(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={lbl}>Window (hours)</div>
            <input type="number" min={1} max={168} value={windowH} onChange={e => setWindowH(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>
        <button onClick={run} disabled={loading} style={primaryBtn}>
          {loading ? <Spinner /> : 'Analyse Relative Motion'}
        </button>
        {error && <div style={{ color: 'var(--accent-danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}
      </Card>

      {result && (
        <Card title="Distance vs Time">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <Field label="TCA" value={result.tca_utc.replace('T', ' ').substring(0, 19) + ' UTC'} mono />
            <Field label="Relative Speed at TCA" value={`${result.relative_speed_kmps.toFixed(3)} km/s`} mono />
          </div>
          <LineChart data={chartData} width={520} height={180} color="var(--accent-cyan)" yLabel="Distance (km)" xLabel="Step index" />
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <button onClick={() => {
              const csv = ['timestamp_utc,distance_km', ...(result.distance_curve ?? []).map(pt => `${pt.timestamp_utc},${pt.distance_km}`)].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `trsat_relative_${primaryId}_${result.secondary_id}.csv`; a.click(); URL.revokeObjectURL(url);
            }} style={ghostBtn}>Export CSV</button>
          </div>
        </Card>
      )}

      <Disclaimer text="Geometric distance analysis, not a collision probability estimate. No covariance used. Both objects must be in the local catalog." />
    </div>
  );
};

// ─── Validation Center module ────────────────────────────────────────────────

interface RefValues { lat: string; lon: string; alt: string; provider: string; timestamp: string; note: string }

const ValidationModule: React.FC<{ noradId: number; objectName: string }> = ({ noradId, objectName }) => {
  const activeState = useConsoleStore(s => s.activeState);
  const [ref, setRef] = useState<RefValues>({ lat: '', lon: '', alt: '', provider: 'External (manual)', timestamp: '', note: '' });

  const diff = (tr: number | null | undefined, refStr: string): { d: string; ok: boolean } | null => {
    if (tr == null || !refStr) return null;
    const r = parseFloat(refStr);
    if (isNaN(r)) return null;
    const d = Math.abs(tr - r);
    return { d: d.toFixed(4), ok: d < 0.5 };
  };

  const latDiff = diff(activeState?.latitude_deg, ref.lat);
  const lonDiff = diff(activeState?.longitude_deg, ref.lon);
  const altDiff = diff(activeState?.altitude_km, ref.alt);

  const exportValidation = () => {
    const record = {
      schema: 'trsat.validation_comparison',
      schema_version: 1,
      created_at_utc: new Date().toISOString(),
      object: { norad_id: noradId, name: objectName },
      trsat_values: {
        latitude_deg: activeState?.latitude_deg ?? null,
        longitude_deg: activeState?.longitude_deg ?? null,
        altitude_km: activeState?.altitude_km ?? null,
        tle_epoch_utc: activeState?.tle_epoch_utc ?? null,
        tle_age_days: activeState?.tle_age_days ?? null,
        reliability: activeState?.reliability_status ?? null,
        propagation_model: 'SGP4',
      },
      reference_values: { ...ref },
      differences: {
        latitude_deg: latDiff?.d ?? null,
        longitude_deg: lonDiff?.d ?? null,
        altitude_km: altDiff?.d ?? null,
      },
      notes: 'External reference comparison. Source validity not verified.',
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `trsat_validation_${noradId}.json`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px', overflowY: 'auto', height: '100%' }}>
      <Card title="TR-SAT Predicted Values">
        {!activeState ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            No predicted state. Open the right panel → Predicted Orbital State → Refresh State first.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <Field label="Latitude" value={`${activeState.latitude_deg.toFixed(4)}°`} mono />
            <Field label="Longitude" value={`${activeState.longitude_deg.toFixed(4)}°`} mono />
            <Field label="Altitude" value={`${activeState.altitude_km.toFixed(1)} km`} mono />
            <Field label="TLE Epoch" value={activeState.tle_epoch_utc?.replace('T', ' ').substring(0, 19) ?? '—'} mono />
            <Field label="Element Age" value={activeState.tle_age_days != null ? `${activeState.tle_age_days.toFixed(2)} days` : '—'} mono />
            <Field label="Model" value="SGP4" />
          </div>
        )}
      </Card>

      <Card title="Reference Input (manual)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div><div style={lbl}>Reference Provider</div><input value={ref.provider} onChange={e => setRef(r => ({ ...r, provider: e.target.value }))} style={inputStyle} /></div>
          <div><div style={lbl}>Reference Timestamp (UTC)</div><input placeholder="2026-05-30 12:00:00" value={ref.timestamp} onChange={e => setRef(r => ({ ...r, timestamp: e.target.value }))} style={inputStyle} /></div>
          <div><div style={lbl}>Latitude (°)</div><input type="number" step="0.0001" placeholder="e.g. 38.62" value={ref.lat} onChange={e => setRef(r => ({ ...r, lat: e.target.value }))} style={inputStyle} /></div>
          <div><div style={lbl}>Longitude (°)</div><input type="number" step="0.0001" placeholder="e.g. 34.71" value={ref.lon} onChange={e => setRef(r => ({ ...r, lon: e.target.value }))} style={inputStyle} /></div>
          <div><div style={lbl}>Altitude (km)</div><input type="number" step="0.1" placeholder="e.g. 421.5" value={ref.alt} onChange={e => setRef(r => ({ ...r, alt: e.target.value }))} style={inputStyle} /></div>
          <div><div style={lbl}>Note</div><input placeholder="Source URL / screenshot label" value={ref.note} onChange={e => setRef(r => ({ ...r, note: e.target.value }))} style={inputStyle} /></div>
        </div>
      </Card>

      {(latDiff || lonDiff || altDiff) && (
        <Card title="Comparison">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', gap: '8px', fontSize: '11px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Metric</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>TR-SAT</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Reference</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>|Diff|</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Status</span>
            {[
              { metric: 'Latitude (°)', tr: activeState?.latitude_deg?.toFixed(4) ?? '—', ref: ref.lat || '—', d: latDiff },
              { metric: 'Longitude (°)', tr: activeState?.longitude_deg?.toFixed(4) ?? '—', ref: ref.lon || '—', d: lonDiff },
              { metric: 'Altitude (km)', tr: activeState?.altitude_km?.toFixed(1) ?? '—', ref: ref.alt || '—', d: altDiff },
            ].map(row => (
              <React.Fragment key={row.metric}>
                <span>{row.metric}</span>
                <span className="mono-text">{row.tr}</span>
                <span className="mono-text">{row.ref}</span>
                <span className="mono-text">{row.d?.d ?? '—'}</span>
                <span style={{ color: row.d ? (row.d.ok ? 'var(--accent-success)' : 'var(--accent-warning)') : 'var(--text-muted)' }}>
                  {row.d ? (row.d.ok ? 'Consistent' : 'Review') : '—'}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: '12px' }}>
            <button onClick={exportValidation} style={primaryBtn}>Export Validation Record (JSON)</button>
          </div>
        </Card>
      )}

      <Disclaimer text="External Reference Comparison — not absolute validation. TR-SAT values are SGP4 propagated estimates from orbital elements. Reference source validity, epoch, and propagation method are not verified. This record is for research transparency only." />
    </div>
  );
};

// ─── Reproducibility module ──────────────────────────────────────────────────

const SCHEMAS = [
  {
    id: 'trsat.research_record',
    version: 'v1',
    desc: 'Overview analysis record — object summary, data provenance, derived orbit parameters, SGP4 propagation model declaration.',
    module: 'Research Lab → Overview → Export Research Record',
  },
  {
    id: 'trsat.validation_comparison',
    version: 'v1',
    desc: 'External reference comparison — TR-SAT SGP4 predicted state vs manually entered reference position. Absolute lat/lon/alt differences.',
    module: 'Research Lab → Validation Center',
  },
  {
    id: 'trsat.conjunction_provenance',
    version: 'v1',
    desc: 'Per-result conjunction screening record — TCA, miss distance, TLE ages, covariance source, Pc heuristic. One file per conjunction pair.',
    module: 'Conjunction Analysis → per-card Export JSON',
  },
  {
    id: 'trsat.conjunction_study',
    version: 'v1',
    desc: 'Batch conjunction study export — all screening results with provenance, model declaration, and batch disclaimer.',
    module: 'Research Lab → Conjunction Study → Export All Results',
  },
];

const REPRO_STEPS = [
  'Record the NORAD Catalog ID of the object of interest.',
  'Note the TLE epoch (visible in Research Lab → Overview → Data Provenance).',
  'Record the propagation timestamp (UTC) used — the same epoch + propagation time must be used to reproduce any state vector.',
  'Export the Research Record JSON (trsat.research_record v1) for this object and timestamp.',
  'Re-ingest the same TLE (or OMM JSON) from CelesTrak/Space-Track for the same epoch.',
  'Run SGP4 with the same TLE elements and timestamp using any conformant SGP4 implementation (python-sgp4, Orekit, GMAT).',
  'Compare output — position differences should be sub-metre for identical inputs.',
];

const ReproducibilityModule: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px', overflowY: 'auto', height: '100%' }}>
    <Disclaimer text="Reproducibility in TR-SAT is defined as: given the same TLE/OMM elements and propagation timestamp, any conformant SGP4 implementation will produce the same result. Absolute accuracy relative to the physical object's true position depends on TLE quality and age — that is external to TR-SAT." />

    <Card title="How to Reproduce a TR-SAT Analysis">
      <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {REPRO_STEPS.map((step, i) => (
          <li key={i} style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55 }}>{step}</li>
        ))}
      </ol>
    </Card>

    <Card title="Record Schemas">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {SCHEMAS.map(s => (
          <div key={s.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
              <span className="mono-text" style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 700 }}>{s.id}</span>
              <span className="mono-text" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.version}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '4px' }}>{s.desc}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7 }}>From: {s.module}</div>
          </div>
        ))}
      </div>
    </Card>

    <Card title="External Verification Tools">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        <div><strong style={{ color: 'var(--text-primary)' }}>python-sgp4</strong> (brandon-rhodes/python-sgp4) — The same library TR-SAT uses internally. Feed the same TLE line1/line2 and epoch.</div>
        <div><strong style={{ color: 'var(--text-primary)' }}>Orekit / GMAT</strong> — For higher-fidelity numerical verification against SGP4 baselines.</div>
        <div><strong style={{ color: 'var(--text-primary)' }}>AGI STK / Celestia</strong> — For independent orbit visualisation and pass prediction comparison.</div>
        <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.7 }}>
          ⓘ SGP4 is deterministic for identical inputs — any deviation between tools indicates a different TLE, epoch, or implementation variant (SGP4 vs SGP8 vs SDP4/SDP8).
        </div>
      </div>
    </Card>
  </div>
);

// ─── Conjunction Study module ────────────────────────────────────────────────

const ConjunctionStudyModule: React.FC = () => {
  const { t } = useTranslation();
  const conjunctionResults = useConsoleStore(s => s.conjunctionResults);
  const [sortBy, setSortBy] = useState<'pc' | 'distance'>('pc');
  const [filterRisk, setFilterRisk] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  const ageFreshness = (days?: number | null): string => {
    if (days == null) return 'var(--text-muted)';
    if (days < 3) return '#22c55e';
    if (days < 7) return '#f59e0b';
    return '#ef4444';
  };

  const riskLabel = (level?: string | null): string => {
    if (level === 'HIGH') return t('conjunction.risk_high');
    if (level === 'MEDIUM') return t('conjunction.risk_medium');
    if (level === 'LOW') return t('conjunction.risk_low');
    return level ?? '—';
  };

  const filtered = [...conjunctionResults]
    .filter(r => filterRisk === 'ALL' || r.risk_level === filterRisk)
    .sort((a, b) =>
      sortBy === 'pc'
        ? (b.collision_probability ?? 0) - (a.collision_probability ?? 0)
        : a.miss_distance_km - b.miss_distance_km
    );

  const exportAll = () => {
    if (!filtered.length) return;
    const record = {
      schema: 'trsat.conjunction_study',
      schema_version: 1,
      created_at_utc: new Date().toISOString(),
      software_version: SOFTWARE_VERSION,
      result_count: filtered.length,
      propagation_model: 'SGP4',
      disclaimer: 'All results are experimental SGP4-based estimates. Pc values are heuristic. Not a CDM-grade product.',
      results: filtered.map((r, i) => ({
        index: i,
        primary_norad_id: r.primary_norad_id,
        secondary_norad_id: r.secondary_norad_id,
        tca_time: r.tca_time,
        miss_distance_km: r.miss_distance_km,
        relative_speed_km_per_s: r.relative_speed_km_per_s ?? null,
        risk_level: r.risk_level ?? r.severity,
        collision_probability: r.collision_probability ?? null,
        primary_tle_age_days: r.primary_tle_age_days ?? null,
        secondary_tle_age_days: r.secondary_tle_age_days ?? null,
        covariance_source: r.covariance_2d_km2 ? 'heuristic_2d' : 'none',
        primary_object_type: r.primary_object_type ?? null,
        secondary_object_type: r.secondary_object_type ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trsat_conjunction_study_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!conjunctionResults.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gap: '12px' }}>
        <FlaskConical size={30} strokeWidth={1.25} color="var(--text-muted)" />
        <div style={{ fontSize: '13px', lineHeight: 1.6, maxWidth: '440px' }}>
          {t('research_lab.conjunction_no_results')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px', overflowY: 'auto', height: '100%' }}>
      <Disclaimer text={t('research_lab.conjunction_disclaimer')} />

      <Card title={t('research_lab.conjunction_results')}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'pc' | 'distance')}
            style={{ ...inputStyle, width: 'auto', fontSize: '11px', padding: '4px 8px' }}
          >
            <option value="pc">Sort: Probability</option>
            <option value="distance">Sort: Miss Distance</option>
          </select>
          <select
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value as typeof filterRisk)}
            style={{ ...inputStyle, width: 'auto', fontSize: '11px', padding: '4px 8px' }}
          >
            <option value="ALL">All Risk Levels</option>
            <option value="HIGH">Elevated Alert</option>
            <option value="MEDIUM">Review Suggested</option>
            <option value="LOW">Monitor</option>
          </select>
          <button onClick={exportAll} style={{ ...ghostBtn, fontSize: '11px' }}>
            {t('research_lab.conjunction_all_export')}
          </button>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          {filtered.length} / {conjunctionResults.length} results
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((res: ConjunctionResult, idx: number) => {
            let riskColor = 'var(--text-muted)';
            if (res.risk_level === 'HIGH') riskColor = 'var(--accent-red)';
            else if (res.risk_level === 'MEDIUM') riskColor = 'var(--accent-orange)';
            else if (res.risk_level === 'LOW') riskColor = 'var(--accent-cyan)';
            const pc = res.collision_probability;

            return (
              <div key={idx} className="mono-text" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${riskColor}`, borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '11px' }}>
                {/* Risk header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: riskColor, fontWeight: 700, marginBottom: '8px' }}>
                  <span>{riskLabel(res.risk_level ?? res.severity)}</span>
                  <span>Pc (est.) {pc != null ? pc.toExponential(2) : '—'}</span>
                </div>

                {/* Core orbital data */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>TCA: </span>{res.tca_time.replace('T', ' ').slice(0, 19)}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Miss: </span>{res.miss_distance_km.toFixed(3)} km</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Primary: </span>NORAD {res.primary_norad_id}{res.primary_object_type ? ` (${res.primary_object_type})` : ''}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Secondary: </span>NORAD {res.secondary_norad_id}{res.secondary_object_type ? ` (${res.secondary_object_type})` : ''}</div>
                  {res.relative_speed_km_per_s != null && (
                    <div><span style={{ color: 'var(--text-muted)' }}>Rel. Speed: </span>{res.relative_speed_km_per_s.toFixed(2)} km/s</div>
                  )}
                </div>

                {/* Provenance strip — always visible in Research Lab */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '7px', display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
                    {t('conjunction.provenance_title')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <span>{t('conjunction.tle_age_primary')}: <span style={{ color: ageFreshness(res.primary_tle_age_days) }}>{res.primary_tle_age_days != null ? `${res.primary_tle_age_days.toFixed(1)} d` : '—'}</span></span>
                    <span>{t('conjunction.tle_age_secondary')}: <span style={{ color: ageFreshness(res.secondary_tle_age_days) }}>{res.secondary_tle_age_days != null ? `${res.secondary_tle_age_days.toFixed(1)} d` : '—'}</span></span>
                  </div>
                  <div>ⓘ {res.covariance_2d_km2 ? t('conjunction.covariance_present') : t('conjunction.covariance_absent')}</div>
                  <div>{t('conjunction.model_used')}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// ─── Main workspace ──────────────────────────────────────────────────────────

export const ResearchLabWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const open = useConsoleStore(s => s.researchLabOpen);
  const setOpen = useConsoleStore(s => s.setResearchLabOpen);
  const activeObject = useConsoleStore(s => s.activeObject);
  const activeState = useConsoleStore(s => s.activeState);
  const reliability = useConsoleStore(s => s.activeObjectReliability);
  const addLog = useConsoleStore(s => s.addLog);
  const [moduleId, setModuleId] = useState<ModuleId>('overview');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const tle = activeObject?.latest_tle;
  const mm = tle?.mean_motion_rev_per_day;
  const ecc = tle?.eccentricity;
  const periodMin = mm && mm > 0 ? 1440 / mm : null;
  const aKm = mm && mm > 0 ? Math.cbrt(MU / Math.pow((mm * 2 * Math.PI) / 86400, 2)) : null;
  const perigeeKm = aKm != null && ecc != null ? aKm * (1 - ecc) - R_EARTH : null;
  const apogeeKm = aKm != null && ecc != null ? aKm * (1 + ecc) - R_EARTH : null;
  const epoch = tle?.epoch ?? activeState?.tle_epoch_utc ?? reliability?.tle_epoch_utc ?? null;
  const ageDays = activeState?.tle_age_days ?? reliability?.tle_age_days ?? null;
  const reliabilityLabel = reliability?.reliability_label ?? activeState?.reliability_status ?? 'UNKNOWN';
  const sourceFormat = tle?.source_format ?? 'TLE';
  const formatLabel = sourceFormat === 'OMM_JSON' ? 'OMM JSON' : 'Legacy TLE';

  const fmt = (v: number | null | undefined, digits = 2, unit = '') =>
    v == null || !isFinite(v) ? '—' : `${v.toFixed(digits)}${unit ? ' ' + unit : ''}`;
  const fmtEpoch = (s: string | null) => s ? s.replace('T', ' ').substring(0, 19) + ' UTC' : '—';

  const confidenceColor =
    reliabilityLabel === 'FRESH' ? 'var(--accent-success)' :
    reliabilityLabel === 'AGING' ? 'var(--accent-warning)' :
    reliabilityLabel === 'STALE' ? 'var(--accent-danger)' : 'var(--text-muted)';

  const exportRecord = () => {
    if (!activeObject) return;
    const record = {
      schema: 'trsat.research_record', schema_version: 1,
      analysis_type: 'overview', created_at_utc: new Date().toISOString(),
      software_version: SOFTWARE_VERSION,
      object: { norad_id: activeObject.norad_id, name: activeObject.name, cospar_id: activeObject.cospar_id ?? null, object_type: activeObject.object_type, category: activeObject.category },
      data_provenance: { source_provider: activeObject.source, source_format: sourceFormat, element_epoch_utc: epoch, element_age_days: ageDays, reliability: reliabilityLabel, ingested_at_utc: tle?.ingested_at ?? null },
      propagation_model: 'SGP4',
      orbit_summary: { inclination_deg: tle?.inclination_deg ?? null, eccentricity: ecc ?? null, mean_motion_rev_per_day: mm ?? null, period_min: periodMin, perigee_km: perigeeKm, apogee_km: apogeeKm, bstar: tle?.bstar ?? null },
      assumptions: ['SGP4 analytic propagation from public orbital elements (TLE/GP).', 'No operational covariance; reliability is a heuristic from element age.', 'Perigee/apogee derived from mean motion and eccentricity (two-body).'],
    };
    try {
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `trsat_research_${activeObject.norad_id}_overview.json`; a.click(); URL.revokeObjectURL(url);
      addLog(`Research Lab: Exported research record for ${activeObject.name}.`);
    } catch { addLog('Research Lab: Export failed.'); }
  };

  const modules: { id: ModuleId; label: string }[] = [
    { id: 'overview',    label: t('research_lab.module_overview') },
    { id: 'validation',  label: t('research_lab.module_validation') },
    { id: 'evolution',   label: t('research_lab.module_evolution') },
    { id: 'passes',      label: t('research_lab.module_passes') },
    { id: 'relative',    label: t('research_lab.module_relative') },
    { id: 'conjunction', label: t('research_lab.module_conjunction') },
    { id: 'numerical',   label: t('research_lab.module_numerical') },
    { id: 'repro',       label: t('research_lab.module_repro') },
  ];

  const renderCanvas = () => {
    if (!activeObject) return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, maxWidth: '460px', margin: '0 auto' }}>
        {t('research_lab.no_object')}
      </div>
    );

    if (moduleId === 'evolution')   return <OrbitEvolutionModule noradId={activeObject.norad_id} objectName={activeObject.name} />;
    if (moduleId === 'passes')      return <PassAnalysisModule    noradId={activeObject.norad_id} objectName={activeObject.name} />;
    if (moduleId === 'relative')    return <RelativeMotionModule  primaryId={activeObject.norad_id} primaryName={activeObject.name} />;
    if (moduleId === 'validation')  return <ValidationModule      noradId={activeObject.norad_id} objectName={activeObject.name} />;
    if (moduleId === 'conjunction')  return <ConjunctionStudyModule />;
    if (moduleId === 'repro')        return <ReproducibilityModule />;

    if (moduleId !== 'overview') return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gap: '12px' }}>
        <FlaskConical size={30} strokeWidth={1.25} color="var(--text-muted)" />
        <div style={{ fontSize: '13px', lineHeight: 1.6, maxWidth: '420px' }}>{t('research_lab.planned')}</div>
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px', overflowY: 'auto', height: '100%' }}>
        <Card title={t('research_lab.object_summary')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <Field label="Name" value={activeObject.name} />
            <Field label="NORAD" value={activeObject.norad_id} mono />
            <Field label="COSPAR" value={activeObject.cospar_id || 'UNKNOWN'} mono />
            <Field label="Type" value={activeObject.object_type} />
            <Field label="Category" value={activeObject.category} />
            <Field label="Classification" value="Catalog Object" />
          </div>
        </Card>
        <Card title={t('research_lab.data_provenance')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <Field label="Source" value={activeObject.source} />
            <Field label="Format" value={formatLabel} />
            <Field label="Propagation Model" value="SGP4" />
            <Field label="Element Epoch" value={fmtEpoch(epoch)} mono />
            <Field label="Element Age" value={ageDays != null ? `${ageDays.toFixed(2)} days` : '—'} mono />
            <Field label="Reliability" value={<span style={{ color: confidenceColor }}>{reliabilityLabel}</span>} />
          </div>
        </Card>
        <Card title={t('research_lab.orbit_summary')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <Field label="Inclination" value={fmt(tle?.inclination_deg, 2, '°')} mono />
            <Field label="Eccentricity" value={fmt(ecc, 6)} mono />
            <Field label="Mean Motion" value={fmt(mm, 4, 'rev/day')} mono />
            <Field label="Period" value={fmt(periodMin, 1, 'min')} mono />
            <Field label="Perigee" value={fmt(perigeeKm, 1, 'km')} mono />
            <Field label="Apogee" value={fmt(apogeeKm, 1, 'km')} mono />
            <Field label="BSTAR (drag)" value={tle?.bstar != null ? tle.bstar.toExponential(3) : '—'} mono />
          </div>
        </Card>
        <Card title={t('research_lab.actions')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button onClick={exportRecord} style={{ ...primaryBtn }}>
              {t('research_lab.export_record')}
            </button>
            <button onClick={() => setModuleId('validation')} style={ghostBtn}>{t('research_lab.module_validation')}</button>
            <button onClick={() => setModuleId('evolution')} style={ghostBtn}>{t('research_lab.module_evolution')}</button>
            <button onClick={() => setModuleId('passes')} style={ghostBtn}>{t('research_lab.module_passes')}</button>
            <button onClick={() => setModuleId('relative')} style={ghostBtn}>{t('research_lab.module_relative')}</button>
            <button onClick={() => setModuleId('conjunction')} style={ghostBtn}>{t('research_lab.module_conjunction')}</button>
            <button onClick={() => setModuleId('repro')} style={ghostBtn}>{t('research_lab.module_repro')}</button>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', height: '56px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(8,18,32,0.6)', backdropFilter: 'blur(20px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FlaskConical size={16} color="var(--accent-blue)" />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('research_lab.title')}</span>
          {activeObject && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              · {activeObject.name} · SGP4 · <span style={{ color: confidenceColor, fontWeight: 600 }}>{reliabilityLabel}</span>
            </span>
          )}
        </div>
        <button onClick={() => setOpen(false)} title="Close (Esc)" style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, cursor: 'pointer', padding: '4px 10px' }}>&times;</button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Module nav */}
        <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', padding: '12px 8px', overflowY: 'auto', background: 'rgba(8,18,32,0.4)' }}>
          {modules.map(m => {
            const active = m.id === moduleId;
            return (
              <button key={m.id} onClick={() => setModuleId(m.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', marginBottom: '2px', borderRadius: 'var(--radius-sm)', border: 'none', borderLeft: active ? '2px solid var(--accent-blue)' : '2px solid transparent', background: active ? 'rgba(37,183,255,0.08)' : 'transparent', color: active ? 'var(--accent-blue)' : 'var(--text-muted)', fontSize: '12px', fontWeight: active ? 600 : 500, cursor: 'pointer' }}>
                {m.label}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{renderCanvas()}</div>
      </div>

      {/* Provenance footer */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-subtle)', padding: '8px 18px', fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(8,18,32,0.6)', display: 'flex', gap: '16px', flexWrap: 'wrap' }} className="mono-text">
        <span>Source: {activeObject ? activeObject.source : '—'}</span>
        <span>Format: {sourceFormat}</span>
        <span>Epoch: {fmtEpoch(epoch)}</span>
        <span>Model: SGP4</span>
        <span>Confidence: {reliabilityLabel}</span>
        <span>Software: v{SOFTWARE_VERSION}</span>
      </div>
    </div>
  );
};

export default ResearchLabWorkspace;
