// Resolve the backend base URL.
// In dev mode (Vite), /api and /ws are proxied to http://127.0.0.1:8000,
// so an empty string (same-origin) always works.
// In production FastAPI-served mode, the origin IS the backend.
// Explicit VITE_API_BASE_URL overrides everything.
function resolveApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_BASE_URL;
  if (explicit) return explicit;
  // Empty string = same-origin; Vite proxy forwards /api → :8000 in dev,
  // FastAPI serves both frontend and API in production.
  return '';
}

export const API_BASE_URL = resolveApiBaseUrl();

// --- TYPES ---

export interface HealthResponse {
  status: string;
  app: string;
  environment: string;
  database: string;
}

export interface TLERead {
  id: number;
  norad_id: number;
  name: string;
  line1: string;
  line2: string;
  epoch: string;
  inclination_deg?: number;
  raan_deg?: number;
  eccentricity?: number;
  arg_perigee_deg?: number;
  mean_anomaly_deg?: number;
  mean_motion_rev_per_day?: number;
  bstar?: number;
  source: string;
  source_group: string;
  source_format?: string; // TLE, OMM_JSON, OMM_CSV, OEM, CDM
  ingested_at: string;
}

export interface CatalogObject {
  norad_id: number;
  name: string;
  object_type: string; // PAYLOAD, ROCKET_BODY, DEBRIS, UNKNOWN
  category: string;
  source: string;
  source_group: string;
  cospar_id?: string;
  last_updated: string;
  latest_tle?: TLERead;
}

export interface CatalogSyncResponse {
  group: string;
  fetched_count: number;
  parsed_count: number;
  inserted_objects: number;
  inserted_tles: number;
  updated_objects: number;
  skipped_count: number;
  warning?: string;
}

export interface SpaceTrackStatusResponse {
  is_configured: boolean;
  message: string;
}

export interface SpaceTrackAuthTestResponse {
  success: boolean;
  message: string;
}

export interface ECEFPosition {
  x_km: number;
  y_km: number;
  z_km: number;
}

export interface SatelliteState {
  name: string;
  timestamp_utc: string;
  latitude_deg: number;
  longitude_deg: number;
  altitude_km: number;
  ecef: ECEFPosition;
  tle_epoch_utc?: string;
  tle_age_days?: number;
  reliability_status: string; // FRESH, AGING, STALE, UNKNOWN
}

export interface ObserverAER {
  timestamp_utc: string;
  azimuth_deg: number;
  elevation_deg: number;
  range_km: number;
}

export interface PassWindow {
  aos_time_utc: string;
  max_time_utc: string;
  los_time_utc: string;
  max_elevation_deg: number;
  azimuth_aos_deg?: number;
  azimuth_max_deg?: number;
  azimuth_los_deg?: number;
  range_at_max_km?: number;
}

export interface DetailedPassProfilePoint {
  timestamp_utc: string;
  elevation_deg: number;
  azimuth_deg: number;
  range_km: number;
}

export interface DetailedPassWindow {
  aos_time_utc: string;
  max_time_utc: string;
  los_time_utc: string;
  duration_seconds: number;
  max_elevation_deg: number;
  azimuth_aos_deg?: number;
  azimuth_max_deg?: number;
  azimuth_los_deg?: number;
  range_at_max_km?: number;
  quality_label: string; // LOW, GOOD, EXCELLENT, OVERHEAD
  elevation_profile: DetailedPassProfilePoint[];
}

export interface ConjunctionScreenRequest {
  mode: "selected_vs_selected" | "primary_vs_catalog" | "primary_vs_debris";
  primary_norad_ids: number[];
  secondary_norad_ids?: number[];
  start_time: string;
  end_time: string;
  coarse_step_seconds: number;
  refine_step_seconds: number;
  max_candidates: number;
  include_rocket_bodies?: boolean;
  hard_body_radius_m?: number;
  sigma_intrack_km?: number;
}

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "NEGLIGIBLE";

