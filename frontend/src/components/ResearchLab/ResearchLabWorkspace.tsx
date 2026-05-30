import React, { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { useTranslation } from '../../i18n/useTranslation';

const MU = 398600.4418; // km^3/s^2 (Earth GM)
const R_EARTH = 6378.137; // km
const SOFTWARE_VERSION = '3.0.0';

type ModuleId =
  | 'overview'
  | 'validation'
  | 'evolution'
  | 'passes'
  | 'relative'
  | 'conjunction'
  | 'numerical'
  | 'repro';

const labelStyle: React.CSSProperties = { fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' };
const valueStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 };
const sectionTitle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: '10px',
};

const Field: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <div style={labelStyle}>{label}</div>
    <div className={mono ? 'mono-text' : undefined} style={valueStyle}>
      {value}
    </div>
  </div>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div
    style={{
      background: 'var(--bg-panel-soft)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
    }}
  >
    <div style={sectionTitle}>{title}</div>
    {children}
  </div>
);

/**
 * Research Lab — a dedicated, full-viewport research workspace (overlay) rather
 * than an accordion panel. Phase 3 V1 implements the Research Overview module
 * (object summary, data provenance, derived orbit summary) plus a reproducible
 * JSON Research Record export. The remaining modules are structurally present
 * and show a "planned" state.
 */
