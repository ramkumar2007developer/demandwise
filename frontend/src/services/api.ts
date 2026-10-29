import type {
  BusinessAnalysisRequest,
  BusinessAnalysisResponse,
  BudgetFeasibilityRequest,
  BudgetFeasibilityResponse,
  CompetitorSearchRequest,
  CompetitorSearchResponse,
  ConfigResponse,
  ExplanationContext,
  ExplanationResponse,
  HealthResponse,
  PredictRequest,
  PredictResponse,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  : '';

export class ApiError extends Error {
  status: number;
  detail?: string | any;

  constructor(message: string, status: number, detail?: string | any) {
    super(sanitizeErrorMessage(message));
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Strips internal stack traces, filesystem paths, and potential secret keys
 * to protect against credential leaks and confusing debug outputs in UI.
 */
export function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'An unexpected error occurred.';
  if (typeof msg !== 'string') return String(msg);

  // Redact internal stack traces
  if (
    msg.includes('Traceback (most recent call last):') ||
    msg.includes('Internal Server Error') ||
    msg.includes('File "')
  ) {
    return 'The server encountered an issue processing your request. Please try again.';
  }

  // Redact potential API keys or tokens
  let sanitized = msg
    .replace(/gsk_[a-zA-Z0-9_-]{20,}/g, '[REDACTED_KEY]')
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_KEY]')
    .replace(/(?:password|secret|token)\s*[:=]\s*[^\s,]+/gi, '$1=[REDACTED]');

  // Redact filesystem paths
  sanitized = sanitized.replace(/[A-Za-z]:\\[^:\s\n]+\.[a-zA-Z0-9]+/g, '[system path]');

  return sanitized;
}

/**
 * Formats API error payloads (e.g., FastAPI Pydantic validation errors) into readable strings.
 */
function parseErrorDetail(errorJson: any, status: number): string {
  if (!errorJson) return `Request failed with status ${status}`;

  if (typeof errorJson === 'string') {
    return sanitizeErrorMessage(errorJson);
  }

  // FastAPI detail string or list
  if (errorJson.detail) {
    if (typeof errorJson.detail === 'string') {
      return sanitizeErrorMessage(errorJson.detail);
    }
    if (Array.isArray(errorJson.detail)) {
      return errorJson.detail
        .map((item: any) => {
          if (item?.msg) {
            const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : '';
            return field ? `${field}: ${item.msg}` : item.msg;
          }
          return typeof item === 'string' ? item : JSON.stringify(item);
        })
        .join('; ');
    }
  }

  if (errorJson.message && typeof errorJson.message === 'string') {
    return sanitizeErrorMessage(errorJson.message);
  }

  return `Request failed with status ${status}`;
}

// In-flight request deduplication map for idempotent GET requests
const inFlightRequests = new Map<string, Promise<any>>();

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const url = `${BASE_URL}${endpoint}`;

  if (isGet && inFlightRequests.has(url)) {
    return inFlightRequests.get(url) as Promise<T>;
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const execute = async (): Promise<T> => {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...(options.headers || {}),
        },
      });

      if (!res.ok) {
        let errorDetail = '';
        try {
          const errorJson = await res.json();
          errorDetail = parseErrorDetail(errorJson, res.status);
        } catch {
          const rawText = await res.text();
          errorDetail = sanitizeErrorMessage(rawText) || `Request failed with status ${res.status}`;
        }
        throw new ApiError(errorDetail, res.status, errorDetail);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      if (err instanceof ApiError) {
        throw err;
      }
      // Network or connection error (avoid leaking internal network details)
      throw new ApiError(
        `Unable to connect to DemandWise backend. Please ensure the backend server is running on port 8000.`,
        0,
        sanitizeErrorMessage(err?.message || 'Network connection failed')
      );
    }
  };

  const reqPromise = execute().finally(() => {
    if (isGet) {
      inFlightRequests.delete(url);
    }
  });

  if (isGet) {
    inFlightRequests.set(url, reqPromise);
  }

  return reqPromise;
}

// ─── Client-Side In-Memory TTL & Spatial Cache for Competitors ───────────────

interface ClientCompetitorCacheEntry {
  data: CompetitorSearchResponse;
  timestamp: number;
  latitude: number;
  longitude: number;
  radius_meters: number;
  business_type: string;
}

