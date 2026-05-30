import React, { useState } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { useTranslation } from '../../i18n/useTranslation';

const ONBOARD_KEY = 'trsat_onboarded_v1';

const ghostBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'var(--accent-blue)',
  color: '#050B14',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};

interface TourStep {
  title: string;
  body: string;
  primary: { label: string; onClick: () => void; disabled?: boolean };
  secondary?: { label: string; onClick: () => void };
  note?: string | null;
}

/**
 * First-launch guided mission. Additive overlay shown once (localStorage-gated)
 * after credential setup is complete — it does not alter the startup/setup gate.
 * "Track ISS" is best-effort: it loads NORAD 25544 if the catalog is synced,
 * otherwise it hints to sync and still lets the user continue.
 */
export const GuidedTour: React.FC = () => {
  const { t } = useTranslation();
  const setActiveObject = useConsoleStore((s) => s.setActiveObject);
  const addLog = useConsoleStore((s) => s.addLog);

  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARD_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [step, setStep] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState(false);

  if (!visible) return null;

  const finish = () => {
    try {
      localStorage.setItem(ONBOARD_KEY, '1');
    } catch {
      /* ignore storage failures */
    }
    setVisible(false);
  };

  const trackISS = async () => {
    setTracking(true);
    setTrackError(false);
    try {
      const { getCatalogObject } = await import('../../api/client');
      const iss = await getCatalogObject(25544);
      setActiveObject(iss);
      addLog('Onboarding: ISS (ZARYA) set as active target.');
      setStep(4);
    } catch {
      setTrackError(true);
    } finally {
      setTracking(false);
    }
  };

  const steps: TourStep[] = [
    {
      title: t('onboarding.welcome_title'),
      body: t('onboarding.welcome_body'),
      primary: { label: t('onboarding.welcome_start'), onClick: () => setStep(1) },
    },
    {
      title: t('onboarding.data_title'),
      body: t('onboarding.data_body'),
      primary: { label: t('onboarding.next'), onClick: () => setStep(2) },
    },
    {
      title: t('onboarding.station_title'),
      body: t('onboarding.station_body'),
      primary: { label: t('onboarding.next'), onClick: () => setStep(3) },
    },
    {
      title: t('onboarding.iss_title'),
      body: t('onboarding.iss_body'),
      primary: {
        label: tracking ? t('onboarding.iss_tracking') : t('onboarding.iss_track'),
        onClick: trackISS,
        disabled: tracking,
      },
      secondary: { label: t('onboarding.next'), onClick: () => setStep(4) },
      note: trackError ? t('onboarding.iss_error') : null,
    },
    {
      title: t('onboarding.science_title'),
      body: t('onboarding.science_body'),
      primary: { label: t('onboarding.science_finish'), onClick: finish },
    },
  ];

  const cur = steps[step];
  const total = steps.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 11, 20, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '460px',
          margin: '0 16px',
          padding: '28px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          background: 'rgba(8, 18, 32, 0.97)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <button
          onClick={finish}
          title={t('onboarding.skip')}
          style={{
            position: 'absolute',
            top: '12px',
            right: '14px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '20px',
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          &times;
        </button>

        <div
          style={{
            fontSize: '10px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--accent-blue)',
            fontWeight: 700,
            marginBottom: '10px',
          }}
        >
          TR-SAT · {t('onboarding.step')} {step + 1}/{total}
        </div>

        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
          {cur.title}
        </h2>
        <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-muted)', marginBottom: '18px' }}>
          {cur.body}
        </p>

        {cur.note && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--accent-warning)',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              marginBottom: '14px',
            }}
          >
            {cur.note}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={ghostBtn}>
              {t('onboarding.back')}
            </button>
          )}
          {cur.secondary && (
            <button onClick={cur.secondary.onClick} style={ghostBtn}>
              {cur.secondary.label}
            </button>
          )}
          <button onClick={cur.primary.onClick} disabled={cur.primary.disabled} style={primaryBtn}>
            {cur.primary.label}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '18px' }}>
          {steps.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? '18px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === step ? 'var(--accent-blue)' : 'var(--border-subtle)',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
