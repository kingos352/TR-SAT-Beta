import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useConsoleStore } from '../../store/useConsoleStore';
import { getHealth, API_BASE_URL } from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';
import { Settings, Globe, MapPin, Satellite, Radio, Info } from 'lucide-react';
import { AboutPanel } from '../About/AboutPanel';

const StatusBarInner: React.FC = () => {
  const [utcTime, setUtcTime] = useState<string>('');
  const apiStatus = useConsoleStore(s => s.apiStatus);
  const setApiStatus = useConsoleStore(s => s.setApiStatus);
  const selectedObjects = useConsoleStore(s => s.selectedObjects);
  const activeObject = useConsoleStore(s => s.activeObject);
  const observer = useConsoleStore(s => s.observer);
  const addLog = useConsoleStore(s => s.addLog);
  const liveTrackingEnabled = useConsoleStore(s => s.liveTrackingEnabled);
  const liveConnectionStatus = useConsoleStore(s => s.liveConnectionStatus);
  const liveRateHz = useConsoleStore(s => s.liveRateHz);
  const lastTelemetryFrameUtc = useConsoleStore(s => s.lastTelemetryFrameUtc);
  const language = useConsoleStore(s => s.language);
  const setLanguage = useConsoleStore(s => s.setLanguage);
  const observationScore = useConsoleStore(s => s.observationScore);

  useTranslation(); // keep hook call for future use
  const isTr = language === 'tr';

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [settingsData, setSettingsData] = useState({
    cesium_token: '',
    spacetrack_user: '',
    spacetrack_password: '',
    ai_key: ''
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (showSettingsModal) {
      const fetchConfig = async () => {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/v1/config/current`);
          if (resp.ok) {
            const data = await resp.json();
            setSettingsData({
              cesium_token: data.cesium_token || '',
              spacetrack_user: data.spacetrack_user || '',
              spacetrack_password: data.spacetrack_password || '',
              ai_key: data.ai_key || ''
            });
          }
        } catch (err) {
          console.error('Failed to load current config', err);
        }
      };
      fetchConfig();
    }
  }, [showSettingsModal]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/v1/config/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData)
      });
      if (!resp.ok) {
        throw new Error(isTr ? 'Ayarlar kaydedilemedi.' : 'Failed to save settings.');
      }
      addLog(isTr ? 'Sistem: Ayarlar başarıyla güncellendi. Yeniden başlatılıyor...' : 'System: Settings successfully updated. Restarting...');
      window.location.reload();
    } catch (err: any) {
      setSettingsError(err.message);
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').substring(0, 19));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const checkConnection = async () => {
      try {
        await getHealth();
        if (active && apiStatus !== 'connected') {
          setApiStatus('connected');
          addLog('System: Backend API connected successfully.');
        }
      } catch (err: any) {
        if (active && apiStatus !== 'disconnected') {
          setApiStatus('disconnected', err.message);
          addLog(`CRITICAL: Backend API disconnected. Retrying... (${err.message})`);
        }
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [apiStatus, setApiStatus, addLog]);

  const liveStatus = !liveTrackingEnabled ? 'offline'
    : liveConnectionStatus === 'LIVE' ? 'live'
    : liveConnectionStatus === 'PAUSED' ? 'paused'
    : 'offline';

  const apiOnline = apiStatus === 'connected';

  return (
    <>
    <header style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px 0 0',
      backgroundColor: 'rgba(5, 11, 20, 0.55)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      zIndex: 30,
      gap: '8px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <img
          src="/TR_SAT.png"
          alt="TR-SAT Logo"
          style={{
            height: '56px',
            objectFit: 'contain',
            transform: 'scale(2.2)',
            transformOrigin: 'left center',
            marginLeft: '15px',
          }}
        />
      </div>

      {/* Center — UTC Clock: absolutely centered so it's always at true screen midpoint */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        pointerEvents: 'none',
      }}>
        <span
          className="mono-text"
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
          }}
        >
          {utcTime}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.6, fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
          UTC
        </span>
      </div>

      {/* Right — Compact badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>

        {/* Selected count */}
        <span
          className={`badge${selectedObjects.length > 0 ? ' badge--active' : ''}`}
          title={isTr ? `İzlenen nesne: ${selectedObjects.length} / 20` : `Tracked objects: ${selectedObjects.length} / 20`}
        >
          <Satellite size={10} strokeWidth={2} />
          {selectedObjects.length}/20
        </span>

        {/* Active satellite */}
        {activeObject ? (
          <span className="badge badge--active" title={`NORAD ${activeObject.norad_id}`}>
            {activeObject.name.length > 14 ? activeObject.name.substring(0, 14) + '…' : activeObject.name}
          </span>
        ) : (
          <span className="badge" style={{ opacity: 0.5 }}>—</span>
        )}

        {/* Observer station */}
        <span className="badge">
          <MapPin size={10} strokeWidth={2} />
          {observer.name}
        </span>

        {/* Live tracking */}
        <span className={`badge${liveStatus === 'live' ? ' badge--live' : liveStatus === 'paused' ? ' badge--warn' : ' badge--offline'}`}>
          <Radio size={10} strokeWidth={2} />
          {liveStatus === 'live'
            ? `Live · ${liveRateHz}Hz`
            : liveStatus === 'paused'
            ? 'Paused'
            : 'Offline'}
          {liveStatus === 'live' && lastTelemetryFrameUtc && (
            <span style={{ opacity: 0.7, marginLeft: 2, fontSize: '9px' }}>
              {lastTelemetryFrameUtc.substring(11, 19)}
            </span>
          )}
        </span>

        {/* API status */}
        <span className={`badge${apiOnline ? ' badge--live' : ' badge--offline'}`}>
          <span
            className={`status-indicator ${apiOnline ? 'status-ok' : 'status-error'}`}
            style={{ width: '5px', height: '5px' }}
          />
          {`Backend: ${apiOnline ? (isTr ? 'Bağlı' : 'Online') : (isTr ? 'Bağlantı Yok' : 'Offline')}`}
        </span>

        {/* Observation quality mini ring */}
        {observationScore !== null && (() => {
          const s = observationScore;
          const color = s >= 75 ? 'var(--accent-success)' : s >= 50 ? 'var(--accent-blue)' : s >= 25 ? 'var(--accent-warning)' : 'var(--accent-danger)';
          const label = s >= 75 ? 'Excellent' : s >= 50 ? 'Good' : s >= 25 ? 'Fair' : 'Poor';
          const r = 10, cx = 14, cy = 14, circ = 2 * Math.PI * r;
          const dash = (s / 100) * circ;
          return (
            <div
              title={`Observation Quality: ${s}/100 — ${label}`}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'default' }}
            >
              <svg width="28" height="28">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle
                  cx={cx} cy={cy} r={r} fill="none"
                  stroke={color} strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  strokeDashoffset={circ / 4}
                  style={{ filter: `drop-shadow(0 0 3px ${color}99)` }}
                />
                <text x={cx} y={cy + 4} textAnchor="middle" fill={color} fontSize="7" fontWeight="700" fontFamily="'JetBrains Mono',monospace">{s}</text>
              </svg>
              <span style={{ fontSize: '10px', color, fontWeight: 600 }}>{label}</span>
            </div>
          );
        })()}

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)', margin: '0 2px' }} />

        {/* Language toggle */}
        <button
          className="icon-btn"
          onClick={() => setLanguage(language === 'en' ? 'tr' : 'en')}
          title={language === 'en' ? 'Switch to Turkish' : "İngilizce'ye Geç"}
          style={{ gap: '4px', padding: '5px 8px', fontSize: '11px', fontWeight: 600 }}
        >
          <Globe size={13} strokeWidth={1.75} />
          {language.toUpperCase()}
        </button>

        {/* About */}
        <button
          className="icon-btn"
          onClick={() => setShowAbout(true)}
          title={isTr ? 'Hakkında & Sorumluluk Reddi' : 'About & Disclaimers'}
        >
          <Info size={14} strokeWidth={1.75} />
        </button>

        {/* Settings */}
        <button
          className="icon-btn"
          onClick={() => setShowSettingsModal(true)}
          title={isTr ? 'Sistem Ayarları' : 'System Settings'}
        >
          <Settings size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* About modal */}
    </header>
      {showAbout && <AboutPanel onClose={() => setShowAbout(false)} isTr={isTr} />}

      {/* Portal: render outside <header> so backdrop-filter doesn't trap position:fixed */}
      {showSettingsModal && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(5, 11, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            padding: '28px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'rgba(8, 18, 32, 0.98)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
          }}>
            <h2 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={16} strokeWidth={1.75} color="var(--accent-blue)" />
                {isTr ? 'Sistem Ayarları' : 'System Settings'}
              </span>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '18px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '2px 6px',
                }}
              >
                &times;
              </button>
            </h2>

            {settingsError && (
              <div style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(255, 77, 109, 0.08)',
                border: '1px solid var(--accent-danger)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--accent-danger)',
                fontSize: '12px',
                marginBottom: '16px',
              }}>
                {settingsError}
              </div>
            )}

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Cesium ION Token', key: 'cesium_token', type: 'text', required: true },
                { label: 'SpaceTrack Username', key: 'spacetrack_user', type: 'text', required: true },
                { label: 'SpaceTrack Password', key: 'spacetrack_password', type: 'password', required: true },
                { label: 'AI Key (Gemini · Optional)', key: 'ai_key', type: 'password', required: false },
              ].map(field => (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {field.label}
                    {field.required && <span style={{ color: 'var(--accent-danger)', marginLeft: 3 }}>*</span>}
                  </label>
                  <input
                    type={field.type}
                    value={(settingsData as any)[field.key]}
                    onChange={e => setSettingsData({ ...settingsData, [field.key]: e.target.value })}
                    required={field.required}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      fontFamily: 'var(--font-ui)',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => { try { localStorage.removeItem('trsat_onboarded_v1'); } catch { /* ignore */ } window.location.reload(); }}
                style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer', padding: 0, marginTop: '4px' }}
              >
                {isTr ? 'Rehberli Turu Yeniden Başlat' : 'Restart Guided Tour'}
              </button>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  {isTr ? 'İptal' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={settingsLoading}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: 'var(--accent-blue)',
                    color: '#050B14',
                    fontWeight: 700,
                    cursor: settingsLoading ? 'wait' : 'pointer',
                    fontSize: '12px',
                    opacity: settingsLoading ? 0.7 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {settingsLoading ? (isTr ? 'Kaydediliyor…' : 'Saving…') : (isTr ? 'Kaydet' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export const StatusBar = React.memo(StatusBarInner);