export interface ConjunctionResult {
  primary_norad_id: number;
  secondary_norad_id: number;
  tca_time: string;
  miss_distance_km: number;
  severity: "CRITICAL_CANDIDATE" | "CLOSE" | "WATCH" | "INFO";
  primary_position_km: number[];
  secondary_position_km: number[];
  primary_velocity_km_per_s?: number[];
  secondary_velocity_km_per_s?: number[];
  // Estimated collision assessment (heuristic — see response disclaimer)
  relative_speed_km_per_s?: number;
  collision_probability?: number;
  max_collision_probability?: number;
  hard_body_radius_m?: number;
  risk_level?: RiskLevel;
  miss_x_km?: number;
  miss_y_km?: number;
  covariance_2d_km2?: number[][];
  primary_object_type?: string;
  secondary_object_type?: string;
  primary_tle_age_days?: number;
  secondary_tle_age_days?: number;
}

export interface ConjunctionScreenResponse {
  disclaimer: string;
  mode: string;
  results: ConjunctionResult[];
  computation_time_ms: number;
}

// --- ADVANCED RESEARCH ---
export interface HistoricalTLEPoint {
  epoch: string;
  inclination: number;
  raan: number;
  eccentricity: number;
  arg_perigee: number;
  mean_anomaly: number;
  mean_motion: number;
  bstar: number;
}

export interface OrbitalDecayIndicators {
  mean_motion_trend: number | null;
  bstar_trend: number | null;
  altitude_trend_km: number | null;
  note: string;
}

export interface IlluminationStateResponse {
  illumination_state: 'SUNLIT' | 'EARTH_SHADOW' | 'UNKNOWN';
}

export interface RelativeMotionPoint {
  timestamp_utc: string;
  distance_km: number;
}

export interface RelativeMotionResult {
  primary_id: number;
  secondary_id: number;
  tca_utc: string;
  relative_speed_kmps: number;
  distance_curve: RelativeMotionPoint[];
}

// --- VISIBILITY ---

export interface VisibilityScreenRequest {
  timestamp_utc?: string;
  observer_latitude_deg: number;
  observer_longitude_deg: number;
  observer_elevation_m: number;
  min_elevation_deg: number;
  high_elevation_deg?: number;
  object_type?: string;
  category?: string;
  source?: string;
  source_group?: string;
  include_debris?: boolean;
  limit: number;
  max_candidates?: number;
}

export interface VisibilityResultItem {
  norad_id: string;
  name: string;
  object_type: string;
  category: string;
  source: string;
  source_group: string;
  elevation_deg: number;
  azimuth_deg: number;
  range_km: number;
  visibility_class: string;
  reliability_status: string;
  tle_age_days: number;
}

export interface VisibilityScreenResponse {
  timestamp_utc: string;
  observer: {
    latitude_deg: number;
    longitude_deg: number;
    elevation_m: number;
  };
  returned_count: number;
  evaluated_count: number;
  skipped_count: number;
  objects: VisibilityResultItem[];
  warnings: string[];
  disclaimer: string;
}

// --- CATALOG VISUALIZATION ---

export interface CatalogSnapshotRequest {
  timestamp_utc?: string;
  object_type?: string;
  category?: string;
  source?: string;
  source_group?: string;
  search?: string;
  limit: number;
}

export interface CatalogSnapshotObject {
  norad_id: number;
  name: string;
  object_type: string;
  category: string;
  latitude_deg: number;
  longitude_deg: number;
  altitude_km: number;
  x_km: number;
  y_km: number;
  z_km: number;
}

export interface CatalogSnapshotResponse {
  timestamp_utc: string;
  returned_count: number;
  total_matching_count: number;
  skipped_count: number;
  objects: CatalogSnapshotObject[];
}

// --- CLIENT FUNCTIONS ---

