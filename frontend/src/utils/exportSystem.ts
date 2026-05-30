import { CatalogObject, SatelliteState, PassWindow, ConjunctionResult, CatalogSnapshotObject } from '../api/client';
import { useConsoleStore } from '../store/useConsoleStore';
// Helper to trigger file download
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 1. CSV Exports
export function exportEphemerisCSV(ephemeris: SatelliteState[], noradId: number) {
  if (!ephemeris || ephemeris.length === 0) return;
  
  const headers = ['timestamp_utc', 'latitude_deg', 'longitude_deg', 'altitude_km', 'ecef_x_km', 'ecef_y_km', 'ecef_z_km', 'reliability_status'];
  
  const rows = ephemeris.map(state => [
    state.timestamp_utc,
    state.latitude_deg.toFixed(6),
    state.longitude_deg.toFixed(6),
    state.altitude_km.toFixed(3),
    state.ecef.x_km.toFixed(3),
    state.ecef.y_km.toFixed(3),
    state.ecef.z_km.toFixed(3),
    state.reliability_status
  ].join(','));
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadFile(csvContent, `trsat_ephemeris_${noradId}.csv`, 'text/csv');
}

export function exportConjunctionsCSV(results: ConjunctionResult[]) {
  if (!results || results.length === 0) return;
  
  const headers = ['risk_level', 'severity', 'primary_norad_id', 'secondary_norad_id', 'secondary_object_type', 'tca_utc', 'miss_distance_km', 'relative_speed_km_s', 'collision_probability_est', 'max_collision_probability_est', 'hard_body_radius_m', 'screening_method'];

  const rows = results.map(r => {
    const relSpeed = r.relative_speed_km_per_s != null
      ? r.relative_speed_km_per_s.toFixed(3)
      : '';
    return [
      r.risk_level ?? '',
      r.severity,
      r.primary_norad_id,
      r.secondary_norad_id,
      r.secondary_object_type ?? '',
      r.tca_time,
      r.miss_distance_km.toFixed(3),
      relSpeed,
      r.collision_probability != null ? r.collision_probability.toExponential(4) : '',
      r.max_collision_probability != null ? r.max_collision_probability.toExponential(4) : '',
      r.hard_body_radius_m != null ? r.hard_body_radius_m.toFixed(2) : '',
      'SGP4 geometric + heuristic Pc'
    ].join(',');
  });
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadFile(csvContent, `trsat_conjunction_screening.csv`, 'text/csv');
}

export function exportDetailedPassesCSV(passes: import('../api/client').DetailedPassWindow[], noradId: number) {
  if (!passes || passes.length === 0) return;
  
  const headers = ['aos_time_utc', 'max_time_utc', 'los_time_utc', 'duration_seconds', 'max_elevation_deg', 'azimuth_aos_deg', 'azimuth_max_deg', 'azimuth_los_deg', 'range_at_max_km', 'quality_label'];
  
  const rows = passes.map(p => [
    p.aos_time_utc,
    p.max_time_utc,
    p.los_time_utc,
    p.duration_seconds.toFixed(1),
    p.max_elevation_deg.toFixed(2),
    p.azimuth_aos_deg?.toFixed(2) || '',
    p.azimuth_max_deg?.toFixed(2) || '',
    p.azimuth_los_deg?.toFixed(2) || '',
    p.range_at_max_km?.toFixed(2) || '',
    p.quality_label
  ].join(','));
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadFile(csvContent, `trsat_detailed_passes_${noradId}.csv`, 'text/csv');
}

export function exportCatalogCSV(catalog: CatalogSnapshotObject[]) {
  if (!catalog || catalog.length === 0) return;
  const headers = ['norad_id', 'name', 'object_type', 'category', 'latitude_deg', 'longitude_deg', 'altitude_km'];
  const rows = catalog.map(obj => [
    obj.norad_id,
    `"${obj.name}"`,
    obj.object_type,
    obj.category,
    obj.latitude_deg.toFixed(4),
    obj.longitude_deg.toFixed(4),
    obj.altitude_km.toFixed(2)
  ].join(','));
  const csvContent = [headers.join(','), ...rows].join('\n');
  downloadFile(csvContent, `trsat_catalog_snapshot.csv`, 'text/csv');
}

// 2. GeoJSON Exports
export function exportGroundTrackGeoJSON(ephemeris: SatelliteState[], noradId: number) {
  if (!ephemeris || ephemeris.length === 0) return;

  const coordinates = ephemeris.map(state => [
    state.longitude_deg,
    state.latitude_deg,
    state.altitude_km * 1000 // Convert to meters
  ]);

  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coordinates
        },
        properties: {
          norad_id: noradId,
          type: "GroundTrack"
        }
      }
    ]
  };

  downloadFile(JSON.stringify(geojson, null, 2), `trsat_ground_track_${noradId}.geojson`, 'application/geo+json');
}

