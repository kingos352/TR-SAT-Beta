import React, { useState, useCallback, useEffect } from 'react';
import { useConsoleStore } from '../../store/useConsoleStore';
import { Cloud, Wind, Droplets, Eye, RefreshCw, Sun, Moon, CloudRain, MapPin } from 'lucide-react';

// ── WMO weather code → label ────────────────────────────────────
function wmoLabel(code: number, tr: boolean): string {
  const en = [
    [0, 'Clear sky'],
    [1, 'Mainly clear'], [2, 'Partly cloudy'], [3, 'Overcast'],
    [45, 'Fog'], [48, 'Fog'],
    [51, 'Drizzle'], [53, 'Drizzle'], [55, 'Drizzle'],
    [56, 'Freezing drizzle'], [57, 'Freezing drizzle'],
    [61, 'Rain'], [63, 'Rain'], [65, 'Heavy rain'],
    [66, 'Freezing rain'], [67, 'Freezing rain'],
    [71, 'Snow'], [73, 'Snow'], [75, 'Heavy snow'], [77, 'Snow grains'],
    [80, 'Rain showers'], [81, 'Rain showers'], [82, 'Heavy showers'],
    [85, 'Snow showers'], [86, 'Snow showers'],
    [95, 'Thunderstorm'], [96, 'Thunderstorm'], [99, 'Thunderstorm'],
  ] as [number, string][];
  const tr2 = [
    [0, 'Açık'],
    [1, 'Çoğunlukla açık'], [2, 'Parçalı bulutlu'], [3, 'Kapalı'],
    [45, 'Sis'], [48, 'Sis'],
    [51, 'Çisenti'], [53, 'Çisenti'], [55, 'Çisenti'],
    [56, 'Dondurucu çisenti'], [57, 'Dondurucu çisenti'],
    [61, 'Yağmur'], [63, 'Yağmur'], [65, 'Şiddetli yağmur'],
    [66, 'Dondurucu yağmur'], [67, 'Dondurucu yağmur'],
    [71, 'Kar'], [73, 'Kar'], [75, 'Yoğun kar'], [77, 'Kar tanesi'],
    [80, 'Sağanak'], [81, 'Sağanak'], [82, 'Şiddetli sağanak'],
    [85, 'Kar sağanağı'], [86, 'Kar sağanağı'],
    [95, 'Fırtına'], [96, 'Fırtına'], [99, 'Fırtına'],
  ] as [number, string][];
  const list = tr ? tr2 : en;
  const match = list.find(([c]) => c === code);
  return match ? match[1] : (tr ? 'Bilinmiyor' : 'Unknown');
}

// ── Moon phase ──────────────────────────────────────────────────
function moonPhase(tr: boolean): { label: string; emoji: string; illumination: number } {
  const knownNew = new Date('2024-01-11T11:57:00Z').getTime();
  const cycle = 29.530588853 * 24 * 3600 * 1000;
  const phase = ((Date.now() - knownNew) % cycle + cycle) % cycle / cycle;
  const illum = Math.round((1 - Math.abs(2 * phase - 1)) * 100);
  const phases: [number, string, string, string][] = [
    [0.0625,  'New Moon',       'Yeni Ay',       '🌑'],
    [0.1875,  'Waxing Crescent','Hilal',          '🌒'],
    [0.3125,  'First Quarter',  'İlk Dördün',     '🌓'],
    [0.4375,  'Waxing Gibbous', 'Büyüyen Ay',     '🌔'],
    [0.5625,  'Full Moon',      'Dolunay',        '🌕'],
    [0.6875,  'Waning Gibbous', 'Küçülen Ay',     '🌖'],
    [0.8125,  'Last Quarter',   'Son Dördün',     '🌗'],
    [1,       'Waning Crescent','Küçülen Hilal',  '🌘'],
  ];
  const [, en, trLabel, emoji] = phases.find(([limit]) => phase < limit) ?? phases[phases.length - 1];
  return { label: tr ? trLabel : en, emoji, illumination: illum };
}

