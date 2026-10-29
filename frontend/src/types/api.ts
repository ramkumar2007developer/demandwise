// DemandWise V1 — TypeScript API Type Definitions (Mirrors backend Pydantic schemas)

export type BusinessType = 'cafe' | 'hotel' | 'retail';
export type Language = 'en' | 'ta';

export interface LocationInput {
  latitude: number;
  longitude: number;
  area_name?: string;
  city?: string;
  state?: string;
}

export interface HealthResponse {
  status: string;
  app_name: string;
  version: string;
  environment: string;
}

export interface GeoBounds {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
}

export interface ConfigResponse {
  app_name: string;
  version: string;
  environment: string;
  region: string;
  state: string;
  supported_business_types: string[];
  supported_languages: string[];
  default_language: string;
  min_budget_inr: number;
  max_budget_inr: number;
  geo_bounds: GeoBounds;
  cors_origins: string[];
}

export interface PredictRequest {
  business_type: string;
  latitude: number;
  longitude: number;
  budget_inr: number;
  floor_area_sqft: number;
  competitor_count: number;
  near_college: number;
}

export interface PredictResponse {
  dataset_status: string;
  model_mode: string;
  model_name: string;
  target_name: string;
  predicted_synthetic_monthly_visits: number;
  limitations: string[];
  feature_names: string[];
}

export interface CompetitorItem {
  name: string;
  category: string;
  osm_type?: string;
  osm_id: number;
  latitude: number;
  longitude: number;
  distance_km: number;
  address?: string | null;
  street?: string | null;
  brand?: string | null;
}

export interface CompetitorSearchRequest {
  business_type: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
}

export interface CompetitorSearchResponse {
  provider: string;
  service_type: string;
  retrieval_timestamp: string;
  search_center: { latitude: number; longitude: number };
  search_radius_meters: number;
  business_type: string;
  total_found: number;
  competitors: CompetitorItem[];
  status: string;
  note?: string | null;
  is_cached?: boolean;
}

export interface StartupCostItem {
  category: string;
  description: string;
  estimated_amount_inr: number;
}

export interface BudgetFeasibilityRequest {
  business_type: string;
  budget_inr: number;
  setup_renovation_override_inr?: number;
  equipment_override_inr?: number;
  rent_deposit_override_inr?: number;
  initial_inventory_override_inr?: number;
  working_capital_reserve_override_inr?: number;
  licensing_permits_override_inr?: number;
}

export interface BudgetFeasibilityResponse {
  business_type: string;
  user_budget_inr: number;
  total_estimated_startup_cost_inr: number;
  budget_difference_inr: number;
  feasibility_category: 'SURPLUS' | 'FEASIBLE' | 'DEFICIT';
  feasibility_ratio: number;
  cost_breakdown: StartupCostItem[];
  is_illustrative: boolean;
  disclaimer: string;
}

export interface ExplanationContext {
  business_name: string;
  business_type: string;
  language: string;
  latitude: number;
  longitude: number;
  area_name?: string;
  city?: string;
  state?: string;
  predicted_synthetic_monthly_visits?: number | null;
  dataset_status?: string;
  competitor_count?: number;
  competitor_names?: string[];
  user_budget_inr: number;
  total_estimated_startup_cost_inr?: number | null;
  budget_difference_inr?: number | null;
  feasibility_category?: string | null;
  notes?: string;
}

export interface ExplanationResponse {
  language: string;
  explanation: string;
  summary: string;
  recommendations: string[];
  explanation_mode: string;
  llm_provider: string;
  llm_model: string;
  disclaimer: string;
}

export interface BusinessAnalysisRequest {
  business_name: string;
  business_type: BusinessType;
  language?: Language;
  budget_inr: number;
  location: LocationInput;
  notes?: string;
  floor_area_sqft?: number;
  near_college?: number;
}

export interface MLPredictionSummary {
  predicted_synthetic_monthly_visits: number | null;
  dataset_status: string;
  model_name?: string | null;
  disclaimer: string;
}

export interface BudgetSummary {
  total_estimated_startup_cost_inr: number;
  budget_difference_inr: number;
  feasibility_category: string;
  feasibility_ratio: number;
  is_illustrative: boolean;
}

export interface CompetitorPreview {
  name: string;
  category: string;
  distance_km?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  osm_id?: number | null;
  street?: string | null;
}

export interface StageStatus {
  stage: string;
  status: string; // 'success' | 'degraded' | 'error'
  duration_ms: number;
  error_message?: string | null;
}

export interface BusinessAnalysisResponse {
  request_id: string;
  business_name: string;
  business_type: string;
  language: string;
  budget_inr: number;
  location: LocationInput;
  summary: string;
  explanation: string;
  recommendations: string[];
  explanation_mode: string;
  ml_prediction?: MLPredictionSummary | null;
  budget_feasibility?: BudgetSummary | null;
  competitors: CompetitorPreview[];
  competitor_count: number;
  competitor_status?: 'success' | 'empty' | 'degraded' | 'error';
  competitor_error?: string | null;
  stages: StageStatus[];
  warnings: string[];
  total_duration_ms: number;
  disclaimer: string;
}
