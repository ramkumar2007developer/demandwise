import logging

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.schemas.analysis import (
    BusinessAnalysisRequest,
    BusinessAnalysisResponse,
)
from app.schemas.budget import BudgetFeasibilityRequest, BudgetFeasibilityResponse
from app.schemas.competitors import CompetitorSearchRequest, CompetitorSearchResponse
from app.schemas.explain import ExplanationContext, ExplanationResponse
from app.schemas.health import ConfigResponse, GeoBoundsResponse, HealthResponse
from app.schemas.predict import PredictRequest, PredictResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app_name=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
    )


@router.get("/config", response_model=ConfigResponse)
def config() -> ConfigResponse:
    settings = get_settings()
    bounds = settings.geo_bounds
    return ConfigResponse(
        app_name=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
        region=settings.region_name,
        state=settings.region_state,
        supported_business_types=settings.allowed_business_type_list,
        supported_languages=settings.supported_language_list,
        default_language=settings.default_language.lower(),
        min_budget_inr=settings.min_budget_inr,
        max_budget_inr=settings.max_budget_inr,
        geo_bounds=GeoBoundsResponse(**bounds),
        cors_origins=settings.cors_origin_list,
    )


# ---------------------------------------------------------------------------
# Phase 2: Synthetic demand prediction
# ---------------------------------------------------------------------------

@router.post(
    "/predict",
    response_model=PredictResponse,
    summary="Synthetic demand prediction (demo only)",
    description=(
        "Run a single-row inference through the Phase 2 RandomForestRegressor. "
        "**IMPORTANT**: The model is trained entirely on synthetic data. "
        "The predicted_synthetic_monthly_visits value is NOT real demand. "
        "It is a demo output for pipeline validation only. "
        "A trained artifact must exist; run `python -m ml.train` first."
    ),
)
def predict(body: PredictRequest) -> PredictResponse:
    """Return a synthetic demand estimate from the pre-trained demo pipeline.

    Raises
    ------
    503  If the model artifact has not been trained yet.
    422  If the feature values fail validation in the ML pipeline.
    """
    # Import here so FastAPI startup is not blocked when ML deps are absent.
    from ml.features import InvalidFeatureError
    from ml.predict import ModelArtifactMissingError, predict_demand

    row = pd.DataFrame(
        [
            {
                "business_type": body.business_type,
                "latitude": body.latitude,
                "longitude": body.longitude,
                "budget_inr": body.budget_inr,
                "floor_area_sqft": body.floor_area_sqft,
                "competitor_count": body.competitor_count,
                "near_college": body.near_college,
            }
        ]
    )

    try:
        result = predict_demand(row)
    except ModelArtifactMissingError as exc:
        logger.warning("Model artifact missing: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=(
                "Trained model artifact not found. "
                "Run `python -m ml.train` from the project root to generate it. "
                "This is expected on a fresh clone."
            ),
        ) from exc
    except InvalidFeatureError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return PredictResponse(
        dataset_status=result.dataset_status,
        model_mode=result.model_mode,
        model_name=result.model_name,
        target_name=result.target_name,
        predicted_synthetic_monthly_visits=result.predicted_synthetic_monthly_visits,
        limitations=result.limitations,
        feature_names=result.feature_names,
    )


# ---------------------------------------------------------------------------
# Phase 3: External Competitor Search & Retrieval (Place Search)
# ---------------------------------------------------------------------------

@router.post(
    "/competitors",
    response_model=CompetitorSearchResponse,
    summary="Search verified nearby competitors (OpenStreetMap Overpass Place Search)",
    description=(
        "Retrieve verified nearby businesses in Coimbatore using the OpenStreetMap Overpass API. "
        "Calculates exact Haversine distance, deduplicates results, and records provider metadata. "
        "**Spatial service note**: This endpoint performs Place Search (structured POI queries), "
        "which is distinct from Map Tiles (visual canvas rendering) and Geocoding (address resolution). "
        "Never fabricates competitor records or counts."
    ),
)
def search_nearby_competitors(body: CompetitorSearchRequest) -> CompetitorSearchResponse:
    """Execute place-search against OpenStreetMap Overpass API within Coimbatore boundary.

    Raises
    ------
    422  If coordinates fall outside the configured Coimbatore boundary.
    429  If OpenStreetMap Overpass rate limit is exceeded.
    504  If the external Overpass request times out.
    502  If the external provider returns an HTTP error or invalid response.
    """
    from app.services.competitors import (
        CompetitorBoundaryError,
        CompetitorServiceError,
        CompetitorServiceRateLimitError,
        CompetitorServiceTimeoutError,
        search_competitors,
    )

    try:
        return search_competitors(
            latitude=body.latitude,
            longitude=body.longitude,
            business_type=body.business_type,
            radius_meters=body.radius_meters,
        )
    except CompetitorBoundaryError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except CompetitorServiceRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except CompetitorServiceTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except CompetitorServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Phase 3: Startup Budget Feasibility Assessment
# ---------------------------------------------------------------------------

