"""Pydantic schemas for the Phase 2 demand-prediction API endpoint.

These schemas are deliberately kept separate from the future business-analysis
response schemas (app/schemas/analysis.py) so that the synthetic ML layer and
the eventual real-analysis layer remain distinct concerns.

IMPORTANT: Every field in PredictResponse that originates from the ML model
carries a disclaimer. Predictions come from a synthetic-demo model trained on
generated data.  They are NOT validated real-world demand figures.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    """Input to the synthetic demand prediction endpoint.

    All fields are passed through the same feature-engineering path used
    during training.  floor_area_sqft and competitor_count are not available
    from the business-analysis request schema in Phase 1, so they are
    supplied explicitly here for the ML demo endpoint.
    """

    business_type: str = Field(
        ...,
        description="One of: cafe, hotel, retail.",
        examples=["cafe"],
    )
    latitude: float = Field(
        ...,
        ge=-90,
        le=90,
        description="Latitude in decimal degrees (must be within Coimbatore bounds).",
        examples=[11.0168],
    )
    longitude: float = Field(
        ...,
        ge=-180,
        le=180,
        description="Longitude in decimal degrees (must be within Coimbatore bounds).",
        examples=[76.9558],
    )
    budget_inr: float = Field(
        ...,
        gt=0,
        description="Planned investment budget in INR (must be positive).",
        examples=[500000],
    )
    floor_area_sqft: float = Field(
        ...,
        gt=0,
        description="Proposed floor area in square feet (must be positive).",
        examples=[900],
    )
    competitor_count: int = Field(
        ...,
        ge=0,
        description="Estimated number of direct competitors within nearby area (0 or more).",
        examples=[4],
    )
    near_college: int = Field(
        ...,
        ge=0,
        le=1,
        description="1 if the location is near a college or university campus, else 0.",
        examples=[1],
    )


class PredictResponse(BaseModel):
    """Output of the synthetic demand prediction endpoint.

    WARNING: The predicted_synthetic_monthly_visits field is produced by a
    RandomForestRegressor trained entirely on synthetically generated data.
    It does NOT represent observed footfall, revenue, or validated demand.
    Do not use this value as investment advice or a real demand forecast.
    """

    dataset_status: str = Field(
        description="Always 'synthetic_demo' until real labelled data is available.",
        examples=["synthetic_demo"],
    )
    model_mode: str = Field(
        description="Identifies the operational mode of the model.",
        examples=["synthetic_demo"],
    )
    model_name: str = Field(
        description="The sklearn estimator class used.",
        examples=["RandomForestRegressor"],
    )
    target_name: str = Field(
        description="Name of the predicted column.",
        examples=["synthetic_monthly_visits"],
    )
    predicted_synthetic_monthly_visits: float = Field(
        description=(
            "SYNTHETIC DEMO OUTPUT: estimated monthly customer visits produced by a "
            "model trained on generated data.  Not a real demand measurement."
        ),
        examples=[820.5],
    )
    limitations: list[str] = Field(
        description="Mandatory disclaimers that must accompany any display of this prediction.",
    )
    feature_names: list[str] = Field(
        description="Ordered list of feature names the model was trained on.",
    )