/**
 * Handle API calls and return structured json or throw friendly messages.
 */
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errText = await response.text();
      let msg = `HTTP error ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.detail) {
          msg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {
        if (errText) msg = errText;
      }
      throw new Error(msg);
    }
    return await response.json();
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('failed to fetch')) {
      throw new Error('Connection refused. Ensure the backend FastAPI server is running at ' + API_BASE_URL);
    }
    throw error;
  }
}

export async function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>(`${API_BASE_URL}/api/v1/health`);
}

export async function syncCatalogGroup(
  group: string,
  dataFormat: 'tle' | 'omm' = 'tle'
): Promise<CatalogSyncResponse> {
  return apiRequest<CatalogSyncResponse>(`${API_BASE_URL}/api/v1/catalog/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group, data_format: dataFormat }),
  });
}

export async function searchCatalog(params: {
  q?: string;
  group?: string;
  object_type?: string;
  category?: string;
  limit?: number;
}): Promise<CatalogObject[]> {
  const url = new URL(`${API_BASE_URL}/api/v1/catalog/search`);
  if (params.q) url.searchParams.append('q', params.q);
  if (params.group) url.searchParams.append('group', params.group);
  if (params.object_type && params.object_type !== 'ALL') {
    url.searchParams.append('object_type', params.object_type);
  }
  if (params.category && params.category !== 'ALL') {
    url.searchParams.append('category', params.category);
  }
  if (params.limit) url.searchParams.append('limit', params.limit.toString());

  return apiRequest<CatalogObject[]>(url.toString());
}

export async function getCatalogObject(noradId: number): Promise<CatalogObject> {
  return apiRequest<CatalogObject>(`${API_BASE_URL}/api/v1/catalog/${noradId}`);
}

export async function getCatalogState(payload: {
  norad_id: number;
  timestamp_utc: string;
}): Promise<SatelliteState> {
  return apiRequest<SatelliteState>(`${API_BASE_URL}/api/v1/propagation/catalog/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getCatalogEphemeris(payload: {
  norad_id: number;
  start_time_utc: string;
  end_time_utc: string;
  step_seconds: number;
}): Promise<SatelliteState[]> {
  return apiRequest<SatelliteState[]>(`${API_BASE_URL}/api/v1/propagation/catalog/ephemeris`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getCatalogAER(payload: {
  norad_id: number;
  timestamp_utc: string;
  observer_latitude_deg: number;
  observer_longitude_deg: number;
  observer_elevation_m: number;
}): Promise<ObserverAER> {
  return apiRequest<ObserverAER>(`${API_BASE_URL}/api/v1/observer/catalog/aer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getCatalogPasses(payload: {
  norad_id: number;
  observer_latitude_deg: number;
  observer_longitude_deg: number;
  observer_elevation_m: number;
  start_time_utc: string;
  end_time_utc: string;
  min_elevation_deg: number;
}): Promise<PassWindow[]> {
  const resp = await fetch(`${API_BASE_URL}/api/v1/observer/catalog/passes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error('Failed to compute passes');
  return resp.json();
}

export const getDetailedPasses = async (
  norad_id: number,
  observer_lat: number,
  observer_lon: number,
  observer_elev: number,
  start_time: string,
  end_time: string,
  min_elevation: number = 10.0,
  step_seconds: number = 30
): Promise<DetailedPassWindow[]> => {
  const resp = await fetch(`${API_BASE_URL}/api/v1/observer/catalog/passes/detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      norad_id,
      observer_latitude_deg: observer_lat,
      observer_longitude_deg: observer_lon,
      observer_elevation_m: observer_elev,
      start_time_utc: start_time,
      end_time_utc: end_time,
      min_elevation_deg: min_elevation,
      profile_step_seconds: step_seconds
    })
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => null);
    throw new Error(data?.detail || 'Failed to compute detailed passes');
  }
  return resp.json();
};

// --- SPACE-TRACK ---

export async function getSpaceTrackStatus(): Promise<SpaceTrackStatusResponse> {
  return apiRequest<SpaceTrackStatusResponse>(`${API_BASE_URL}/api/v1/spacetrack/status`);
}

export async function testSpaceTrackAuth(): Promise<SpaceTrackAuthTestResponse> {
  return apiRequest<SpaceTrackAuthTestResponse>(`${API_BASE_URL}/api/v1/spacetrack/test-auth`, {
    method: 'POST',
  });
}

