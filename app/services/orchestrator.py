"""Phase 5 end-to-end business analysis orchestrator.

Orchestrates the four core DemandWise services into a single pipeline:
1. Budget Feasibility (Phase 3) — always runs, deterministic.
2. Competitor Search (Phase 3) — best-effort with graceful degradation.
3. ML Demand Prediction (Phase 2) — best-effort with graceful degradation.
4. LLM Explanation (Phase 4) — always runs, falls back to template if needed.

Architectural Guarantees:
- Budget and LLM services always produce output (deterministic/fallback).
- Competitor search and ML prediction are best-effort; failures are captured
  as warnings in the response, not fatal errors.
- Sub-service errors never crash the orchestrator pipeline.
- Each stage records its status and timing for observability.
- Synthetic model status is disclosed at every level.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.config import Settings, get_settings
from app.schemas.analysis import (
    BusinessAnalysisRequest,
    CompetitorPreview,
)
from app.schemas.budget import BudgetFeasibilityResponse
from app.schemas.competitors import CompetitorSearchResponse
from app.schemas.explain import ExplanationContext, ExplanationResponse

logger = logging.getLogger(__name__)


@dataclass
class StageResult:
    """Tracks the outcome of a single orchestration stage."""

    stage: str
    status: str  # "success", "skipped", "degraded", "error"
    duration_ms: float = 0.0
    error_message: str | None = None


@dataclass
class OrchestrationResult:
    """Full result of end-to-end business analysis orchestration."""

    request_id: str
    business_name: str
    business_type: str
    language: str
    budget_inr: float
    location: dict[str, Any]

    # Sub-results
    budget_result: BudgetFeasibilityResponse | None = None
    competitor_result: CompetitorSearchResponse | None = None
    predicted_synthetic_monthly_visits: float | None = None
    ml_dataset_status: str = "synthetic_demo"
    ml_model_name: str | None = None
    explanation_result: ExplanationResponse | None = None

    # Competitor previews for the response
    competitor_previews: list[CompetitorPreview] = field(default_factory=list)
    competitor_names: list[str] = field(default_factory=list)

    # Observability
    stages: list[StageResult] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    total_duration_ms: float = 0.0


def run_analysis(
    request: BusinessAnalysisRequest,
    settings: Settings | None = None,
) -> OrchestrationResult:
    """Execute the full end-to-end business analysis pipeline.

    Parameters
    ----------
    request : BusinessAnalysisRequest
        Validated user request with business name, type, budget, location, etc.
    settings : Settings, optional
        Configuration instance (uses default if not provided).

    Returns
    -------
    OrchestrationResult
        Complete analysis with budget, competitors, ML prediction, and explanation.
    """
    cfg = settings or get_settings()
    pipeline_start = time.monotonic()

    btype = request.business_type.value
    lang = request.language.value
    request_id = f"dw-{uuid.uuid4().hex[:12]}"

    result = OrchestrationResult(
        request_id=request_id,
        business_name=request.business_name,
        business_type=btype,
        language=lang,
        budget_inr=request.budget_inr,
        location={
            "latitude": request.location.latitude,
            "longitude": request.location.longitude,
            "area_name": request.location.area_name,
            "city": request.location.city,
            "state": request.location.state,
        },
    )

    # -----------------------------------------------------------------------
    # Stage 1: Budget Feasibility (deterministic, always succeeds)
    # -----------------------------------------------------------------------
    stage1_start = time.monotonic()
    try:
        from app.services.budget import evaluate_budget_feasibility

        result.budget_result = evaluate_budget_feasibility(
            business_type=btype,
            budget_inr=request.budget_inr,
        )
        result.stages.append(StageResult(
            stage="budget_feasibility",
            status="success",
            duration_ms=_elapsed_ms(stage1_start),
        ))
    except Exception as exc:
        logger.error("Budget feasibility failed: %s", exc)
        result.stages.append(StageResult(
            stage="budget_feasibility",
            status="error",
            duration_ms=_elapsed_ms(stage1_start),
            error_message=str(exc),
        ))
        result.warnings.append(f"Budget calculation failed: {exc}")

    # -----------------------------------------------------------------------
    # Stage 2: Competitor Search (best-effort, gracefully degrades)
    # -----------------------------------------------------------------------
    stage2_start = time.monotonic()
    try:
        from app.services.competitors import search_competitors

        comp_res = search_competitors(
            latitude=request.location.latitude,
            longitude=request.location.longitude,
            business_type=btype,
        )
        result.competitor_result = comp_res

        # Build preview list (top 5 nearest competitors)
        for c in comp_res.competitors[:5]:
            result.competitor_previews.append(
                CompetitorPreview(
                    name=c.name,
                    category=c.category,
                    distance_km=c.distance_km,
                )
            )
            result.competitor_names.append(c.name)

        result.stages.append(StageResult(
            stage="competitor_search",
            status="success",
            duration_ms=_elapsed_ms(stage2_start),
        ))
    except Exception as exc:
        logger.warning("Competitor search failed during orchestration: %s", exc)
        result.stages.append(StageResult(
            stage="competitor_search",
            status="degraded",
            duration_ms=_elapsed_ms(stage2_start),
            error_message=str(exc),
        ))
        result.warnings.append(
            f"Competitor search unavailable: {exc}. Analysis continues without competitor data."
        )

    # -----------------------------------------------------------------------
    # Stage 3: ML Demand Prediction (best-effort, gracefully degrades)
    # -----------------------------------------------------------------------
    stage3_start = time.monotonic()
    try:
        from ml.predict import predict_demand

        # Use optional ML feature fields from the request, with sensible defaults
        floor_area = getattr(request, "floor_area_sqft", None) or 800.0
        near_college = getattr(request, "near_college", None)
        if near_college is None:
            near_college = 1

        pred_result = predict_demand({
            "business_type": btype,
            "latitude": request.location.latitude,
            "longitude": request.location.longitude,
            "budget_inr": request.budget_inr,
            "floor_area_sqft": floor_area,
            "competitor_count": len(result.competitor_previews),
            "near_college": near_college,
        })
        result.predicted_synthetic_monthly_visits = pred_result.predicted_synthetic_monthly_visits
        result.ml_dataset_status = pred_result.dataset_status
        result.ml_model_name = pred_result.model_name

        result.stages.append(StageResult(
            stage="ml_demand_prediction",
            status="success",
            duration_ms=_elapsed_ms(stage3_start),
        ))
    except Exception as exc:
        logger.warning("ML prediction failed during orchestration: %s", exc)
        result.stages.append(StageResult(
            stage="ml_demand_prediction",
            status="degraded",
            duration_ms=_elapsed_ms(stage3_start),
            error_message=str(exc),
        ))
        result.warnings.append(
            f"ML demand prediction unavailable: {exc}. Analysis continues without ML estimate."
        )

    # -----------------------------------------------------------------------
    # Stage 4: LLM Explanation (always produces output via fallback)
    # -----------------------------------------------------------------------
    stage4_start = time.monotonic()
    try:
        from app.services.llm import generate_explanation

        budget_res = result.budget_result
        ctx = ExplanationContext(
            business_name=request.business_name,
            business_type=btype,
            language=lang,
            latitude=request.location.latitude,
            longitude=request.location.longitude,
            area_name=request.location.area_name,
            city=request.location.city,
            state=request.location.state,
            predicted_synthetic_monthly_visits=result.predicted_synthetic_monthly_visits,
            dataset_status=result.ml_dataset_status,
            competitor_count=len(result.competitor_previews),
            competitor_names=result.competitor_names,
            user_budget_inr=request.budget_inr,
            total_estimated_startup_cost_inr=(
                budget_res.total_estimated_startup_cost_inr if budget_res else None
            ),
            budget_difference_inr=(
                budget_res.budget_difference_inr if budget_res else None
            ),
            feasibility_category=(
                budget_res.feasibility_category.value if budget_res else None
            ),
            notes=request.notes,
        )
        result.explanation_result = generate_explanation(ctx, settings=cfg)

        result.stages.append(StageResult(
            stage="llm_explanation",
            status="success",
            duration_ms=_elapsed_ms(stage4_start),
        ))
    except Exception as exc:
        logger.error("LLM explanation failed unexpectedly: %s", exc)
        result.stages.append(StageResult(
            stage="llm_explanation",
            status="error",
            duration_ms=_elapsed_ms(stage4_start),
            error_message=str(exc),
        ))
        result.warnings.append(f"Explanation generation failed: {exc}")

    result.total_duration_ms = _elapsed_ms(pipeline_start)
    return result


def _elapsed_ms(start: float) -> float:
    """Return elapsed milliseconds since start (monotonic clock)."""
    return round((time.monotonic() - start) * 1000, 2)
