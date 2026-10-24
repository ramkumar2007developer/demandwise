"""Tests for Phase 3 budget feasibility service and /api/budget/feasibility endpoint.

Verifies:
- Itemized cost calculations for Cafe, Hotel/Restaurant, and Retail.
- Categorical classification: SURPLUS, FEASIBLE, and DEFICIT.
- Application of custom cost overrides.
- Budget difference and feasibility ratio arithmetic.
- Strict independence from ML models and LLMs.
- Illustrative disclaimers and metadata.
- HTTP API contract and validation handling.
"""

from __future__ import annotations

import sys
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.budget import FeasibilityCategory
from app.services.budget import (
    evaluate_budget_feasibility,
    get_default_cost_breakdown,
)


# ---------------------------------------------------------------------------
# Unit Tests: Default Cost Breakdowns per Business Type
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("btype", ["cafe", "hotel", "retail"])
def test_default_cost_breakdown_contains_all_categories(btype: str) -> None:
    items = get_default_cost_breakdown(btype)
    expected_categories = {
        "setup_renovation",
        "equipment",
        "initial_rent_deposit",
        "initial_inventory",
        "working_capital_reserve",
        "licensing_permits",
    }
    present_categories = {item.category for item in items}
    assert expected_categories == present_categories
    assert all(item.estimated_amount_inr > 0 for item in items)


def test_hotel_startup_costs_higher_than_cafe() -> None:
    cafe_items = get_default_cost_breakdown("cafe")
    hotel_items = get_default_cost_breakdown("hotel")
    cafe_total = sum(i.estimated_amount_inr for i in cafe_items)
    hotel_total = sum(i.estimated_amount_inr for i in hotel_items)
    assert hotel_total > cafe_total


# ---------------------------------------------------------------------------
# Unit Tests: Feasibility Classification Scenarios
# ---------------------------------------------------------------------------

def test_budget_feasibility_surplus() -> None:
    # Cafe default total is 350k + 250k + 150k + 80k + 100k + 20k = 950,000 INR
    # With 1,500,000 INR budget, ratio = 1.578 -> SURPLUS
    result = evaluate_budget_feasibility("cafe", budget_inr=1_500_000.0)
    assert result.feasibility_category == FeasibilityCategory.SURPLUS
    assert result.budget_difference_inr > 0
    assert result.feasibility_ratio > 1.15
    assert result.is_illustrative is True
    assert "illustrative planning benchmarks" in result.disclaimer.lower()


def test_budget_feasibility_tightly_feasible() -> None:
    # With 950,000 INR budget, ratio = 1.0 -> FEASIBLE
    result = evaluate_budget_feasibility("cafe", budget_inr=950_000.0)
    assert result.feasibility_category == FeasibilityCategory.FEASIBLE
    assert result.budget_difference_inr == 0.0
    assert 0.90 <= result.feasibility_ratio < 1.15


def test_budget_feasibility_deficit() -> None:
    # With 500,000 INR budget, ratio = 0.526 -> DEFICIT
    result = evaluate_budget_feasibility("cafe", budget_inr=500_000.0)
    assert result.feasibility_category == FeasibilityCategory.DEFICIT
    assert result.budget_difference_inr < 0
    assert result.feasibility_ratio < 0.90


def test_custom_cost_overrides_applied_correctly() -> None:
    # Baseline cafe total is 950,000. Override equipment from 250k to 500k (+250k -> 1.2M)
    overrides = {"equipment_override_inr": 500_000.0}
    result = evaluate_budget_feasibility("cafe", budget_inr=1_200_000.0, overrides=overrides)
    assert result.total_estimated_startup_cost_inr == 1_200_000.0
    eq_item = next(i for i in result.cost_breakdown if i.category == "equipment")
    assert eq_item.estimated_amount_inr == 500_000.0


def test_negative_or_zero_budget_raises_value_error() -> None:
    with pytest.raises(ValueError, match="strictly positive"):
        evaluate_budget_feasibility("cafe", budget_inr=0)
    with pytest.raises(ValueError, match="strictly positive"):
        evaluate_budget_feasibility("cafe", budget_inr=-100)


def test_budget_service_independent_of_ml_and_llm() -> None:
    """Ensure budget service module does not import ml modules or openai/langchain."""
    import app.services.budget as budget_mod

    module_source = inspect_module_imports(budget_mod)
    assert "ml" not in module_source
    assert "openai" not in module_source
    assert "anthropic" not in module_source
    assert "google" not in module_source


def inspect_module_imports(module: object) -> str:
    import inspect
    return inspect.getsource(module).lower()


# ---------------------------------------------------------------------------
# API Tests: POST /api/budget/feasibility
# ---------------------------------------------------------------------------

def test_api_budget_feasibility_success() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/budget/feasibility",
        json={"business_type": "cafe", "budget_inr": 1_200_000.0},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["business_type"] == "cafe"
    assert data["user_budget_inr"] == 1_200_000.0
    assert data["total_estimated_startup_cost_inr"] > 0
    assert data["feasibility_category"] in {"SURPLUS", "FEASIBLE", "DEFICIT"}
    assert len(data["cost_breakdown"]) == 6
    assert data["is_illustrative"] is True
    assert "illustrative" in data["disclaimer"].lower()


def test_api_budget_feasibility_rejects_non_positive_budget() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/budget/feasibility",
        json={"business_type": "cafe", "budget_inr": -50000.0},
    )
    assert response.status_code == 422


def test_api_budget_feasibility_supports_all_types() -> None:
    client = TestClient(app)
    for btype in ["cafe", "hotel", "retail"]:
        res = client.post(
            "/api/budget/feasibility",
            json={"business_type": btype, "budget_inr": 2_000_000.0},
        )
        assert res.status_code == 200
        assert res.json()["business_type"] == btype
