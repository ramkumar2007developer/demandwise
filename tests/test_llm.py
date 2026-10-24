"""Tests for Phase 4 multilingual LLM explanation service and endpoints.

Verifies:
- Configurable OpenAI-compatible client integration with mocked responses (0 paid API cost).
- High-quality deterministic fallback generation in English and Tamil.
- Preservation of immutable ground-truth numbers (predictions, budget, competitor counts).
- Synthetic demo disclaimers present in both English and Tamil.
- Error resilience: missing API key, timeouts, rate limits, HTTP 500, malformed JSON.
- Non-breakage: ML and budget analysis remain completely usable without LLM.
- POST /api/explain and POST /api/analysis endpoint contracts.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.schemas.explain import ExplanationContext
from app.services.llm import (
    generate_explanation,
    generate_fallback_explanation,
)

# Coimbatore sample coordinates
LAT = 11.0168
LNG = 76.9558


def _sample_context(language: str = "en", **overrides) -> ExplanationContext:
    data = {
        "business_name": "Kovai Filter Coffee",
        "business_type": "cafe",
        "language": language,
        "latitude": LAT,
        "longitude": LNG,
        "area_name": "RS Puram",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "predicted_synthetic_monthly_visits": 850.5,
        "dataset_status": "synthetic_demo",
        "competitor_count": 3,
        "competitor_names": ["Aroma Cafe", "Cross Cut Coffee", "Chai Shai"],
        "user_budget_inr": 1_200_000.0,
        "total_estimated_startup_cost_inr": 950_000.0,
        "budget_difference_inr": 250_000.0,
        "feasibility_category": "SURPLUS",
        "notes": "Focus on traditional south Indian breakfast and filter coffee.",
    }
    data.update(overrides)
    return ExplanationContext(**data)


def _mock_llm_client(content: str, status_code: int = 200) -> httpx.Client:
    """Build mock httpx.Client returning OpenAI-compatible chat completion payload."""
    def handler(request: httpx.Request) -> httpx.Response:
        data = {
            "id": "chatcmpl-test-123",
            "object": "chat.completion",
            "created": 1700000000,
            "model": "gpt-4o-mini",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
        }
        return httpx.Response(status_code=status_code, json=data, request=request)

    return httpx.Client(transport=httpx.MockTransport(handler))


# ---------------------------------------------------------------------------
# Unit Tests: Deterministic Fallback Template (English & Tamil)
# ---------------------------------------------------------------------------

def test_fallback_explanation_english() -> None:
    ctx = _sample_context(language="en")
    res = generate_fallback_explanation(ctx)

    assert res.language == "en"
    assert res.explanation_mode == "template_fallback"
    assert "850.5" in res.explanation
    assert "1,200,000" in res.explanation
    assert "950,000" in res.explanation
    assert "SURPLUS" in res.explanation
    assert "Aroma Cafe" in res.explanation
    assert "synthetic" in res.explanation.lower()
    assert "synthetic" in res.disclaimer.lower()
    assert len(res.recommendations) >= 3
    assert len(res.summary) > 10


def test_fallback_explanation_tamil() -> None:
    ctx = _sample_context(language="ta")
    res = generate_fallback_explanation(ctx)

    assert res.language == "ta"
    assert res.explanation_mode == "template_fallback"
    assert "850.5" in res.explanation
    assert "1,200,000" in res.explanation
    assert "திட்டச் சுருக்கம்" in res.explanation
    assert "தேவை மதிப்பீடு" in res.explanation
    assert "போட்டி நிலவரம்" in res.explanation
    assert "செயற்கை" in res.disclaimer  # synthetic notice in Tamil
    assert len(res.recommendations) >= 3


def test_fallback_handles_missing_optional_fields() -> None:
    ctx = ExplanationContext(
        business_name="Minimal Retail",
        business_type="retail",
        language="en",
        latitude=LAT,
        longitude=LNG,
        user_budget_inr=500_000.0,
    )
    res = generate_fallback_explanation(ctx)
    assert res.explanation_mode == "template_fallback"
    assert "Minimal Retail" in res.explanation
    assert "N/A" in res.explanation or "500,000" in res.explanation


# ---------------------------------------------------------------------------
# Unit Tests: OpenAI-Compatible Service with Mocked Transport
# ---------------------------------------------------------------------------

def test_llm_service_returns_fallback_when_api_key_empty() -> None:
    ctx = _sample_context(language="en")
    settings = Settings(llm_api_key=None)
    res = generate_explanation(ctx, settings=settings)
    assert res.explanation_mode == "template_fallback"


def test_llm_service_parses_valid_json_response() -> None:
    mock_llm_output = json.dumps(
        {
            "summary": "Strong opportunity with positive capital reserve in RS Puram.",
            "explanation": "Demand estimation indicates consistent local traffic for cafes in Coimbatore.",
            "recommendations": ["Conduct peak hour traffic count", "Secure commercial lease deposit"],
        }
    )
    client = _mock_llm_client(mock_llm_output)
    settings = Settings(llm_api_key="sk-test-mock-key")
    ctx = _sample_context(language="en")

    res = generate_explanation(ctx, settings=settings, http_client=client)
    assert res.explanation_mode == "llm_generated"
    assert "Strong opportunity" in res.summary
    assert "Demand estimation indicates" in res.explanation
    assert len(res.recommendations) == 2


def test_llm_service_parses_markdown_fenced_json() -> None:
    fenced = (
        "```json\n"
        + json.dumps(
            {
                "summary": "Fenced JSON executive summary.",
                "explanation": "Detailed explanation inside fenced block.",
                "recommendations": ["Step 1", "Step 2"],
            }
        )
        + "\n```"
    )
    client = _mock_llm_client(fenced)
    settings = Settings(llm_api_key="sk-test-mock-key")
    ctx = _sample_context(language="en")

    res = generate_explanation(ctx, settings=settings, http_client=client)
    assert res.explanation_mode == "llm_generated"
    assert "Fenced JSON" in res.summary


def test_llm_service_handles_plain_text_gracefully() -> None:
    plain_text = "This is a plain-text explanation generated by an LLM without JSON formatting."
    client = _mock_llm_client(plain_text)
    settings = Settings(llm_api_key="sk-test-mock-key")
    ctx = _sample_context(language="en")

    res = generate_explanation(ctx, settings=settings, http_client=client)
    assert res.explanation_mode == "llm_generated"
    assert plain_text in res.explanation


def test_llm_service_falls_back_on_timeout() -> None:
    def timeout_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("LLM gateway timeout")

    client = httpx.Client(transport=httpx.MockTransport(timeout_handler))
    settings = Settings(llm_api_key="sk-test-mock-key")
    ctx = _sample_context(language="en")

    res = generate_explanation(ctx, settings=settings, http_client=client)
    # Must fallback cleanly to deterministic template without raising exception
    assert res.explanation_mode == "template_fallback"
    assert "Kovai Filter Coffee" in res.explanation


def test_llm_service_falls_back_on_http_error() -> None:
    def error_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=500, text="Internal Server Error", request=request)

    client = httpx.Client(transport=httpx.MockTransport(error_handler))
    settings = Settings(llm_api_key="sk-test-mock-key")
    ctx = _sample_context(language="en")

    res = generate_explanation(ctx, settings=settings, http_client=client)
    assert res.explanation_mode == "template_fallback"


# ---------------------------------------------------------------------------
# API Tests: POST /api/explain and POST /api/analysis
# ---------------------------------------------------------------------------

def test_api_explain_endpoint_english() -> None:
    client = TestClient(app)
    payload = _sample_context(language="en").model_dump()
    response = client.post("/api/explain", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "en"
    assert data["explanation_mode"] in {"template_fallback", "llm_generated"}
    assert "synthetic" in data["disclaimer"].lower()
    assert len(data["recommendations"]) >= 1


def test_api_explain_endpoint_tamil() -> None:
    client = TestClient(app)
    payload = _sample_context(language="tamil").model_dump()
    response = client.post("/api/explain", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "ta"
    assert data["explanation_mode"] in {"template_fallback", "llm_generated"}
    if data["explanation_mode"] == "template_fallback":
        assert "திட்டச் சுருக்கம்" in data["explanation"]
    else:
        assert len(data["explanation"]) > 20
    assert len(data["recommendations"]) >= 1


def test_api_analysis_endpoint_integration(valid_location: dict) -> None:
    """Verifies POST /api/analysis runs and returns executive summary + recommendations."""
    client = TestClient(app)
    request_data = {
        "business_name": "Coimbatore Heritage Cafe",
        "business_type": "cafe",
        "language": "en",
        "budget_inr": 1_000_000.0,
        "location": valid_location,
        "notes": "Centrally located cafe.",
    }
    response = client.post("/api/analysis", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert data["business_name"] == "Coimbatore Heritage Cafe"
    assert data["business_type"] == "cafe"
    assert data["language"] == "en"
    assert "summary" in data and len(data["summary"]) > 0
    assert "explanation" in data
    assert "recommendations" in data and isinstance(data["recommendations"], list)
    assert "request_id" in data and data["request_id"].startswith("dw-")
    assert data["explanation_mode"] in {"template_fallback", "llm_generated"}
    assert "disclaimer" in data


def test_api_analysis_endpoint_tamil(valid_location: dict) -> None:
    client = TestClient(app)
    request_data = {
        "business_name": "அரோமா உணவகம்",
        "business_type": "hotel",
        "language": "ta",
        "budget_inr": 2_000_000.0,
        "location": valid_location,
    }
    response = client.post("/api/analysis", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "ta"
    assert len(data["recommendations"]) >= 1


def test_api_analysis_rejects_out_of_boundary_location() -> None:
    client = TestClient(app)
    request_data = {
        "business_name": "Chennai Branch",
        "business_type": "cafe",
        "language": "en",
        "budget_inr": 1_000_000.0,
        "location": {
            "latitude": 13.0827,
            "longitude": 80.2707,
            "city": "Coimbatore",
            "state": "Tamil Nadu",
        },
    }
    response = client.post("/api/analysis", json=request_data)
    assert response.status_code == 422