export function exportCatalogGeoJSON(catalogMap: CatalogSnapshotObject[]) {
  if (!catalogMap || catalogMap.length === 0) return;

  const features = catalogMap.map(obj => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [
        obj.longitude_deg,
        obj.latitude_deg,
        obj.altitude_km * 1000 // meters
      ]
    },
    properties: {
      norad_id: obj.norad_id,
      name: obj.name,
      object_type: obj.object_type,
      category: obj.category
    }
  }));

  const geojson = {
    type: "FeatureCollection",
    features: features
  };

  downloadFile(JSON.stringify(geojson, null, 2), `trsat_catalog_snapshot.geojson`, 'application/geo+json');
}

// 3. CZML Export
export function exportTrajectoryCZML(ephemeris: SatelliteState[], object: CatalogObject) {
  if (!ephemeris || ephemeris.length === 0) return;

  const documentPacket = {
    id: "document",
    name: `TR-SAT CZML Export: ${object.name}`,
    version: "1.0",
    clock: {
      interval: `${ephemeris[0].timestamp_utc}/${ephemeris[ephemeris.length - 1].timestamp_utc}`,
      currentTime: ephemeris[0].timestamp_utc,
      multiplier: 1
    }
  };

  // Convert states to CZML cartographic format [time, lon(rad), lat(rad), alt(m), ...]
  const positions: any[] = [];
  ephemeris.forEach(state => {
    positions.push(state.timestamp_utc);
    positions.push(state.longitude_deg * (Math.PI / 180));
    positions.push(state.latitude_deg * (Math.PI / 180));
    positions.push(state.altitude_km * 1000);
  });

  const satellitePacket = {
    id: `Satellite/${object.norad_id}`,
    name: object.name,
    label: {
      text: object.name,
      show: true
    },
    position: {
      cartographicRadians: positions
    },
    path: {
      show: true,
      width: 2,
      material: {
        solidColor: {
          color: {
            rgba: [0, 255, 255, 255]
          }
        }
      }
    }
  };

  const czml = [documentPacket, satellitePacket];
  downloadFile(JSON.stringify(czml, null, 2), `trsat_trajectory_${object.norad_id}.czml`, 'application/json');
}

