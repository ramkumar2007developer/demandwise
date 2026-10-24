"""Schemas for Phase 3 budget feasibility analysis.

These schemas define the request, response, and itemized startup cost line items.
All budget calculations are rule-based, fully deterministic, and completely
independent of the ML model and LLM.
"""

from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class FeasibilityCategory(str, Enum):
    """Categorical assessment of investment budget relative to startup costs."""

    SURPLUS = "SURPLUS"      # Budget exceeds estimated costs with comfortable safety buffer (>= 115%)
    FEASIBLE = "FEASIBLE"    # Budget is within tight feasible range of estimated costs (90% - 114%)
    DEFICIT = "DEFICIT"      # Budget is insufficient for estimated baseline startup requirements (< 90%)


class StartupCostItem(BaseModel):
    """An individual line item within the startup cost breakdown."""

    category: str = Field(..., description="Cost category name (e.g. 'setup_renovation', 'equipment').")
    description: str = Field(..., description="Human-readable description of what this cost entails.")
    estimated_amount_inr: float = Field(..., description="Estimated cost amount in INR.")


class BudgetFeasibilityRequest(BaseModel):
    """Input parameters for assessing startup budget feasibility."""

    model_config = ConfigDict(str_strip_whitespace=True)

    business_type: str = Field(
        ...,
        description="One of: cafe, hotel, retail.",
        examples=["cafe"],
    )
    budget_inr: float = Field(
        ...,
        gt=0,
        description="Planned investment budget in INR (strictly positive).",
        examples=[1000000.0],
    )
    # Optional customized overrides for specific cost components
    setup_renovation_override_inr: float | None = Field(
        default=None, ge=0, description="Optional custom estimate for renovation/interiors in INR."
    )
    equipment_override_inr: float | None = Field(
        default=None, ge=0, description="Optional custom estimate for commercial equipment in INR."
    )
    rent_deposit_override_inr: float | None = Field(
        default=None, ge=0, description="Optional custom estimate for rental advance/security deposit in INR."
    )
    initial_inventory_override_inr: float | None = Field(
        default=None, ge=0, description="Optional custom estimate for opening stock/inventory in INR."
    )
    working_capital_reserve_override_inr: float | None = Field(
        default=None, ge=0, description="Optional custom estimate for operating cash buffer in INR."
    )
    licensing_permits_override_inr: float | None = Field(
        default=None, ge=0, description="Optional custom estimate for licenses/permits in INR."
    )


class BudgetFeasibilityResponse(BaseModel):
    """Comprehensive budget feasibility assessment."""

    business_type: str = Field(..., description="Target business category.")
    user_budget_inr: float = Field(..., description="User's planned investment capital in INR.")
    total_estimated_startup_cost_inr: float = Field(
        ..., description="Sum of all baseline startup and capital expenditure line items in INR."
    )
    budget_difference_inr: float = Field(
        ...,
        description="user_budget_inr minus total_estimated_startup_cost_inr. Positive indicates surplus, negative indicates deficit.",
    )
    feasibility_category: FeasibilityCategory = Field(
        ..., description="Categorical assessment: SURPLUS, FEASIBLE, or DEFICIT."
    )
    feasibility_ratio: float = Field(
        ...,
        description="Ratio of user_budget_inr to total_estimated_startup_cost_inr (e.g. 1.20 = 120% funded).",
    )
    cost_breakdown: list[StartupCostItem] = Field(
        ..., description="Itemized breakdown of estimated startup cost categories."
    )
    is_illustrative: bool = Field(
        default=True,
        description="Always True. Cost assumptions are benchmark estimates for student planning.",
    )
    disclaimer: str = Field(
        default=(
            "Cost assumptions are illustrative planning benchmarks for Coimbatore student projects "
            "and do not constitute audited financial estimates or commercial quotations."
        ),
        description="Mandatory disclaimer clarifying the nature of the cost model.",
    )
