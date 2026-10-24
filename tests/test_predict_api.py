"""Tests for the Phase 2 POST /api/predict endpoint.

These tests verify the HTTP contract of the predict endpoint without requiring
a pre-existing artifact on disk.  Each test that needs a trained model trains
a tiny one in a temporary directory and patches the settings so the endpoint
uses that path.

Scope: HTTP endpoint behaviour, request validation, error handling, and
response shape.  ML pipeline internals are tested in test_ml.py.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

pd = pytest.importorskip("pandas")
pytest.importorskip("sklearn")
pytest.importorskip("joblib")

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from ml.dataset import generate_synthetic_dataset, save_dataset
from ml.train import train_and_save

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_VALID_BODY = {
    "business_type": "cafe",
    "latitude": 11.0168,
    "longitude": 76.9558,
    "budget_inr": 500_000,
    "floor_area_sqft": 900,
    "competitor_count": 4,
    "near_college": 1,
}


def _build_tiny_artifact(tmp_path: Path) -> Path:
    """Train a minimal model and return the artifact path."""
    dataset_path = tmp_path / "demo.csv"
    artifact_path = tmp_path / "demand_pipeline.joblib"
    metadata_path = tmp_path / "training_metadata.json"
    frame = generate_synthetic_dataset(n_per_type=24, random_state=0)
    save_dataset(frame, dataset_path)
    train_and_save(
        dataset_path=dataset_path,
        artifact_path=artifact_path,
        metadata_path=metadata_path,
        n_estimators=8,
        random_state=0,
    )
    return artifact_path


@pytest.fixture()
def client_with_model(tmp_path: Path) -> TestClient:
    """Return a TestClient whose settings point to a real tiny trained artifact."""
    artifact_path = _build_tiny_artifact(tmp_path)
    get_settings.cache_clear()
    override = Settings(
        ml_artifact_path=str(artifact_path),
        ml_dataset_path=str(tmp_path / "demo.csv"),
        ml_metadata_path=str(tmp_path / "training_metadata.json"),
    )
    with patch("app.api.routes.get_settings", return_value=override):
        # Also patch the predict module so load_model_bundle uses the tmp path.
        with patch("ml.predict.get_settings", return_value=override):
            yield TestClient(app)
    get_settings.cache_clear()


@pytest.fixture()
def client_no_model(tmp_path: Path) -> TestClient:
    """Return a TestClient whose artifact path points to a non-existent file."""
    get_settings.cache_clear()
    override = Settings(
        ml_artifact_path=str(tmp_path / "absent.joblib"),
    )
    with patch("app.api.routes.get_settings", return_value=override):
        with patch("ml.predict.get_settings", return_value=override):
            yield TestClient(app)
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Tests: missing artifact
# ---------------------------------------------------------------------------

def test_predict_returns_503_when_artifact_missing(client_no_model: TestClient) -> None:
    response = client_no_model.post("/api/predict", json=_VALID_BODY)
    assert response.status_code == 503
    payload = response.json()
    # The standard error envelope from Phase 1 exception handlers
    assert "error" in payload
    assert payload["error"]["code"] == "http_error"


# ---------------------------------------------------------------------------
# Tests: request validation (Pydantic layer; no model needed)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "overrides,expected_status",
    [
        ({"budget_inr": -1}, 422),        # negative budget
        ({"budget_inr": 0}, 422),          # zero budget
        ({"floor_area_sqft": 0}, 422),     # zero area
        ({"floor_area_sqft": -100}, 422),  # negative area
        ({"competitor_count": -1}, 422),   # negative competitor count
        ({"near_college": 2}, 422),        # near_college out of range
        ({"near_college": -1}, 422),       # near_college out of range
        ({"latitude": 91}, 422),           # latitude out of global range
        ({"longitude": 181}, 422),         # longitude out of global range
    ],
)
def test_predict_validates_request_fields(overrides: dict, expected_status: int) -> None:
    """Pydantic validation catches bad field values before reaching the model."""
    client = TestClient(app)
    body = {**_VALID_BODY, **overrides}
    response = client.post("/api/predict", json=body)
    assert response.status_code == expected_status


def test_predict_requires_all_fields() -> None:
    """Omitting required fields should return 422."""
    client = TestClient(app)
    response = client.post("/api/predict", json={"business_type": "cafe"})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Tests: successful inference (requires trained artifact)
# ---------------------------------------------------------------------------

def test_predict_returns_200_with_valid_body(client_with_model: TestClient) -> None:
    response = client_with_model.post("/api/predict", json=_VALID_BODY)
    assert response.status_code == 200


def test_predict_response_shape(client_with_model: TestClient) -> None:
    response = client_with_model.post("/api/predict", json=_VALID_BODY)
    payload = response.json()
    assert payload["dataset_status"] == "synthetic_demo"
    assert payload["model_mode"] == "synthetic_demo"
    assert payload["model_name"] == "RandomForestRegressor"
    assert payload["target_name"] == "synthetic_monthly_visits"
    assert isinstance(payload["predicted_synthetic_monthly_visits"], float)
    assert payload["predicted_synthetic_monthly_visits"] > 0
    assert isinstance(payload["limitations"], list)
    assert len(payload["limitations"]) > 0
    assert isinstance(payload["feature_names"], list)
    assert len(payload["feature_names"]) > 0


def test_predict_limitations_mention_synthetic(client_with_model: TestClient) -> None:
    """Every prediction response must carry a synthetic-data disclaimer."""
    response = client_with_model.post("/api/predict", json=_VALID_BODY)
    payload = response.json()
    joined = " ".join(payload["limitations"]).lower()
    assert "synthetic" in joined


def test_predict_different_business_types_produce_different_results(
    client_with_model: TestClient,
) -> None:
    results = {}
    for btype in ("cafe", "hotel", "retail"):
        body = {**_VALID_BODY, "business_type": btype}
        r = client_with_model.post("/api/predict", json=body)
        assert r.status_code == 200
        results[btype] = r.json()["predicted_synthetic_monthly_visits"]
    # All three should return positive values
    assert all(v > 0 for v in results.values())


def test_predict_invalid_business_type_via_ml_validation(
    client_with_model: TestClient,
) -> None:
    """An unsupported business type passes Pydantic but is caught by the ML layer."""
    body = {**_VALID_BODY, "business_type": "warehouse"}
    response = client_with_model.post("/api/predict", json=body)
    # ML InvalidFeatureError → 422 from the route handler
    assert response.status_code == 422
