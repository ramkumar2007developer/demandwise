"""Schemas for Phase 4 bilingual LLM explanations (English & Tamil).

These schemas define the input context passed to the explanation generator
and the structured explanation output.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ExplanationContext(BaseModel):
    """Structured context combining ML, competitor, and budget analysis data."""

    model_config = ConfigDict(str_strip_whitespace=True)

    business_name: str = Field(..., min_length=1, max_length=120, description="Proposed business name.")
    business_type: str = Field(..., description="Business category: cafe, hotel, retail.")
    language: str = Field(default="en", description="Target explanation language: 'en' (English) or 'ta' (Tamil).")
    
    # Location context
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    area_name: str | None = Field(default=None, max_length=120)
    city: str = Field(default="Coimbatore")
    state: str = Field(default="Tamil Nadu")

    # Phase 2 ML demand data
    predicted_synthetic_monthly_visits: float | None = Field(
        default=None,
        description="Predicted visits from synthetic demo model (None if ML skipped).",
    )
    dataset_status: str = Field(
        default="synthetic_demo",
        description="Must disclose synthetic status.",
    )

    # Phase 3 Competitor data
    competitor_count: int = Field(
        default=0,
        ge=0,
        description="Exact count of verified nearby competitors retrieved.",
    )
    competitor_names: list[str] = Field(
        default_factory=list,
        description="Names of verified nearby competitors.",
    )

    # Phase 3 Budget feasibility data
    user_budget_inr: float = Field(
        ...,
        gt=0,
        description="User's planned investment capital in INR.",
    )
    total_estimated_startup_cost_inr: float | None = Field(
        default=None,
        description="Total estimated startup capital cost in INR.",
    )
    budget_difference_inr: float | None = Field(
        default=None,
        description="user_budget_inr minus total_estimated_startup_cost_inr.",
    )
    feasibility_category: str | None = Field(
        default=None,
        description="SURPLUS, FEASIBLE, or DEFICIT.",
    )

    notes: str | None = Field(default=None, max_length=500)

    @field_validator("language", mode="before")
    @classmethod
    def normalize_language(cls, value: object) -> str:
        if isinstance(value, str):
            cleaned = value.strip().lower()
            if cleaned in {"ta", "tamil"}:
                return "ta"
            return "en"
        return "en"


class ExplanationResponse(BaseModel):
    """Structured bilingual explanation output."""

    language: str = Field(..., description="Language of the explanation ('en' or 'ta').")
    explanation: str = Field(..., description="Comprehensive multi-section explanation text.")
    summary: str = Field(..., description="Concise executive summary (1-2 sentences).")
    recommendations: list[str] = Field(
        default_factory=list,
        description="Key actionable recommendations/next steps for the user.",
    )
    explanation_mode: str = Field(
        ...,
        description="'llm_generated' if generated via API, or 'template_fallback' if rule-based fallback used.",
    )
    llm_provider: str = Field(..., description="Configured LLM provider name.")
    llm_model: str = Field(..., description="Configured LLM model identifier.")
    disclaimer: str = Field(
        ...,
        description="Mandatory disclaimer stating synthetic model status and non-guarantee of business outcomes.",
    )