export const clientCompetitorCache: ClientCompetitorCacheEntry[] = [];
const CLIENT_CACHE_TTL_MS = 300_000; // 5 minutes
const CLIENT_PROXIMITY_REUSE_KM = 0.15; // 150m safe radius

export function clearCompetitorCache(): void {
  clientCompetitorCache.length = 0;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findInClientCache(
  lat: number,
  lng: number,
  bType: string,
  radius: number
): CompetitorSearchResponse | null {
  const now = Date.now();
  const radiusMeters = radius || 2000;
  const normType = bType.toLowerCase().trim();

  for (let i = clientCompetitorCache.length - 1; i >= 0; i--) {
    const entry = clientCompetitorCache[i];
    if (now - entry.timestamp > CLIENT_CACHE_TTL_MS) {
      clientCompetitorCache.splice(i, 1);
      continue;
    }

    if (entry.business_type !== normType || entry.radius_meters !== radiusMeters) {
      continue;
    }

    const dist = haversineKm(lat, lng, entry.latitude, entry.longitude);

    // Exact match (within 10m)
    if (dist < 0.01) {
      return {
        ...entry.data,
        is_cached: true,
      };
    }

    // Proximity match (within 150m): recalculate distances to new center
    if (dist <= CLIENT_PROXIMITY_REUSE_KM && entry.data.status === 'success') {
      const maxDistKm = radiusMeters / 1000.0;
      const recalculated = (entry.data.competitors || [])
        .map((comp) => ({
          ...comp,
          distance_km: Number(haversineKm(lat, lng, comp.latitude, comp.longitude).toFixed(4)),
        }))
        .filter((comp) => comp.distance_km <= maxDistKm)
        .sort((a, b) => a.distance_km - b.distance_km);

      return {
        ...entry.data,
        search_center: { latitude: lat, longitude: lng },
        total_found: recalculated.length,
        competitors: recalculated,
        status: recalculated.length > 0 ? 'success' : 'empty',
        note: recalculated.length > 0 ? null : 'No competitors found within the requested radius.',
        is_cached: true,
      };
    }
  }

  return null;
}

function addToClientCache(
  data: CompetitorSearchResponse,
  lat: number,
  lng: number,
  bType: string,
  radius: number
): void {
  if (data.status === 'success' || data.status === 'empty') {
    clientCompetitorCache.push({
      data: { ...data },
      timestamp: Date.now(),
      latitude: lat,
      longitude: lng,
      radius_meters: radius || 2000,
      business_type: bType.toLowerCase().trim(),
    });
    if (clientCompetitorCache.length > 60) {
      clientCompetitorCache.shift();
    }
  }
}

async function cachedSearchCompetitors(
  data: CompetitorSearchRequest,
  signal?: AbortSignal
): Promise<CompetitorSearchResponse> {
  const cached = findInClientCache(
    data.latitude,
    data.longitude,
    data.business_type,
    data.radius_meters || 2000
  );
  if (cached) {
    return cached;
  }

  const res = await request<CompetitorSearchResponse>('/api/competitors', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  });

  addToClientCache(
    res,
    data.latitude,
    data.longitude,
    data.business_type,
    data.radius_meters || 2000
  );

  return res;
}

export const api = {
  // Phase 1: Health & Config
  getHealth: () => request<HealthResponse>('/api/health'),
  getConfig: () => request<ConfigResponse>('/api/config'),

  // Phase 2: Standalone ML demand prediction
  predictDemand: (data: PredictRequest) =>
    request<PredictResponse>('/api/predict', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Phase 3 & Fast Optimization: Competitor search with client caching & cancellation
  searchCompetitors: (data: CompetitorSearchRequest, signal?: AbortSignal) =>
    cachedSearchCompetitors(data, signal),

  // Phase 3: Standalone Budget feasibility
  assessBudgetFeasibility: (data: BudgetFeasibilityRequest) =>
    request<BudgetFeasibilityResponse>('/api/budget/feasibility', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Phase 4: Standalone Explanation
  explainAnalysis: (data: ExplanationContext) =>
    request<ExplanationResponse>('/api/explain', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Phase 5: Primary End-to-End Orchestrated Analysis
  runAnalysis: (data: BusinessAnalysisRequest) =>
    request<BusinessAnalysisResponse>('/api/analysis', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