// ── Score helpers ───────────────────────────────────────────────
function calcScore(w: WeatherCurrent): number {
  let score = 100;
  score -= w.cloud_cover * 0.65;
  const visKm = w.visibility / 1000;
  if (visKm < 1) score -= 25; else if (visKm < 5) score -= 15; else if (visKm < 10) score -= 8; else if (visKm < 20) score -= 3;
  if (w.relative_humidity_2m > 90) score -= 12; else if (w.relative_humidity_2m > 80) score -= 6; else if (w.relative_humidity_2m > 70) score -= 2;
  if (w.wind_speed_10m > 50) score -= 10; else if (w.wind_speed_10m > 30) score -= 5; else if (w.wind_speed_10m > 20) score -= 2;
  if (w.precipitation > 0) score -= 25;
  const moon = moonPhase(false);
  if (moon.illumination > 90) score -= 10; else if (moon.illumination > 70) score -= 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreColor(s: number) {
  if (s >= 75) return 'var(--accent-success)';
  if (s >= 50) return 'var(--accent-blue)';
  if (s >= 25) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
}

function scoreLabel(s: number, tr: boolean) {
  if (s >= 75) return tr ? 'Mükemmel' : 'Excellent';
  if (s >= 50) return tr ? 'İyi' : 'Good';
  if (s >= 25) return tr ? 'Orta' : 'Fair';
  return tr ? 'Zayıf' : 'Poor';
}

// ── Types ───────────────────────────────────────────────────────
interface WeatherCurrent {
  cloud_cover: number;
  visibility: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  precipitation: number;
  weather_code: number;
  is_day: number;
  temperature_2m: number;
}
interface WeatherData { current: WeatherCurrent; fetchedAt: Date; }

// ── Stat row ────────────────────────────────────────────────────
const Stat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}> = ({ icon, label, value, sub, accent }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 10px',
    background: 'var(--bg-panel-soft)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
  }}>
    <span style={{ color: accent ?? 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>{icon}</span>
    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>{label}</span>
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
      <span className="value-mono" style={{ fontSize: '12px', fontWeight: 600, color: accent ?? 'var(--text-primary)' }}>{value}</span>
      {sub && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{sub}</span>}
    </span>
  </div>
);

// ── Main component ──────────────────────────────────────────────
export const WeatherPanel: React.FC = () => {
  const observer = useConsoleStore(s => s.observer);
  const setObservationScore = useConsoleStore(s => s.setObservationScore);
  const language = useConsoleStore(s => s.language);
  const isTr = language === 'tr';

  const [data, setData] = useState<WeatherData | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!observer.latitude_deg && !observer.longitude_deg) {
      setError(isTr ? 'Önce bir yer istasyonu konumu belirleyin.' : 'Set a ground station location first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const weatherParams = new URLSearchParams({
        latitude: String(observer.latitude_deg),
        longitude: String(observer.longitude_deg),
        current: 'cloud_cover,visibility,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,is_day,temperature_2m',
        wind_speed_unit: 'kmh',
        timezone: 'auto',
        forecast_days: '1',
      });
      const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${observer.latitude_deg}&lon=${observer.longitude_deg}&format=json&accept-language=${isTr ? 'tr' : 'en'}`;

      const [weatherRes, geoRes] = await Promise.all([
        window.fetch(`https://api.open-meteo.com/v1/forecast?${weatherParams}`),
        window.fetch(geoUrl),
      ]);

      if (!weatherRes.ok) throw new Error(`HTTP ${weatherRes.status}`);
      const json = await weatherRes.json();
      setData({ current: json.current, fetchedAt: new Date() });
      setObservationScore(calcScore(json.current));

      if (geoRes.ok) {
        const geo = await geoRes.json();
        const a = geo.address ?? {};
        const city = a.city ?? a.town ?? a.village ?? a.county ?? a.state ?? null;
        const country = a.country_code ? a.country_code.toUpperCase() : null;
        setCityName(city && country ? `${city}, ${country}` : city ?? country ?? null);
      }
    } catch (e: any) {
      setError(e.message ?? (isTr ? 'Hava durumu verisi alınamadı.' : 'Failed to fetch weather data.'));
    } finally {
      setLoading(false);
    }
  }, [observer.latitude_deg, observer.longitude_deg, isTr, setObservationScore]);

  useEffect(() => { fetch(); }, [fetch]);

  const moon = moonPhase(isTr);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
        <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
        {isTr ? 'Hava durumu alınıyor…' : 'Fetching weather data…'}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '11px', color: 'var(--accent-danger)', padding: '8px 10px', background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)', borderRadius: 'var(--radius-sm)' }}>
          {error}
        </div>
        <button onClick={fetch} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
          <RefreshCw size={11} /> {isTr ? 'Tekrar Dene' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const w = data.current;
  const score = calcScore(w);
  const color = scoreColor(score);
  const visKm = (w.visibility / 1000).toFixed(1);

  const cloudSub = w.cloud_cover > 70
    ? (isTr ? 'Yoğun bulut örtüsü' : 'Heavy obstruction')
    : w.cloud_cover > 40
    ? (isTr ? 'Kısmen kapalı' : 'Partial obstruction')
    : (isTr ? 'Açık' : 'Clear');

  const visSub = parseFloat(visKm) < 5
    ? (isTr ? 'Çok düşük' : 'Very poor')
    : parseFloat(visKm) < 15
    ? (isTr ? 'Azalmış' : 'Reduced')
    : (isTr ? 'İyi' : 'Good');

  const r = 28, cx = 36, cy = 36, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>

      {/* Score ring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: 'var(--bg-panel-soft)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
        <svg width="72" height="72" style={{ flexShrink: 0 }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle
            cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
            style={{ transition: 'stroke-dasharray 0.6s ease', filter: `drop-shadow(0 0 4px ${color}88)` }}
          />
          <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="14" fontWeight="700" fontFamily="'JetBrains Mono',monospace">{score}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontFamily="'Inter',sans-serif">/ 100</text>
        </svg>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color, marginBottom: '3px' }}>{scoreLabel(score, isTr)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: cityName ? '2px' : '6px' }}>{wmoLabel(w.weather_code, isTr)}</div>
          {cityName && (
            <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={10} color="var(--accent-blue)" />
              {cityName}
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span className="badge" style={w.is_day
              ? { color: '#F59E0B', borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)' }
              : { color: 'var(--accent-blue)', borderColor: 'var(--border-accent)', background: 'rgba(37,183,255,0.08)' }}>
              {w.is_day ? <Sun size={9} /> : <Moon size={9} />}
              {w.is_day ? (isTr ? 'Gündüz' : 'Day') : (isTr ? 'Gece' : 'Night')}
            </span>
            <span className="badge" style={{ color: 'var(--text-muted)' }}>
              {moon.emoji} {moon.label}
            </span>
          </div>
        </div>
      </div>

      {/* Parameters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <Stat
          icon={<Cloud size={13} />}
          label={isTr ? 'Bulut örtüsü' : 'Cloud cover'}
          value={`${w.cloud_cover}%`}
          accent={w.cloud_cover > 70 ? 'var(--accent-danger)' : w.cloud_cover > 40 ? 'var(--accent-warning)' : 'var(--accent-success)'}
          sub={cloudSub}
        />
        <Stat
          icon={<Eye size={13} />}
          label={isTr ? 'Görüş mesafesi' : 'Visibility'}
          value={`${visKm} km`}
          accent={parseFloat(visKm) < 5 ? 'var(--accent-danger)' : parseFloat(visKm) < 15 ? 'var(--accent-warning)' : 'var(--accent-success)'}
          sub={visSub}
        />
        <Stat
          icon={<Droplets size={13} />}
          label={isTr ? 'Nem' : 'Humidity'}
          value={`${w.relative_humidity_2m}%`}
          accent={w.relative_humidity_2m > 85 ? 'var(--accent-warning)' : undefined}
          sub={w.relative_humidity_2m > 85 ? (isTr ? 'Yüksek — optik bulanıklık riski' : 'High — optical blur risk') : undefined}
        />
        <Stat
          icon={<Wind size={13} />}
          label={isTr ? 'Rüzgar hızı' : 'Wind speed'}
          value={`${w.wind_speed_10m} km/s`}
          accent={w.wind_speed_10m > 30 ? 'var(--accent-warning)' : undefined}
          sub={w.wind_speed_10m > 30 ? (isTr ? 'İstikrarı etkileyebilir' : 'May affect stability') : undefined}
        />
        {w.precipitation > 0 && (
          <Stat
            icon={<CloudRain size={13} />}
            label={isTr ? 'Yağış' : 'Precipitation'}
            value={`${w.precipitation} mm`}
            accent="var(--accent-danger)"
            sub={isTr ? 'Gözlem önerilmez' : 'Observation not recommended'}
          />
        )}
        <Stat
          icon={<span style={{ fontSize: '11px' }}>🌡</span>}
          label={isTr ? 'Sıcaklık' : 'Temperature'}
          value={`${w.temperature_2m}°C`}
        />
        <Stat
          icon={<span style={{ fontSize: '11px' }}>{moon.emoji}</span>}
          label={isTr ? 'Ay aydınlığı' : 'Moon illumination'}
          value={`${moon.illumination}%`}
          accent={moon.illumination > 70 ? 'var(--accent-warning)' : 'var(--accent-success)'}
          sub={moon.illumination > 70 ? (isTr ? 'Parlak — gökyüzü parlaklığı' : 'Bright — sky glow') : (isTr ? 'Elverişli' : 'Favorable')}
        />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {observer.name} · {observer.latitude_deg.toFixed(2)}°, {observer.longitude_deg.toFixed(2)}°
        </span>
        <button
          onClick={fetch}
          title={isTr ? 'Yenile' : 'Refresh'}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }}
        >
          <RefreshCw size={10} />
          {data.fetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </button>
      </div>
    </div>
  );
};