export async function syncSpaceTrackNorad(noradId: number): Promise<CatalogSyncResponse> {
  return apiRequest<CatalogSyncResponse>(`${API_BASE_URL}/api/v1/spacetrack/sync/norad/${noradId}`, {
    method: 'POST',
  });
}

export interface SpaceTrackBulkSyncResponse {
  status: string;
  object_type: string;
  fetched_count: number;
  inserted_objects: number;
  updated_objects: number;
  inserted_tles: number;
  skipped_count: number;
  message: string;
}

export async function syncSpaceTrackObjectType(objectType: string): Promise<SpaceTrackBulkSyncResponse> {
  return apiRequest<SpaceTrackBulkSyncResponse>(`${API_BASE_URL}/api/v1/spacetrack/sync/object-type/${objectType}`, {
    method: 'POST',
  });
}

// --- CONJUNCTION ---

export async function screenConjunction(payload: ConjunctionScreenRequest): Promise<ConjunctionScreenResponse> {
  return apiRequest<ConjunctionScreenResponse>(`${API_BASE_URL}/api/v1/conjunction/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface DebrisWatchRequest {
  start_time: string;
  end_time: string;
  coarse_step_seconds: number;
  refine_step_seconds: number;
  include_rocket_bodies?: boolean;
  max_objects?: number;
  max_candidates?: number;
}

// Catalog-wide debris-vs-debris screening; needs no selected object.
export async function screenDebrisWatch(payload: DebrisWatchRequest): Promise<ConjunctionScreenResponse> {
  return apiRequest<ConjunctionScreenResponse>(`${API_BASE_URL}/api/v1/conjunction/debris-watch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getCatalogSnapshot(payload: CatalogSnapshotRequest): Promise<CatalogSnapshotResponse> {
  return apiRequest<CatalogSnapshotResponse>(`${API_BASE_URL}/api/v1/catalog-visualization/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// --- VISIBILITY ---

export async function screenVisibility(payload: VisibilityScreenRequest): Promise<VisibilityScreenResponse> {
  return apiRequest<VisibilityScreenResponse>(`${API_BASE_URL}/api/v1/visibility/current`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// --- ASSISTANT ---

export interface AssistantChatRequest {
  message: string;
  context?: any;
  language?: string;
}

export interface AssistantChatResponse {
  answer: string;
  provider: string;
  model: string;
  mode: string;
  warnings: string[];
}

export async function sendAssistantMessage(payload: AssistantChatRequest): Promise<AssistantChatResponse> {
  return apiRequest<AssistantChatResponse>(`${API_BASE_URL}/api/v1/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// --- ANALYTICS ---

export interface DistributionBin {
  label: string;
  count: number;
}

export interface FreshnessSummary {
  total_evaluated: number;
  fresh_count: number;
  stale_count: number;
  average_age_days?: number | null;
  max_age_days?: number | null;
}

export interface CatalogAnalyticsSummary {
  total_objects: number;
  by_object_type: Record<string, number>;
  by_source: Record<string, number>;
  by_category: Record<string, number>;
  by_orbital_regime: Record<string, number>;
  altitude_bins: DistributionBin[];
  inclination_bins: DistributionBin[];
  freshness_summary: FreshnessSummary;
  stale_percentage: number;
  debris_percentage: number;
  warnings: string[];
  disclaimer: string;
}

export interface ReliabilitySummary {
  overall_freshness_score: number;
  total_objects: number;
  fresh_count: number;
  aging_count: number;
  stale_count: number;
  unknown_count: number;
  average_age_days: number;
  median_age_days: number;
  age_histogram: { label: string; count: number; }[];
}

export interface ObjectReliabilityDetail {
  norad_id: number;
  tle_epoch_utc: string;
  tle_age_days: number;
  reliability_label: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';
  warnings: string[];
}

export async function getCatalogAnalyticsSummary(filters?: {
  source?: string;
  source_group?: string;
  category?: string;
  object_type?: string;
}): Promise<CatalogAnalyticsSummary> {
  let url = `${API_BASE_URL}/api/v1/analytics/catalog-summary`;
  if (filters) {
    const params = new URLSearchParams();
    if (filters.source) params.append('source', filters.source);
    if (filters.source_group) params.append('source_group', filters.source_group);
    if (filters.category) params.append('category', filters.category);
    if (filters.object_type) params.append('object_type', filters.object_type);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

export async function getReliabilitySummary(): Promise<ReliabilitySummary> {
  return apiRequest<ReliabilitySummary>(`${API_BASE_URL}/api/v1/research/reliability-summary`);
}

export async function getObjectReliability(noradId: number): Promise<ObjectReliabilityDetail> {
  return apiRequest<ObjectReliabilityDetail>(`${API_BASE_URL}/api/v1/research/object-reliability/${noradId}`);
}

// --- RESEARCH ---
export interface TLEHistoryResponse {
  norad_id: number;
  history: TLERead[];
}

export interface IlluminationRequest {
  norad_id: number;
  timestamp_utc: string;
}

export interface IlluminationResponse {
  norad_id: number;
  timestamp_utc: string;
  illumination_state: "SUNLIT" | "EARTH_SHADOW" | "UNKNOWN";
}

export interface RelativeMotionRequest {
  primary_norad_id: number;
  secondary_norad_id: number;
  start_time_utc: string;
  end_time_utc: string;
  step_seconds: number;
}

export interface RelativeMotionPoint {
  timestamp_utc: string;
  distance_km: number;
  relative_speed_km_per_s: number;
}

export interface RelativeMotionResponse {
  primary_norad_id: number;
  secondary_norad_id: number;
  motion_profile: RelativeMotionPoint[];
}

export async function getTLEHistory(noradId: number): Promise<TLEHistoryResponse> {
  return apiRequest<TLEHistoryResponse>(`${API_BASE_URL}/api/v1/research/tle-history/${noradId}`);
}

export async function getIllumination(payload: IlluminationRequest): Promise<IlluminationResponse> {
  return apiRequest<IlluminationResponse>(`${API_BASE_URL}/api/v1/research/illumination`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getRelativeMotion(payload: RelativeMotionRequest): Promise<RelativeMotionResponse> {
  return apiRequest<RelativeMotionResponse>(`${API_BASE_URL}/api/v1/research/relative-motion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// --- NEW ADVANCED RESEARCH FUNCS ---
export async function getHistoricalTLEs(noradId: number): Promise<HistoricalTLEPoint[]> {
  return apiRequest<HistoricalTLEPoint[]>(`${API_BASE_URL}/api/v1/advanced-research/historical/${noradId}`);
}

export async function getDecayIndicators(noradId: number): Promise<OrbitalDecayIndicators> {
  return apiRequest<OrbitalDecayIndicators>(`${API_BASE_URL}/api/v1/advanced-research/decay-indicators/${noradId}`);
}

export async function getAdvancedIllumination(noradId: number, tUtc: string): Promise<IlluminationStateResponse> {
  return apiRequest<IlluminationStateResponse>(`${API_BASE_URL}/api/v1/advanced-research/illumination/${noradId}?t_utc=${encodeURIComponent(tUtc)}`);
}

export async function getAdvancedRelativeMotion(primaryId: number, secondaryId: number, tcaUtc: string): Promise<RelativeMotionResult> {
  return apiRequest<RelativeMotionResult>(`${API_BASE_URL}/api/v1/advanced-research/relative-motion?primary_id=${primaryId}&secondary_id=${secondaryId}&tca_utc=${encodeURIComponent(tcaUtc)}`);
}

// --- USER SATELLITES ---

export interface TLEInput { line1: string; line2: string; epoch_utc?: string; }
export interface KeplerianInput {
  sma_km: number; eccentricity: number; inclination_deg: number;
  raan_deg: number; argp_deg: number; mean_anomaly_deg: number; epoch_utc: string;
}
export interface StateVectorInput {
  pos_x_km: number; pos_y_km: number; pos_z_km: number;
  vel_x_kms: number; vel_y_kms: number; vel_z_kms: number; epoch_utc: string;
}
export interface CovarianceSimple {
  sigma_r_km: number; sigma_t_km: number; sigma_n_km: number;
  sigma_vr_kms?: number; sigma_vt_kms?: number; sigma_vn_kms?: number;
}
export interface PhysicalParams {
  hard_body_radius_m?: number;
  drag_area_m2?: number;
  srp_area_m2?: number;
  mass_kg?: number;
  cd?: number;
  cr?: number;
}
export interface UserSatelliteCreate {
  name: string;
  mission_type: string;
  input_format: 'TLE' | 'KEPLERIAN' | 'STATE_VECTOR';
  tle?: TLEInput;
  keplerian?: KeplerianInput;
  state_vector?: StateVectorInput;
  covariance_simple?: CovarianceSimple;
  physical?: PhysicalParams;
}
export interface UserSatelliteResponse {
  id: number; name: string; mission_type: string; input_format: string;
  epoch_utc: string; pos_x_km: number; pos_y_km: number; pos_z_km: number;
  vel_x_kms: number; vel_y_kms: number; vel_z_kms: number;
  hard_body_radius_m: number; drag_area_m2: number; srp_area_m2: number;
  mass_kg: number; cd: number; cr: number;
  created_at: string;
}
export interface ConjunctionEvent {
  norad_id: number; name: string; object_type: string; category: string;
  tca_utc: string; miss_distance_km: number;
  miss_r_km: number; miss_t_km: number; miss_n_km: number;
  rel_velocity_kms: number; pc: number; risk_level: string;
  r_user_km: number[]; v_user_kms: number[]; r_cat_km: number[];
}
export interface UserConjunctionResponse {
  job_id: string; user_satellite_id: number; status: string;
  progress_pct: number; progress_msg: string;
  window_days: number; catalog_filter: string | null;
  events: ConjunctionEvent[]; total_events: number; created_at: string;
}

export async function createUserSatellite(payload: UserSatelliteCreate): Promise<UserSatelliteResponse> {
  return apiRequest<UserSatelliteResponse>(`${API_BASE_URL}/api/v1/user-satellites/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export async function listUserSatellites(): Promise<UserSatelliteResponse[]> {
  return apiRequest<UserSatelliteResponse[]>(`${API_BASE_URL}/api/v1/user-satellites/`);
}
export async function deleteUserSatellite(id: number): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/user-satellites/${id}`, { method: 'DELETE' });
}
export async function startUserConjunctionScreen(payload: {
  user_satellite_id: number; window_days: number;
  catalog_filter?: string; miss_distance_threshold_km?: number; pc_threshold?: number;
}): Promise<UserConjunctionResponse> {
  return apiRequest<UserConjunctionResponse>(`${API_BASE_URL}/api/v1/user-satellites/conjunction/screen`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export async function getUserConjunctionResult(jobId: string): Promise<UserConjunctionResponse> {
  return apiRequest<UserConjunctionResponse>(`${API_BASE_URL}/api/v1/user-satellites/conjunction/screen/${jobId}`);
}
export function getUserConjunctionExportUrl(jobId: string, format: 'json' | 'csv'): string {
  return `${API_BASE_URL}/api/v1/user-satellites/conjunction/screen/${jobId}/export?format=${format}`;
}
export async function getUserSatelliteState(satId: number, timestampUtc?: string): Promise<SatelliteState> {
  let url = `${API_BASE_URL}/api/v1/user-satellites/${satId}/state`;
  if (timestampUtc) url += `?timestamp_utc=${encodeURIComponent(timestampUtc)}`;
  return apiRequest<SatelliteState>(url);
}
export async function getUserSatelliteEphemeris(satId: number, payload: {
  start_time_utc: string; end_time_utc: string; step_seconds: number;
}): Promise<SatelliteState[]> {
  return apiRequest<SatelliteState[]>(`${API_BASE_URL}/api/v1/user-satellites/${satId}/ephemeris`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
