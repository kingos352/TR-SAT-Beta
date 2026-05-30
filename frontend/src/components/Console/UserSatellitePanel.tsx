import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  createUserSatellite, listUserSatellites, deleteUserSatellite,
  startUserConjunctionScreen, getUserConjunctionResult, getUserConjunctionExportUrl,
  UserSatelliteResponse, ConjunctionEvent, UserSatelliteCreate,
} from '../../api/client';
import { useConsoleStore } from '../../store/useConsoleStore';
import type { CatalogObject } from '../../api/client';

// Dispatch a globe fly-to via custom event (CesiumViewer listens)
function emitFlyToEci(x: number, y: number, z: number, name: string) {
  window.dispatchEvent(new CustomEvent('trsat:flyToEci', { detail: { x, y, z, name } }));
}

// ─── colour tokens (match app theme) ────────────────────────────────────────
const C = {
  bg: 'rgba(3,7,18,0.7)',
  border: 'var(--border-color)',
  accent: 'var(--accent-blue)',
  green: 'var(--accent-green)',
  red: 'var(--accent-red)',
  orange: 'var(--accent-orange)',
  text: 'var(--text-bright)',
  muted: 'var(--text-muted)',
  card: 'rgba(255,255,255,0.03)',
};

const RISK_COLOR: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const MISSION_TYPES = ['LEO', 'SSO', 'MEO', 'GEO', 'HEO', 'CUSTOM'];
const CATALOG_FILTERS = [
  { value: '', label: 'Tümü' },
  { value: 'DEBRIS', label: 'Debris' },
  { value: 'PAYLOAD', label: 'Payload' },
  { value: 'ROCKET_BODY', label: 'Roket Gövdesi' },
];

// ─── small helpers ────────────────────────────────────────────────────────────
const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', padding: '5px 7px', borderRadius: 5,
  background: C.bg, border: `1px solid ${C.border}`,
  color: C.text, fontSize: 11, outline: 'none', ...extra,
});
const label = (s?: React.CSSProperties): React.CSSProperties => ({
  fontSize: 10, color: C.muted, display: 'block', marginBottom: 2, ...s,
});
const btn = (bg: string, extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '6px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
  background: bg, color: C.text, fontSize: 11, fontWeight: 600, ...extra,
});

