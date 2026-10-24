from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.config import get_settings
from app.core.geo import is_within_coimbatore, location_error_message


class BusinessType(str, Enum):
    CAFE = "cafe"
    HOTEL = "hotel"
    RETAIL = "retail"


class Language(str, Enum):
    EN = "en"
    TA = "ta"


class LocationInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    latitude: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees.")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees.")
    area_name: str | None = Field(default=None, max_length=120)
    city: str = Field(default="Coimbatore", max_length=80)
    state: str = Field(default="Tamil Nadu", max_length=80)

    @field_validator("city")
    @classmethod
    def city_must_be_coimbatore(cls, value: str) -> str:
        if value.lower() != "coimbatore":
            raise ValueError("This version only supports Coimbatore.")
        return "Coimbatore"

    @field_validator("state")
    @classmethod
    def state_must_be_tamil_nadu(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if normalized.lower() not in {"tamil nadu", "tamilnadu"}:
            raise ValueError("This version only supports Tamil Nadu.")
        return "Tamil Nadu"

    @model_validator(mode="after")
    def coordinates_must_be_in_coimbatore(self) -> "LocationInput":
        settings = get_settings()
        if not is_within_coimbatore(self.latitude, self.longitude, settings):
            raise ValueError(location_error_message(settings))
        return self


class BusinessAnalysisRequest(BaseModel):
    """Request body for the Phase 5 end-to-end business analysis endpoint."""

    model_config = ConfigDict(str_strip_whitespace=True)

    business_name: str = Field(..., min_length=2, max_length=120)
    business_type: BusinessType
    language: Language = Language.EN
    budget_inr: float = Field(..., description="Planned investment budget in INR.")
    location: LocationInput
    notes: str | None = Field(default=None, max_length=500)

    # Optional ML feature overrides (Phase 5 orchestration)
    floor_area_sqft: float | None = Field(
        default=None,
        gt=0,
        description="Proposed floor area in sq ft. Defaults to 800 if not provided.",
    )
    near_college: int | None = Field(
        default=None,
        ge=0,
        le=1,
        description="1 if location is near a college campus, 0 otherwise. Defaults to 1 if not provided.",
    )

    @field_validator("business_type", mode="before")
    @classmethod
    def normalize_business_type(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip().lower().replace(" ", "_")
            aliases = {
                "cafe": BusinessType.CAFE,
                "café": BusinessType.CAFE,
                "coffee_shop": BusinessType.CAFE,
                "hotel": BusinessType.HOTEL,
                "hotel/small_restaurant": BusinessType.HOTEL,
                "hotel_small_restaurant": BusinessType.HOTEL,
                "small_restaurant": BusinessType.HOTEL,
                "restaurant": BusinessType.HOTEL,
                "retail": BusinessType.RETAIL,
                "retail_shop": BusinessType.RETAIL,
                "shop": BusinessType.RETAIL,
            }
            if cleaned in aliases:
                return aliases[cleaned]
        return value

    @field_validator("language", mode="before")
    @classmethod
    def normalize_language(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip().lower()
            aliases = {
                "en": Language.EN,
                "english": Language.EN,
                "ta": Language.TA,
                "tamil": Language.TA,
            }
            if cleaned in aliases:
                return aliases[cleaned]
        return value

    @field_validator("budget_inr")
    @classmethod
    def budget_must_be_in_range(cls, value: float) -> float:
        settings = get_settings()
        if value < settings.min_budget_inr or value > settings.max_budget_inr:
            raise ValueError(
                f"budget_inr must be between {settings.min_budget_inr:g} and {settings.max_budget_inr:g}."
            )
        return value


class CompetitorPreview(BaseModel):
    """Summary of a nearby competitor for the analysis response."""

    name: str
    category: str
    distance_km: float | None = None


class StageStatus(BaseModel):
    """Status of a single orchestration stage in the analysis pipeline."""

    stage: str = Field(..., description="Stage identifier (e.g., 'budget_feasibility').")
    status: str = Field(..., description="Outcome: 'success', 'degraded', or 'error'.")
    duration_ms: float = Field(default=0.0, description="Elapsed time in milliseconds.")
    error_message: str | None = Field(default=None, description="Error detail if status is not 'success'.")


class MLPredictionSummary(BaseModel):
    """Summary of the ML demand prediction sub-result."""

    predicted_synthetic_monthly_visits: float | None = Field(
        default=None,
        description="Synthetic demo prediction. NOT real demand.",
    )
    dataset_status: str = Field(
        default="synthetic_demo",
        description="Always 'synthetic_demo' until real labelled data is available.",
    )
    model_name: str | None = Field(default=None, description="ML model class name.")
    disclaimer: str = Field(
        default=(
            "Demand prediction is produced by a model trained on synthetic data. "
            "It does NOT represent observed demand, revenue, or footfall."
        ),
    )


class BudgetSummary(BaseModel):
    """Summary of the budget feasibility sub-result."""

    total_estimated_startup_cost_inr: float = Field(..., description="Total baseline startup cost in INR.")
    budget_difference_inr: float = Field(..., description="Budget minus startup cost.")
    feasibility_category: str = Field(..., description="SURPLUS, FEASIBLE, or DEFICIT.")
    feasibility_ratio: float = Field(..., description="Budget / startup cost ratio.")
    is_illustrative: bool = Field(default=True)


class BusinessAnalysisResponse(BaseModel):
    """Full end-to-end business analysis response (Phase 5).

    Integrates ML demand prediction, competitor search, budget feasibility,
    and bilingual LLM explanation into a single structured response with
    per-stage observability data.
    """

    request_id: str = Field(..., description="Unique analysis request identifier.")
    business_name: str
    business_type: BusinessType
    language: Language
    budget_inr: float
    location: LocationInput

    # Executive summary and recommendations from explanation service
    summary: str = Field(..., description="Executive summary from LLM or template fallback.")
    explanation: str = Field(default="", description="Full explanation text.")
    recommendations: list[str] = Field(default_factory=list)
    explanation_mode: str = Field(
        default="template_fallback",
        description="'llm_generated' or 'template_fallback'.",
    )

    # Sub-results
    ml_prediction: MLPredictionSummary | None = Field(
        default=None,
        description="ML demand prediction summary (None if prediction was unavailable).",
    )
    budget_feasibility: BudgetSummary | None = Field(
        default=None,
        description="Budget feasibility summary (None if budget calculation failed).",
    )
    competitors: list[CompetitorPreview] = Field(default_factory=list)
    competitor_count: int = Field(default=0, description="Number of verified nearby competitors.")

    # Observability
    stages: list[StageStatus] = Field(
        default_factory=list,
        description="Per-stage status, timing, and error details.",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Non-fatal warnings from degraded stages.",
    )
    total_duration_ms: float = Field(default=0.0, description="Total pipeline elapsed time in ms.")

    # Disclaimers
    disclaimer: str = Field(
        default=(
            "DEMO NOTICE: Demand prediction is produced by a model trained on synthetic data. "
            "Budget figures are illustrative benchmarks. Competitor data is from OpenStreetMap. "
            "This analysis does not constitute financial, legal, or commercial advice."
        ),
        description="Mandatory disclaimer for the full analysis.",
    )
