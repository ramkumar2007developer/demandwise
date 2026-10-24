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
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

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
        errorDetail = errorJson.detail || JSON.stringify(errorJson);
      } catch {
        errorDetail = await res.text();
      }
      throw new ApiError(
        errorDetail || `Request failed with status ${res.status}`,
        res.status,
        errorDetail
      );
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Network or connection error
    throw new ApiError(
      `Unable to connect to DemandWise backend at ${url}. Please ensure the backend server is running on port 8000.`,
      0,
      err.message
    );
  }
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

  // Phase 3: Standalone Competitor search
  searchCompetitors: (data: CompetitorSearchRequest) =>
    request<CompetitorSearchResponse>('/api/competitors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

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