// ─── sub-form: TLE ────────────────────────────────────────────────────────────
const TLEForm: React.FC<{ value: UserSatelliteCreate; onChange: (v: UserSatelliteCreate) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div>
      <label style={label()}>TLE Satır 1 (69 karakter)</label>
      <input style={inp({ fontFamily: 'monospace' })} value={value.tle?.line1 ?? ''}
        placeholder="1 25544U ..."
        onChange={e => onChange({ ...value, tle: { ...value.tle!, line1: e.target.value } })} />
    </div>
    <div>
      <label style={label()}>TLE Satır 2 (69 karakter)</label>
      <input style={inp({ fontFamily: 'monospace' })} value={value.tle?.line2 ?? ''}
        placeholder="2 25544 ..."
        onChange={e => onChange({ ...value, tle: { ...value.tle!, line2: e.target.value } })} />
    </div>
    <div>
      <label style={label()}>Epoch (ISO UTC, boş = TLE epoch'u)</label>
      <input style={inp()} value={value.tle?.epoch_utc ?? ''}
        placeholder="2024-01-01T00:00:00Z (opsiyonel)"
        onChange={e => onChange({ ...value, tle: { ...value.tle!, epoch_utc: e.target.value || undefined } })} />
    </div>
  </div>
);

// ─── sub-form: Keplerian ──────────────────────────────────────────────────────
const KeplerianForm: React.FC<{ value: UserSatelliteCreate; onChange: (v: UserSatelliteCreate) => void }> = ({ value, onChange }) => {
  const k = value.keplerian ?? { sma_km: 6778, eccentricity: 0.001, inclination_deg: 51.6, raan_deg: 0, argp_deg: 0, mean_anomaly_deg: 0, epoch_utc: '' };
  const upd = (patch: object) => onChange({ ...value, keplerian: { ...k, ...patch } });
  const field = (lbl: string, key: string, placeholder: string) => (
    <div>
      <label style={label()}>{lbl}</label>
      <input type="number" style={inp()} value={(k as any)[key]} placeholder={placeholder}
        onChange={e => upd({ [key]: parseFloat(e.target.value) || 0 })} />
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {field('Yarı Büyük Eksen (km)', 'sma_km', '6778')}
      {field('Dışmerkezlik (e)', 'eccentricity', '0.001')}
      {field('Eğim (deg)', 'inclination_deg', '51.6')}
      {field('RAAN (deg)', 'raan_deg', '0')}
      {field('Perigee Arg. (deg)', 'argp_deg', '0')}
      {field('Ortalama Anomali (deg)', 'mean_anomaly_deg', '0')}
      <div style={{ gridColumn: '1/-1' }}>
        <label style={label()}>Epoch (ISO UTC)</label>
        <input style={inp()} value={k.epoch_utc}
          placeholder="2024-01-01T00:00:00Z"
          onChange={e => upd({ epoch_utc: e.target.value })} />
      </div>
    </div>
  );
};

// ─── sub-form: State Vector ───────────────────────────────────────────────────
const StateVectorForm: React.FC<{ value: UserSatelliteCreate; onChange: (v: UserSatelliteCreate) => void }> = ({ value, onChange }) => {
  const sv = value.state_vector ?? { pos_x_km: 0, pos_y_km: 0, pos_z_km: 6778, vel_x_kms: 7.5, vel_y_kms: 0, vel_z_kms: 0, epoch_utc: '' };
  const upd = (patch: object) => onChange({ ...value, state_vector: { ...sv, ...patch } });
  const field = (lbl: string, key: string) => (
    <div>
      <label style={label()}>{lbl}</label>
      <input type="number" step="any" style={inp()} value={(sv as any)[key]}
        onChange={e => upd({ [key]: parseFloat(e.target.value) || 0 })} />
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {field('X (km)', 'pos_x_km')} {field('Y (km)', 'pos_y_km')} {field('Z (km)', 'pos_z_km')}
      {field('Vx (km/s)', 'vel_x_kms')} {field('Vy (km/s)', 'vel_y_kms')} {field('Vz (km/s)', 'vel_z_kms')}
      <div style={{ gridColumn: '1/-1' }}>
        <label style={label()}>Epoch (ISO UTC)</label>
        <input style={inp()} value={sv.epoch_utc} placeholder="2024-01-01T00:00:00Z"
          onChange={e => upd({ epoch_utc: e.target.value })} />
      </div>
    </div>
  );
};

// ─── Conjunction results table ────────────────────────────────────────────────
const ConjunctionTable: React.FC<{ events: ConjunctionEvent[]; jobId: string }> = ({ events, jobId }) => {
  const [sortKey, setSortKey] = useState<keyof ConjunctionEvent>('pc');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const addLog = useConsoleStore(s => s.addLog);

  const sorted = [...events].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const toggleSort = (k: keyof ConjunctionEvent) => {
    if (k === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const thStyle: React.CSSProperties = {
    padding: '4px 6px', fontSize: 9, color: C.muted, textTransform: 'uppercase',
    letterSpacing: '0.08em', cursor: 'pointer', whiteSpace: 'nowrap',
    borderBottom: `1px solid ${C.border}`,
  };

  const fmtPc = (pc: number) => {
    if (pc === 0) return '< 10⁻¹⁰';
    const exp = Math.floor(Math.log10(pc));
    const man = (pc / Math.pow(10, exp)).toFixed(1);
    return `${man}×10${exp < 0 ? exp : '+' + exp}`;
  };

  const exportFile = (fmt: 'csv' | 'json') => {
    window.open(getUserConjunctionExportUrl(jobId, fmt), '_blank');
    addLog(`Conjunction export: ${fmt.toUpperCase()} indiriliyor...`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: C.muted }}>{events.length} konjunksiyon tespit edildi</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={btn(C.accent, { fontSize: 9, padding: '3px 7px' })} onClick={() => exportFile('csv')}>CSV</button>
          <button style={btn('rgba(99,102,241,0.8)', { fontSize: 9, padding: '3px 7px' })} onClick={() => exportFile('json')}>JSON</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <th style={thStyle}>Risk</th>
              <th style={{ ...thStyle, textAlign: 'left' }} onClick={() => toggleSort('name')}>Obje</th>
              <th style={thStyle} onClick={() => toggleSort('tca_utc' as any)}>TCA (UTC)</th>
              <th style={thStyle} onClick={() => toggleSort('miss_distance_km')}>Miss (km)</th>
              <th style={thStyle}>R / T / N (km)</th>
              <th style={thStyle} onClick={() => toggleSort('rel_velocity_kms')}>Vrel (km/s)</th>
              <th style={thStyle} onClick={() => toggleSort('pc')}>Pc</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ev, i) => (
              <tr key={i} style={{ borderBottom: `1px solid rgba(75,85,99,0.2)`, background: i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: RISK_COLOR[ev.risk_level] ?? '#fff' }} title={ev.risk_level} />
                </td>
                <td style={{ padding: '3px 6px', color: C.text, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 600 }}>{ev.name}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{ev.norad_id} · {ev.object_type}</div>
                </td>
                <td style={{ padding: '3px 6px', color: C.muted, fontFamily: 'monospace', fontSize: 9, whiteSpace: 'nowrap' }}>
                  {new Date(ev.tca_utc).toISOString().replace('T', ' ').slice(0, 19)}
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'right', color: C.text, fontFamily: 'monospace' }}>
                  {ev.miss_distance_km.toFixed(3)}
                </td>
                <td style={{ padding: '3px 6px', color: C.muted, fontFamily: 'monospace', fontSize: 9, whiteSpace: 'nowrap' }}>
                  {ev.miss_r_km.toFixed(2)} / {ev.miss_t_km.toFixed(2)} / {ev.miss_n_km.toFixed(2)}
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'right', color: C.muted, fontFamily: 'monospace' }}>
                  {ev.rel_velocity_kms.toFixed(3)}
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: RISK_COLOR[ev.risk_level] ?? C.text }}>
                  {fmtPc(ev.pc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────
const UserSatellitePanelInner: React.FC = () => {
  const addLog = useConsoleStore(s => s.addLog);
  const selectObject = useConsoleStore(s => s.selectObject);
  const setActiveObject = useConsoleStore(s => s.setActiveObject);
  const selectedObjects = useConsoleStore(s => s.selectedObjects);

  // Tab: 'add' | 'list' | 'screen' | 'results'
  const [tab, setTab] = useState<'add' | 'list' | 'screen' | 'results'>('add');

  // User satellites list
  const [satellites, setSatellites] = useState<UserSatelliteResponse[]>([]);
  const [satLoading, setSatLoading] = useState(false);

  // Add form
  const emptyForm = (): UserSatelliteCreate => ({
    name: '', mission_type: 'LEO', input_format: 'TLE',
    tle: { line1: '', line2: '', epoch_utc: undefined },
    covariance_simple: { sigma_r_km: 0.1, sigma_t_km: 1.0, sigma_n_km: 0.1 },
    physical: { hard_body_radius_m: 2, drag_area_m2: 0.04, srp_area_m2: 0.04, mass_kg: 12, cd: 2.2, cr: 1.4 },
  });
  const [form, setForm] = useState<UserSatelliteCreate>(emptyForm());
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [covMode, setCovMode] = useState<'auto' | 'simple'>('auto');

  // Screening
  const [selectedSatId, setSelectedSatId] = useState<number | null>(null);
  const [windowDays, setWindowDays] = useState(3);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [missDist, setMissDist] = useState(5.0);
  const [pcThreshold, setPcThreshold] = useState('1e-6');
  const [screenLoading, setScreenLoading] = useState(false);
  const [screenJobId, setScreenJobId] = useState('');
  const [screenStatus, setScreenStatus] = useState('');
  const [screenProgress, setScreenProgress] = useState(0);
  const [screenMsg, setScreenMsg] = useState('');
  const [events, setEvents] = useState<ConjunctionEvent[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSatellites = useCallback(async () => {
    setSatLoading(true);
    try {
      const sats = await listUserSatellites();
      setSatellites(sats);
    } catch (e: any) {
      addLog(`User Satellite: Yükleme hatası — ${e.message}`);
    } finally {
      setSatLoading(false);
    }
  }, [addLog]);

  useEffect(() => { loadSatellites(); }, [loadSatellites]);

  const handleAdd = async () => {
    setAddError('');
    if (!form.name.trim()) { setAddError('İsim gerekli.'); return; }

    // Strip covariance if auto mode selected
    const payload: UserSatelliteCreate = covMode === 'auto'
      ? { ...form, covariance_simple: undefined }
      : form;

    setAddLoading(true);
    try {
      const sat = await createUserSatellite(payload);
      addLog(`User Satellite: "${sat.name}" eklendi (ID ${sat.id}).`);
      setSatellites(prev => [sat, ...prev]);
      setForm(emptyForm());
      setTab('list');
    } catch (e: any) {
      setAddError(e.message ?? 'Bilinmeyen hata.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    await deleteUserSatellite(id);
    setSatellites(prev => prev.filter(s => s.id !== id));
    addLog(`User Satellite: "${name}" silindi.`);
  };

  const startScreening = async () => {
    if (!selectedSatId) { addLog('Konjunksiyon: Uydu seçilmedi.'); return; }
    if (pollRef.current) clearInterval(pollRef.current);
    setScreenLoading(true);
    setEvents([]);
    setScreenProgress(0);
    setScreenMsg('Başlatılıyor...');
    try {
      const res = await startUserConjunctionScreen({
        user_satellite_id: selectedSatId,
        window_days: windowDays,
        catalog_filter: catalogFilter || undefined,
        miss_distance_threshold_km: missDist,
        pc_threshold: parseFloat(pcThreshold),
      });
      setScreenJobId(res.job_id);
      setScreenStatus('RUNNING');
      addLog(`Konjunksiyon taraması başladı (Job: ${res.job_id.slice(0, 8)}...)`);

      pollRef.current = setInterval(async () => {
        try {
          const poll = await getUserConjunctionResult(res.job_id);
          setScreenProgress(poll.progress_pct);
          setScreenMsg(poll.progress_msg);
          setScreenStatus(poll.status);
          if (poll.status === 'COMPLETED' || poll.status === 'FAILED') {
            clearInterval(pollRef.current!);
            setScreenLoading(false);
            setEvents(poll.events);
            setTab('results');
            addLog(`Konjunksiyon tamamlandı: ${poll.total_events} olay bulundu.`);
          }
        } catch { clearInterval(pollRef.current!); setScreenLoading(false); }
      }, 2000);
    } catch (e: any) {
      setScreenLoading(false);
      addLog(`Konjunksiyon hatası: ${e.message}`);
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '5px 4px', border: 'none', cursor: 'pointer',
    background: active ? C.accent : 'transparent',
    color: active ? '#fff' : C.muted, fontSize: 10, fontWeight: 600,
    borderRadius: 4,
  });

  const FORMAT_TAB = (fmt: string): React.CSSProperties => ({
    flex: 1, padding: '4px', border: 'none', cursor: 'pointer',
    background: form.input_format === fmt ? 'rgba(59,130,246,0.3)' : 'transparent',
    color: form.input_format === fmt ? C.text : C.muted, fontSize: 10,
    borderRadius: 3,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 3 }}>
        <button style={TAB_STYLE(tab === 'add')} onClick={() => setTab('add')}>+ Uydu Ekle</button>
        <button style={TAB_STYLE(tab === 'list')} onClick={() => { setTab('list'); loadSatellites(); }}>
          Uydularım {satellites.length > 0 ? `(${satellites.length})` : ''}
        </button>
        <button style={TAB_STYLE(tab === 'screen')} onClick={() => setTab('screen')}>Tarama</button>
        <button style={{ ...TAB_STYLE(tab === 'results'), position: 'relative' }} onClick={() => setTab('results')}>
          Sonuçlar {events.length > 0 && <span style={{ background: '#ef4444', borderRadius: '50%', width: 14, height: 14, fontSize: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 3 }}>{events.length}</span>}
        </button>
      </div>

      {/* ── ADD TAB ── */}
      {tab === 'add' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Basic info */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <div>
              <label style={label()}>Uydu Adı</label>
              <input style={inp()} value={form.name} placeholder="ör. TR-SAT-1"
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={label()}>Misyon Tipi</label>
              <select style={inp()} value={form.mission_type}
                onChange={e => setForm({ ...form, mission_type: e.target.value })}>
                {MISSION_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Format tabs */}
          <div>
            <label style={label()}>Orbital Veri Formatı</label>
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: 2 }}>
              {(['TLE', 'KEPLERIAN', 'STATE_VECTOR'] as const).map(fmt => (
                <button key={fmt} style={FORMAT_TAB(fmt)}
                  onClick={() => setForm({ ...form, input_format: fmt })}>
                  {fmt === 'STATE_VECTOR' ? 'Durum Vektörü' : fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Format-specific form */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: 6, padding: 8 }}>
            {form.input_format === 'TLE' && <TLEForm value={form} onChange={setForm} />}
            {form.input_format === 'KEPLERIAN' && <KeplerianForm value={form} onChange={setForm} />}
            {form.input_format === 'STATE_VECTOR' && <StateVectorForm value={form} onChange={setForm} />}
          </div>

          {/* Covariance */}
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.muted, cursor: 'pointer' }}>
                <input type="radio" checked={covMode === 'auto'} onChange={() => setCovMode('auto')} />
                Otomatik (misyon tipine göre)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.muted, cursor: 'pointer' }}>
                <input type="radio" checked={covMode === 'simple'} onChange={() => setCovMode('simple')} />
                Manuel (σR, σT, σN)
              </label>
            </div>
            {covMode === 'simple' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {[
                  ['σR (km)', 'sigma_r_km', '0.1'],
                  ['σT (km)', 'sigma_t_km', '1.0'],
                  ['σN (km)', 'sigma_n_km', '0.1'],
                ].map(([lbl, key, ph]) => (
                  <div key={key}>
                    <label style={label()}>{lbl}</label>
                    <input type="number" step="any" style={inp()} placeholder={ph}
                      value={(form.covariance_simple as any)?.[key] ?? ''}
                      onChange={e => setForm({
                        ...form,
                        covariance_simple: { ...form.covariance_simple!, [key]: parseFloat(e.target.value) || 0 }
                      })} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Physical params */}
          <details open>
            <summary style={{ fontSize: 10, color: C.muted, cursor: 'pointer', userSelect: 'none', marginBottom: 4 }}>
              Fiziksel Parametreler (Sürükleme / SRP)
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
              {[
                ['Kütle (kg)', 'mass_kg', '12'],
                ['Hard Body Radius (m)', 'hard_body_radius_m', '2'],
                ['Sürükleme Alanı A_drag (m²)', 'drag_area_m2', '0.04'],
                ['SRP Alanı A_srp (m²)', 'srp_area_m2', '0.04'],
                ['Cd (sürükleme katsayısı)', 'cd', '2.2'],
                ['Cr (yansıma katsayısı)', 'cr', '1.4'],
              ].map(([lbl, key, ph]) => (
                <div key={key}>
                  <label style={label()}>{lbl}</label>
                  <input type="number" step="any" style={inp()} placeholder={ph}
                    value={(form.physical as any)?.[key] ?? ''}
                    onChange={e => setForm({
                      ...form,
                      physical: { ...form.physical!, [key]: parseFloat(e.target.value) || 0 }
                    })} />
                </div>
              ))}
            </div>
          </details>

          {addError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent-red)', borderRadius: 5, padding: '6px 10px', fontSize: 10, color: C.red }}>
              {addError}
            </div>
          )}

          <button style={btn(C.green, { width: '100%', padding: 9 })}
            disabled={addLoading} onClick={handleAdd}>
            {addLoading ? 'Hesaplanıyor...' : 'Uyduyu Ekle ve ECI Hesapla'}
          </button>
        </div>
      )}

      {/* ── LIST TAB ── */}
      {tab === 'list' && (
        <div>
          {satLoading && <div style={{ color: C.muted, fontSize: 11 }}>Yükleniyor...</div>}
          {!satLoading && satellites.length === 0 && (
            <div style={{ color: C.muted, fontSize: 11, textAlign: 'center', padding: 16 }}>
              Henüz uydu eklenmemiş.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {satellites.map(s => {
              const isSelected = selectedObjects.some(o => o.norad_id === -(s.id));
              const alt = Math.round(Math.sqrt(s.pos_x_km**2 + s.pos_y_km**2 + s.pos_z_km**2) - 6378.137);

              const handleSelect = () => {
                const catalogObj: CatalogObject = {
                  norad_id: -(s.id),          // negative ID → user satellite namespace
                  name: s.name,
                  object_type: 'USER_SAT',
                  category: s.mission_type,
                  source: 'USER',
                  source_group: 'USER',
                  last_updated: s.created_at,
                };
                selectObject(catalogObj);
                setActiveObject(catalogObj);
                addLog(`User Satellite: "${s.name}" aktif obje olarak seçildi.`);
              };

              const handleFocus = () => {
                emitFlyToEci(s.pos_x_km, s.pos_y_km, s.pos_z_km, s.name);
                addLog(`Globe: "${s.name}" konumuna odaklanılıyor...`);
              };

              return (
                <div key={s.id} style={{
                  background: isSelected ? 'rgba(59,130,246,0.08)' : C.card,
                  border: `1px solid ${isSelected ? 'var(--accent-blue)' : C.border}`,
                  borderRadius: 6, padding: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {s.name}
                        {isSelected && <span style={{ fontSize: 8, background: 'var(--accent-blue)', color: '#fff', borderRadius: 3, padding: '1px 4px' }}>AKTİF</span>}
                      </div>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
                        {s.mission_type} · {s.input_format} · ~{alt} km
                      </div>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: 'monospace', marginTop: 1 }}>
                        {s.epoch_utc.slice(0, 19).replace('T', ' ')} UTC
                      </div>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: 'monospace' }}>
                        {s.mass_kg} kg · A_drag={s.drag_area_m2} m² · Cd={s.cd}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                      <button
                        style={btn(isSelected ? 'rgba(59,130,246,0.4)' : C.accent, { fontSize: 9, padding: '3px 8px', minWidth: 52 })}
                        onClick={handleSelect}
                        title="Aktif obje olarak seç ve izleme listesine ekle"
                      >
                        {isSelected ? '✓ Seçili' : 'Seç'}
                      </button>
                      <button
                        style={btn('rgba(16,185,129,0.2)', { fontSize: 9, padding: '3px 8px', border: `1px solid ${C.green}`, color: C.green })}
                        onClick={handleFocus}
                        title="Globe kamerasını bu uydunun konumuna odakla"
                      >
                        Odakla
                      </button>
                      <button
                        style={btn('rgba(59,130,246,0.15)', { fontSize: 9, padding: '3px 8px', border: `1px solid var(--accent-blue)`, color: 'var(--accent-blue)' })}
                        onClick={() => { setSelectedSatId(s.id); setTab('screen'); }}
                        title="Konjunksiyon taraması başlat"
                      >
                        Tara
                      </button>
                      <button
                        style={btn('rgba(239,68,68,0.1)', { fontSize: 9, padding: '3px 8px', border: `1px solid ${C.red}`, color: C.red })}
                        onClick={() => handleDelete(s.id, s.name)}
                        title="Uyduyu sil"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SCREEN TAB ── */}
      {tab === 'screen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div>
            <label style={label()}>Taranacak Uydu</label>
            <select style={inp()} value={selectedSatId ?? ''}
              onChange={e => setSelectedSatId(parseInt(e.target.value))}>
              <option value="">-- Seç --</option>
              {satellites.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.mission_type})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={label()}>Pencere: {windowDays} gün</label>
              <input type="range" min={1} max={7} step={1} value={windowDays}
                onChange={e => setWindowDays(parseInt(e.target.value))}
                style={{ width: '100%' }} />
            </div>
            <div>
              <label style={label()}>Katalog Filtresi</label>
              <select style={inp()} value={catalogFilter}
                onChange={e => setCatalogFilter(e.target.value)}>
                {CATALOG_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label style={label()}>Max Miss Distance (km)</label>
              <input type="number" step="0.1" min="0.1" style={inp()} value={missDist}
                onChange={e => setMissDist(parseFloat(e.target.value) || 1)} />
            </div>
            <div>
              <label style={label()}>Min Pc Eşiği</label>
              <select style={inp()} value={pcThreshold}
                onChange={e => setPcThreshold(e.target.value)}>
                <option value="1e-7">10⁻⁷</option>
                <option value="1e-6">10⁻⁶ (varsayılan)</option>
                <option value="1e-5">10⁻⁵</option>
                <option value="1e-4">10⁻⁴</option>
              </select>
            </div>
          </div>

          {screenLoading && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted, marginBottom: 3 }}>
                <span>{screenMsg}</span><span>{screenProgress}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${screenProgress}%`, height: '100%', background: C.accent, transition: 'width 0.4s', borderRadius: 3 }} />
              </div>
            </div>
          )}

          <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 5, padding: '7px 10px', fontSize: 10, color: '#eab308' }}>
            ⚠ Numerik propagasyon (RK45 + J2–J6 + drag + SRP) kullanır. Tam katalog taraması 2–5 dakika sürebilir.
          </div>

          <button style={btn(C.green, { width: '100%', padding: 9 })}
            disabled={screenLoading || !selectedSatId} onClick={startScreening}>
            {screenLoading ? `Taranıyor... (${screenProgress}%)` : 'Konjunksiyon Taraması Başlat'}
          </button>
        </div>
      )}

      {/* ── RESULTS TAB ── */}
      {tab === 'results' && (
        <div>
          {events.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 11, textAlign: 'center', padding: 16 }}>
              {screenStatus === 'RUNNING' ? 'Tarama devam ediyor...' : 'Sonuç yok. Önce tarama başlatın.'}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(r => {
                  const n = events.filter(e => e.risk_level === r).length;
                  if (!n) return null;
                  return (
                    <span key={r} style={{ background: `${RISK_COLOR[r]}22`, border: `1px solid ${RISK_COLOR[r]}`, color: RISK_COLOR[r], borderRadius: 4, padding: '2px 7px', fontSize: 9, fontWeight: 700 }}>
                      {r}: {n}
                    </span>
                  );
                })}
              </div>
              <ConjunctionTable events={events} jobId={screenJobId} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const UserSatellitePanel = React.memo(UserSatellitePanelInner);