export const ResearchLabWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const open = useConsoleStore((s) => s.researchLabOpen);
  const setOpen = useConsoleStore((s) => s.setResearchLabOpen);
  const activeObject = useConsoleStore((s) => s.activeObject);
  const activeState = useConsoleStore((s) => s.activeState);
  const reliability = useConsoleStore((s) => s.activeObjectReliability);
  const addLog = useConsoleStore((s) => s.addLog);
  const [moduleId, setModuleId] = useState<ModuleId>('overview');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
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

  const fmt = (v: number | null | undefined, digits = 2, unit = '') =>
    v == null || !isFinite(v) ? '—' : `${v.toFixed(digits)}${unit ? ' ' + unit : ''}`;
  const fmtEpoch = (s: string | null) => (s ? s.replace('T', ' ').substring(0, 19) + ' UTC' : '—');

  const exportRecord = () => {
    if (!activeObject) return;
    const record = {
      schema: 'trsat.research_record',
      schema_version: 1,
      analysis_type: 'overview',
      created_at_utc: new Date().toISOString(),
      software_version: SOFTWARE_VERSION,
      object: {
        norad_id: activeObject.norad_id,
        name: activeObject.name,
        cospar_id: activeObject.cospar_id ?? null,
        object_type: activeObject.object_type,
        category: activeObject.category,
      },
      data_provenance: {
        source_provider: activeObject.source,
        source_format: 'TLE',
        element_epoch_utc: epoch,
        element_age_days: ageDays,
        reliability: reliabilityLabel,
        ingested_at_utc: tle?.ingested_at ?? null,
      },
      propagation_model: 'SGP4',
      orbit_summary: {
        inclination_deg: tle?.inclination_deg ?? null,
        eccentricity: ecc ?? null,
        mean_motion_rev_per_day: mm ?? null,
        period_min: periodMin,
        perigee_km: perigeeKm,
        apogee_km: apogeeKm,
        bstar: tle?.bstar ?? null,
      },
      assumptions: [
        'SGP4 analytic propagation from public orbital elements (TLE/GP).',
        'No operational covariance; reliability is a heuristic from element age.',
        'Perigee/apogee derived from mean motion and eccentricity (two-body).',
      ],
    };
    try {
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trsat_research_${activeObject.norad_id}_overview.json`;
      a.click();
      URL.revokeObjectURL(url);
      addLog(`Research Lab: Exported research record for ${activeObject.name}.`);
    } catch {
      addLog('Research Lab: Export failed.');
    }
  };

  const modules: { id: ModuleId; label: string }[] = [
    { id: 'overview', label: t('research_lab.module_overview') },
    { id: 'validation', label: t('research_lab.module_validation') },
    { id: 'evolution', label: t('research_lab.module_evolution') },
    { id: 'passes', label: t('research_lab.module_passes') },
    { id: 'relative', label: t('research_lab.module_relative') },
    { id: 'conjunction', label: t('research_lab.module_conjunction') },
    { id: 'numerical', label: t('research_lab.module_numerical') },
    { id: 'repro', label: t('research_lab.module_repro') },
  ];

  const confidenceColor =
    reliabilityLabel === 'FRESH'
      ? 'var(--accent-success)'
      : reliabilityLabel === 'AGING'
      ? 'var(--accent-warning)'
      : reliabilityLabel === 'STALE'
      ? 'var(--accent-danger)'
      : 'var(--text-muted)';

  const renderCanvas = () => {
    if (!activeObject) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, maxWidth: '460px', margin: '0 auto' }}>
          {t('research_lab.no_object')}
        </div>
      );
    }

    if (moduleId !== 'overview') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gap: '12px' }}>
          <FlaskConical size={30} strokeWidth={1.25} color="var(--text-muted)" />
          <div style={{ fontSize: '13px', lineHeight: 1.6, maxWidth: '420px' }}>{t('research_lab.planned')}</div>
        </div>
      );
    }

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
            <Field label="Format" value="Legacy TLE" />
            <Field label="Propagation Model" value="SGP4" />
            <Field label="Element Epoch" value={fmtEpoch(epoch)} mono />
            <Field label="Element Age" value={ageDays != null ? `${ageDays.toFixed(2)} days` : '—'} mono />
            <Field
              label="Reliability"
              value={<span style={{ color: confidenceColor }}>{reliabilityLabel}</span>}
            />
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
            <button onClick={exportRecord} style={primaryActionBtn}>
              {t('research_lab.export_record')}
            </button>
            <button onClick={() => setModuleId('evolution')} style={ghostActionBtn}>
              {t('research_lab.module_evolution')}
            </button>
            <button onClick={() => setModuleId('passes')} style={ghostActionBtn}>
              {t('research_lab.module_passes')}
            </button>
            <button onClick={() => setModuleId('conjunction')} style={ghostActionBtn}>
              {t('research_lab.module_conjunction')}
            </button>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          height: '56px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(8, 18, 32, 0.6)',
          backdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FlaskConical size={16} color="var(--accent-blue)" />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {t('research_lab.title')}
          </span>
          {activeObject && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              · {activeObject.name} · SGP4 ·{' '}
              <span style={{ color: confidenceColor, fontWeight: 600 }}>{reliabilityLabel}</span>
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          title="Close (Esc)"
          style={{
            background: 'none',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            fontSize: '18px',
            lineHeight: 1,
            cursor: 'pointer',
            padding: '4px 10px',
          }}
        >
          &times;
        </button>
      </div>

      {/* Body: module nav + canvas */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div
          style={{
            width: '220px',
            flexShrink: 0,
            borderRight: '1px solid var(--border-subtle)',
            padding: '12px 8px',
            overflowY: 'auto',
            background: 'rgba(8, 18, 32, 0.4)',
          }}
        >
          {modules.map((m) => {
            const active = m.id === moduleId;
            return (
              <button
                key={m.id}
                onClick={() => setModuleId(m.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 12px',
                  marginBottom: '2px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  borderLeft: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  background: active ? 'rgba(37, 183, 255, 0.08)' : 'transparent',
                  color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>{renderCanvas()}</div>
      </div>

      {/* Provenance footer */}
      <div
        style={{
          flexShrink: 0,
          borderTop: '1px solid var(--border-subtle)',
          padding: '8px 18px',
          fontSize: '10px',
          color: 'var(--text-muted)',
          background: 'rgba(8, 18, 32, 0.6)',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
        }}
        className="mono-text"
      >
        <span>Source: {activeObject ? activeObject.source : '—'}</span>
        <span>Format: TLE</span>
        <span>Epoch: {fmtEpoch(epoch)}</span>
        <span>Model: SGP4</span>
        <span>Confidence: {reliabilityLabel}</span>
        <span>Software: v{SOFTWARE_VERSION}</span>
      </div>
    </div>
  );
};

const primaryActionBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'var(--accent-blue)',
  color: '#050B14',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const ghostActionBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
};

export default ResearchLabWorkspace;