// 4. Mission Report
export function exportMissionReport(
  lang: 'tr' | 'en',
  object: CatalogObject,
  activeState: SatelliteState | null,
  passes: PassWindow[],
  conjunctions: ConjunctionResult[]
) {
  const timestamp = new Date().toISOString();
  
  let md = '';

  if (lang === 'tr') {
    md += `# TR-SAT Görev Analizi Raporu\n\n`;
    md += `**Dışa Aktarım Zamanı:** ${timestamp} UTC\n\n`;

    md += `## 1. Görev Özeti (Aktif Obje)\n`;
    md += `- **İsim:** ${object.name}\n`;
    md += `- **NORAD ID:** ${object.norad_id}\n`;
    md += `- **Tür:** ${object.object_type}\n`;
    md += `- **Kategori:** ${object.category}\n\n`;

    md += `## 2. Güncel Propagasyon Durumu\n`;
    if (activeState) {
      md += `- **Zaman:** ${activeState.timestamp_utc}\n`;
      md += `- **Enlem:** ${activeState.latitude_deg.toFixed(4)}°\n`;
      md += `- **Boylam:** ${activeState.longitude_deg.toFixed(4)}°\n`;
      md += `- **İrtifa:** ${activeState.altitude_km.toFixed(2)} km\n`;
      if (activeState.tle_epoch_utc) {
        md += `- **TLE Epok:** ${activeState.tle_epoch_utc}\n`;
      }
      if (activeState.tle_age_days !== undefined) {
        md += `- **TLE Yaşı:** ${activeState.tle_age_days.toFixed(2)} gün\n`;
      }
      md += `- **Güvenilirlik:** ${activeState.reliability_status}\n\n`;
      
      const storeState = useConsoleStore.getState();
      if (storeState.illuminationState) {
        md += `- **Aydınlatma (Gölge) Durumu:** ${storeState.illuminationState}\n`;
      }
      if (storeState.decayIndicators) {
        md += `- **Heuristic MM Trend:** ${storeState.decayIndicators.mean_motion_trend?.toFixed(6) || 'N/A'}\n`;
        md += `- **Heuristic Alt Trend:** ${storeState.decayIndicators.altitude_trend_km?.toFixed(3) || 'N/A'} km\n`;
      }
      md += `\n*Not: TLE/GP tabanlı propagasyon doğruluğu yörünge elemanlarının yaşlanmasıyla azalır. Illumination state is an approximate geometric sunlight/shadow estimate..*\n\n`;
    } else {
      md += `*Propagasyon durumu mevcut değil.*\n\n`;
    }

    md += `## 3. Geçiş Tahmini Özeti\n`;
    if (passes && passes.length > 0) {
      md += `Tespit edilen geçiş sayısı: **${passes.length}**\n\n`;
      passes.forEach((p, i) => {
        md += `${i+1}. **${p.aos_time_utc}** -> Max Elevation: ${p.max_elevation_deg.toFixed(1)}°\n`;
      });
      md += `\n`;
    } else {
      md += `*Görünür geçiş tespit edilmedi.*\n\n`;
    }

    md += `## 4. Yakın Geçiş Tarama Özeti\n`;
    if (conjunctions && conjunctions.length > 0) {
      md += `Tespit edilen riskli yakın geçiş sayısı: **${conjunctions.length}**\n\n`;
      conjunctions.forEach((c, i) => {
        md += `${i+1}. Hedef: **NORAD ${c.secondary_norad_id}** | Mesafe: **${c.miss_distance_km.toFixed(2)} km** | TCA: ${c.tca_time} | Şiddet: ${c.severity}\n`;
      });
      md += `\n`;
    } else {
      md += `*Riskli yakın geçiş tespit edilmedi.*\n\n`;
    }

    md += `## 5. Bilimsel Sınırlamalar ve Uyarılar\n`;
    md += `> **DİKKAT:** Bu veriler matematiksel tahminlere dayanmaktadır.\n`;
    md += `- Doğrudan uydu telemetrisi değildir.\n`;
    md += `- Conjunction Screening çarpışma olasılığı hesaplamaz (Sadece minimum yaklaşma mesafesine bakar).\n`;
    md += `- Kamuya açık TLE/GP verisi covariance (hata elipsoidi) içermez. Kesinlik kısıtlıdır.\n`;

  } else {
    // English
    md += `# TR-SAT Mission Analysis Report\n\n`;
    md += `**Export Timestamp:** ${timestamp} UTC\n\n`;

    md += `## 1. Mission Summary (Active Object)\n`;
    md += `- **Name:** ${object.name}\n`;
    md += `- **NORAD ID:** ${object.norad_id}\n`;
    md += `- **Type:** ${object.object_type}\n`;
    md += `- **Category:** ${object.category}\n\n`;

    md += `## 2. Current Propagation State\n`;
    if (activeState) {
      md += `- **Time:** ${activeState.timestamp_utc}\n`;
      md += `- **Latitude:** ${activeState.latitude_deg.toFixed(4)}°\n`;
      md += `- **Longitude:** ${activeState.longitude_deg.toFixed(4)}°\n`;
      md += `- **Altitude:** ${activeState.altitude_km.toFixed(2)} km\n`;
      if (activeState.tle_epoch_utc) {
        md += `- **TLE Epoch:** ${activeState.tle_epoch_utc}\n`;
      }
      if (activeState.tle_age_days !== undefined) {
        md += `- **TLE Age:** ${activeState.tle_age_days.toFixed(2)} days\n`;
      }
      md += `- **Reliability:** ${activeState.reliability_status}\n\n`;
    } else {
      md += `*Propagation state not available.*\n\n`;
    }

    md += `## 3. Pass Prediction Summary\n`;
    if (passes && passes.length > 0) {
      md += `Detected passes: **${passes.length}**\n\n`;
      passes.forEach((p, i) => {
        md += `${i+1}. **${p.aos_time_utc}** -> Max Elevation: ${p.max_elevation_deg.toFixed(1)}°\n`;
      });
      md += `\n`;
    } else {
      md += `*No visible passes detected.*\n\n`;
    }

    md += `## 4. Conjunction Screening Summary\n`;
    if (conjunctions && conjunctions.length > 0) {
      md += `Detected conjunctions: **${conjunctions.length}**\n\n`;
      conjunctions.forEach((c, i) => {
        md += `${i+1}. Target: **NORAD ${c.secondary_norad_id}** | Miss Distance: **${c.miss_distance_km.toFixed(2)} km** | TCA: ${c.tca_time} | Severity: ${c.severity}\n`;
      });
      md += `\n`;
    } else {
      md += `*No risky conjunctions detected.*\n\n`;
    }

    md += `## 5. Scientific Limitations & Disclaimers\n`;
    md += `> **WARNING:** These metrics are based on mathematical propagations.\n`;
    md += `- Not direct satellite telemetry.\n`;
    md += `- Conjunction Screening does not compute probability of collision (Pc).\n`;
    md += `- Public TLE/GP data does not contain covariance. Precision is limited.\n`;
  }

  const filename = lang === 'tr' ? `trsat_mission_report_tr.md` : `trsat_mission_report_en.md`;
  downloadFile(md, filename, 'text/markdown');
}
