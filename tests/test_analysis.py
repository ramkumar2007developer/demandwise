"""Tests for Phase 5 end-to-end business analysis orchestration.

Verifies:
- The /api/analysis endpoint returns enriched structured responses with all sub-results.
- Budget feasibility, ML prediction, and LLM explanation are present in the response.
- Competitor search failures degrade gracefully (warning, not crash).
- ML prediction failures degrade gracefully (warning, not crash).
- Stage statuses, timing, and warnings are populated.
- Mandatory disclaimers and synthetic data notices are present.
- Request validation: out-of-boundary, invalid business type, budget range.
- Both English and Tamil language selection work end-to-end.
- Optional ML feature overrides (floor_area_sqft, near_college) are accepted.
- All Phase 1-4 endpoints remain operational.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


# Coimbatore sample coordinates
LAT = 11.0168
LNG = 76.9558

VALID_LOCATION = {
    "latitude": LAT,
    "longitude": LNG,
    "area_name": "RS Puram",
    "city": "Coimbatore",
    "state": "Tamil Nadu",
}


def _analysis_payload(**overrides) -> dict:
    """Build a standard analysis request payload with optional overrides."""
    data = {
        "business_name": "Kovai Fresh Cafe",
        "business_type": "cafe",
        "language": "en",
        "budget_inr": 1_200_000.0,
        "location": VALID_LOCATION,
        "notes": "Near Avinashi Road, targeting IT professionals.",
    }
    data.update(overrides)
    return data


# ---------------------------------------------------------------------------
# Core end-to-end analysis endpoint tests
# ---------------------------------------------------------------------------


def test_analysis_returns_200_with_enriched_response() -> None:
    """Verify the analysis endpoint returns a 200 with all expected top-level fields."""
    client = TestClient(app)
    payload = _analysis_payload()
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 200

    data = response.json()

    # Top-level fields
    assert data["business_name"] == "Kovai Fresh Cafe"
    assert data["business_type"] == "cafe"
    assert data["language"] == "en"
    assert data["budget_inr"] == 1_200_000.0
    assert data["request_id"].startswith("dw-")

    # Executive summary and explanation
    assert len(data["summary"]) > 10
    assert len(data["explanation"]) > 10
    assert data["explanation_mode"] in {"template_fallback", "llm_generated"}
    assert isinstance(data["recommendations"], list)
    assert len(data["recommendations"]) >= 1

    # Disclaimer is present
    assert "disclaimer" in data
    assert len(data["disclaimer"]) > 20


def test_analysis_contains_budget_feasibility() -> None:
    """Verify the budget feasibility sub-result is populated."""
    client = TestClient(app)
    response = client.post("/api/analysis", json=_analysis_payload())
    assert response.status_code == 200
    data = response.json()

    budget = data.get("budget_feasibility")
    assert budget is not None
    assert "total_estimated_startup_cost_inr" in budget
    assert budget["total_estimated_startup_cost_inr"] > 0
    assert "budget_difference_inr" in budget
    assert budget["feasibility_category"] in {"SURPLUS", "FEASIBLE", "DEFICIT"}
    assert budget["feasibility_ratio"] > 0
    assert budget["is_illustrative"] is True


def test_analysis_contains_ml_prediction() -> None:
    """Verify the ML prediction sub-result is populated when model artifact exists."""
    client = TestClient(app)
    response = client.post("/api/analysis", json=_analysis_payload())
    assert response.status_code == 200
    data = response.json()

    ml = data.get("ml_prediction")
    # ML may be None if artifact is missing, but if present must have the right shape
    if ml is not None:
        assert "predicted_synthetic_monthly_visits" in ml
        assert ml["dataset_status"] == "synthetic_demo"
        assert "disclaimer" in ml
        assert "synthetic" in ml["disclaimer"].lower()


def test_analysis_contains_stage_statuses() -> None:
    """Verify that stage statuses are populated with at least budget and explanation."""
    client = TestClient(app)
    response = client.post("/api/analysis", json=_analysis_payload())
    assert response.status_code == 200
    data = response.json()

    stages = data.get("stages", [])
    assert len(stages) >= 2  # At minimum budget_feasibility and llm_explanation
    stage_names = [s["stage"] for s in stages]
    assert "budget_feasibility" in stage_names
    assert "llm_explanation" in stage_names

    for stage in stages:
        assert stage["status"] in {"success", "degraded", "error", "skipped"}
        assert "duration_ms" in stage


def test_analysis_total_duration_is_positive() -> None:
    """Verify total_duration_ms is recorded."""
    client = TestClient(app)
    response = client.post("/api/analysis", json=_analysis_payload())
    assert response.status_code == 200
    data = response.json()
    assert data["total_duration_ms"] >= 0


def test_analysis_competitor_count_matches_list() -> None:
    """Verify competitor_count equals length of competitors list."""
    client = TestClient(app)
    response = client.post("/api/analysis", json=_analysis_payload())
    assert response.status_code == 200
    data = response.json()
    assert data["competitor_count"] == len(data["competitors"])


# ---------------------------------------------------------------------------
# Language tests
# ---------------------------------------------------------------------------


def test_analysis_tamil_language() -> None:
    """Verify Tamil language analysis returns ta-specific content."""
    client = TestClient(app)
    payload = _analysis_payload(language="ta", business_name="அரோமா காபி")
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "ta"
    assert len(data["summary"]) > 10
    assert len(data["recommendations"]) >= 1


def test_analysis_language_alias_tamil() -> None:
    """Verify 'tamil' string is normalized to 'ta'."""
    client = TestClient(app)
    payload = _analysis_payload(language="tamil")
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 200
    assert response.json()["language"] == "ta"


# ---------------------------------------------------------------------------
# Business type normalization tests
# ---------------------------------------------------------------------------


def test_analysis_hotel_type() -> None:
    """Verify hotel business type works."""
    client = TestClient(app)
    payload = _analysis_payload(
        business_type="hotel",
        business_name="Coimbatore Heritage Hotel",
        budget_inr=2_500_000.0,
    )
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 200
    assert response.json()["business_type"] == "hotel"


def test_analysis_retail_type() -> None:
    """Verify retail business type works."""
    client = TestClient(app)
    payload = _analysis_payload(
        business_type="retail",
        business_name="KovaiMart",
        budget_inr=1_500_000.0,
    )
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 200
    assert response.json()["business_type"] == "retail"


def test_analysis_business_type_alias() -> None:
    """Verify 'coffee_shop' normalizes to 'cafe'."""
    client = TestClient(app)
    payload = _analysis_payload(business_type="coffee_shop")
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 200
    assert response.json()["business_type"] == "cafe"


# ---------------------------------------------------------------------------
# Optional ML feature overrides
# ---------------------------------------------------------------------------


def test_analysis_with_ml_feature_overrides() -> None:
    """Verify optional floor_area_sqft and near_college fields are accepted."""
    client = TestClient(app)
    payload = _analysis_payload(
        floor_area_sqft=1200.0,
        near_college=0,
    )
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["business_name"] == "Kovai Fresh Cafe"


# ---------------------------------------------------------------------------
# Graceful degradation tests
# ---------------------------------------------------------------------------


def test_analysis_degrades_when_competitors_fail() -> None:
    """Verify analysis completes even if competitor search raises an exception."""
    client = TestClient(app)
    with patch(
        "app.services.competitors.search_competitors",
        side_effect=Exception("Overpass API unreachable"),
    ):
        response = client.post("/api/analysis", json=_analysis_payload())

    assert response.status_code == 200
    data = response.json()
    assert data["competitor_count"] == 0
    assert len(data["competitors"]) == 0

    # Should have a warning about competitor search
    assert any("Competitor" in w or "competitor" in w for w in data["warnings"])

    # Budget and explanation should still be present
    assert data.get("budget_feasibility") is not None
    assert len(data["summary"]) > 10


def test_analysis_degrades_when_ml_fails() -> None:
    """Verify analysis completes even if ML prediction raises an exception."""
    client = TestClient(app)
    with patch(
        "ml.predict.predict_demand",
        side_effect=Exception("Model artifact missing"),
    ):
        response = client.post("/api/analysis", json=_analysis_payload())

    assert response.status_code == 200
    data = response.json()
    assert data.get("ml_prediction") is None

    # Should have a warning about ML
    assert any("ML" in w or "prediction" in w for w in data["warnings"])

    # Budget and explanation should still be present
    assert data.get("budget_feasibility") is not None
    assert len(data["summary"]) > 10


# ---------------------------------------------------------------------------
# Request validation tests
# ---------------------------------------------------------------------------


def test_analysis_rejects_out_of_boundary_location() -> None:
    """Verify 422 for coordinates outside Coimbatore."""
    client = TestClient(app)
    payload = _analysis_payload(
        location={
            "latitude": 13.0827,
            "longitude": 80.2707,
            "city": "Coimbatore",
            "state": "Tamil Nadu",
        }
    )
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 422


def test_analysis_rejects_invalid_budget() -> None:
    """Verify 422 for budget outside allowed range."""
    client = TestClient(app)
    payload = _analysis_payload(budget_inr=-100)
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 422


def test_analysis_rejects_empty_business_name() -> None:
    """Verify 422 for too-short business name."""
    client = TestClient(app)
    payload = _analysis_payload(business_name="X")
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 422


def test_analysis_rejects_missing_required_fields() -> None:
    """Verify 422 when required fields are missing."""
    client = TestClient(app)
    response = client.post("/api/analysis", json={})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Phase 1-4 backward compatibility tests
# ---------------------------------------------------------------------------


def test_health_endpoint_still_works() -> None:
    """Verify Phase 1 /api/health is not broken."""
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_config_endpoint_still_works() -> None:
    """Verify Phase 1 /api/config is not broken."""
    client = TestClient(app)
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "supported_business_types" in data
    assert "geo_bounds" in data


def test_explain_endpoint_still_works() -> None:
    """Verify Phase 4 /api/explain is not broken."""
    client = TestClient(app)
    payload = {
        "business_name": "Test Cafe",
        "business_type": "cafe",
        "language": "en",
        "latitude": LAT,
        "longitude": LNG,
        "user_budget_inr": 500000.0,
    }
    response = client.post("/api/explain", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["explanation_mode"] in {"template_fallback", "llm_generated"}


def test_budget_endpoint_still_works() -> None:
    """Verify Phase 3 /api/budget/feasibility is not broken."""
    client = TestClient(app)
    payload = {"business_type": "cafe", "budget_inr": 1000000.0}
    response = client.post("/api/budget/feasibility", json=payload)
    assert response.status_code == 200
    assert response.json()["feasibility_category"] in {"SURPLUS", "FEASIBLE", "DEFICIT"}
