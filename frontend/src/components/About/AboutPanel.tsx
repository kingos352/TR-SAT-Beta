import React from 'react';
import ReactDOM from 'react-dom';

const DISCLAIMER_ROWS = [
  {
    heading: 'Propagation Model',
    body: 'TR-SAT uses SGP4 — an analytic orbit propagation model driven by public Two-Line Element (TLE/GP) sets from CelesTrak and Space-Track. SGP4 is suitable for general surveillance and pass prediction; it is NOT a precision orbit determination (OD) product.',
  },
  {
    heading: 'Predicted State Vectors',
    body: 'All position, velocity, latitude/longitude/altitude, and ECEF values are analytically propagated estimates. No real-time telemetry is received from any spacecraft. Accuracy degrades with TLE age — check the element epoch and reliability label before relying on any result.',
  },
  {
    heading: 'Conjunction Screening & Pc',
    body: 'Conjunction miss distances are geometric SGP4-based estimates. Collision probability (Pc) values are heuristic: position uncertainty is synthesised from TLE element age and object type; no operational covariance matrix is used. Results are NOT CDM-grade products and must not be used for operational collision avoidance.',
  },
  {
    heading: 'Pass & Visibility Predictions',
    body: 'Pass AOS/TCA/LOS times and visibility windows are approximate. Results depend on TLE freshness, observer coordinates, and minimum elevation threshold. Atmospheric refraction is not modelled.',
  },
  {
    heading: 'Data Sources',
    body: 'CelesTrak (Dr. T.S. Kelso — celestrak.org): public SATCAT/GP data. Space-Track (18th SDS / space-track.org): requires registration, subject to usage terms. Open-Meteo (open-meteo.com): weather data. All data is retrieved from public APIs at the time of sync.',
  },
  {
    heading: 'Privacy',
    body: 'TR-SAT is a local-first application. All orbital data, analysis results, and settings are stored exclusively on your device in a local SQLite database. No usage telemetry, analytics, or personal data is transmitted to any external server.',
  },
];

interface AboutPanelProps {
  onClose: () => void;
  isTr?: boolean;
}

export const AboutPanel: React.FC<AboutPanelProps> = ({ onClose, isTr }) => {
  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(5, 11, 20, 0.88)',
        backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '600px', maxHeight: '85vh',
          overflowY: 'auto',
          padding: '28px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(8, 18, 32, 0.98)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75)',
          display: 'flex', flexDirection: 'column', gap: '18px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
              TR-SAT MISSION CONTROL
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Version 4.0.0 · SGP4 Orbital Intelligence Platform · Local-First
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '16px', cursor: 'pointer', padding: '3px 10px', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* Disclaimer section */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent-warning)', marginBottom: '12px' }}>
            Scientific Limitations & Disclaimers
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {DISCLAIMER_ROWS.map(row => (
              <div key={row.heading} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                  {row.heading}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  {row.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stack */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Technology Stack
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '10px', color: 'var(--text-muted)' }} className="mono-text">
            {[
              ['Frontend', 'React 18 · TypeScript · Vite 5'],
              ['3D Globe', 'CesiumJS 1.115'],
              ['State', 'Zustand 4.5'],
              ['Backend', 'FastAPI · Python 3.12 · Uvicorn'],
              ['Astrodynamics', 'sgp4 2.25 · Skyfield 1.54'],
              ['Database', 'SQLite · SQLAlchemy 2.0'],
              ['Desktop', 'Tauri v2 · WebView2'],
              ['AI Assistant', 'Gemini 2.5 Flash (optional)'],
            ].map(([k, v]) => (
              <div key={k}><span style={{ color: 'var(--text-primary)' }}>{k}:</span> {v}</div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {isTr
            ? 'Tüm analiz verileri yalnızca yerel cihazınızda depolanır. Hiçbir kullanıcı verisi veya telemetri dışarıya gönderilmez.'
            : 'All analysis data is stored exclusively on your local device. No user data or telemetry is transmitted externally.'}
        </div>
      </div>
    </div>,
    document.body
  );
};