@router.post(
    "/budget/feasibility",
    response_model=BudgetFeasibilityResponse,
    summary="Assess startup budget feasibility",
    description=(
        "Evaluate whether a proposed investment budget covers estimated baseline startup "
        "costs for a business category in Coimbatore. Completely independent of the ML model "
        "and LLM. Cost line items include renovation, equipment, rent deposit, inventory, "
        "working capital, and licensing. Cost assumptions are illustrative student benchmarks."
    ),
)
def assess_budget_feasibility(body: BudgetFeasibilityRequest) -> BudgetFeasibilityResponse:
    """Calculate startup cost line items, budget difference, and feasibility category."""
    from app.services.budget import evaluate_budget_feasibility

    overrides = {
        "setup_renovation_override_inr": body.setup_renovation_override_inr,
        "equipment_override_inr": body.equipment_override_inr,
        "rent_deposit_override_inr": body.rent_deposit_override_inr,
        "initial_inventory_override_inr": body.initial_inventory_override_inr,
        "working_capital_reserve_override_inr": body.working_capital_reserve_override_inr,
        "licensing_permits_override_inr": body.licensing_permits_override_inr,
    }

    try:
        return evaluate_budget_feasibility(
            business_type=body.business_type,
            budget_inr=body.budget_inr,
            overrides=overrides,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Phase 4: Multilingual LLM Explanations (English & Tamil)
# ---------------------------------------------------------------------------

@router.post(
    "/explain",
    response_model=ExplanationResponse,
    summary="Generate bilingual business explanation (English or Tamil)",
    description=(
        "Generate a structured narrative explanation for a business opportunity in Coimbatore "
        "synthesizing ML demand prediction, OpenStreetMap competitor landscape, and budget feasibility. "
        "Supports English ('en') and Tamil ('ta'). Uses an OpenAI-compatible API or falls back to a "
        "high-quality deterministic rule-based template when the LLM is unconfigured or unavailable. "
        "Guarantees numerical integrity and clearly discloses synthetic demo model status."
    ),
)
def explain_analysis(body: ExplanationContext) -> ExplanationResponse:
    """Generate bilingual explanation for structured ML, competitor, and budget data."""
    from app.services.llm import generate_explanation

    return generate_explanation(body)


@router.post(
    "/analysis",
    response_model=BusinessAnalysisResponse,
    summary="End-to-end business opportunity analysis (Phase 5)",
    description=(
        "Orchestrates ML demand prediction, OpenStreetMap competitor search, startup budget "
        "feasibility, and bilingual LLM explanation into a single structured analysis for a "
        "proposed business in Coimbatore. Returns executive summary, full explanation, ML "
        "prediction, budget breakdown, competitor previews, actionable recommendations, "
        "per-stage timing, warnings, and mandatory disclaimers. Sub-service failures "
        "degrade gracefully without crashing the pipeline."
    ),
)
def run_business_analysis(body: BusinessAnalysisRequest) -> BusinessAnalysisResponse:
    """Execute end-to-end business analysis via the Phase 5 orchestrator."""
    from app.services.orchestrator import run_analysis

    result = run_analysis(body)

    # Build ML prediction summary if available
    ml_pred = None
    if result.predicted_synthetic_monthly_visits is not None:
        from app.schemas.analysis import MLPredictionSummary

        ml_pred = MLPredictionSummary(
            predicted_synthetic_monthly_visits=result.predicted_synthetic_monthly_visits,
            dataset_status=result.ml_dataset_status,
            model_name=result.ml_model_name,
        )

    # Build budget summary if available
    budget_sum = None
    if result.budget_result is not None:
        from app.schemas.analysis import BudgetSummary

        budget_sum = BudgetSummary(
            total_estimated_startup_cost_inr=result.budget_result.total_estimated_startup_cost_inr,
            budget_difference_inr=result.budget_result.budget_difference_inr,
            feasibility_category=result.budget_result.feasibility_category.value,
            feasibility_ratio=result.budget_result.feasibility_ratio,
        )

    # Build stage statuses
    from app.schemas.analysis import StageStatus

    stages = [
        StageStatus(
            stage=s.stage,
            status=s.status,
            duration_ms=s.duration_ms,
            error_message=s.error_message,
        )
        for s in result.stages
    ]

    # Extract explanation fields
    expl = result.explanation_result
    summary = expl.summary if expl else f"Analysis for {body.business_name} in Coimbatore."
    explanation = expl.explanation if expl else ""
    recommendations = expl.recommendations if expl else []
    explanation_mode = expl.explanation_mode if expl else "template_fallback"
    disclaimer = expl.disclaimer if expl else (
        "DEMO NOTICE: Demand prediction is produced by a model trained on synthetic data. "
        "Budget figures are illustrative benchmarks. Competitor data is from OpenStreetMap. "
        "This analysis does not constitute financial, legal, or commercial advice."
    )

    return BusinessAnalysisResponse(
        request_id=result.request_id,
        business_name=body.business_name,
        business_type=body.business_type,
        language=body.language,
        budget_inr=body.budget_inr,
        location=body.location,
        summary=summary,
        explanation=explanation,
        recommendations=recommendations,
        explanation_mode=explanation_mode,
        ml_prediction=ml_pred,
        budget_feasibility=budget_sum,
        competitors=result.competitor_previews,
        competitor_count=len(result.competitor_previews),
        competitor_status=result.competitor_status,
        competitor_error=result.competitor_error,
        stages=stages,
        warnings=result.warnings,
        total_duration_ms=result.total_duration_ms,
        disclaimer=disclaimer,
    )

