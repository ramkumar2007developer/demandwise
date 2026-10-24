from fastapi.testclient import TestClient


def test_config_exposes_supported_values(client: TestClient) -> None:
    response = client.get("/api/config")
    assert response.status_code == 200
    payload = response.json()
    assert payload["region"] == "Coimbatore"
    assert payload["state"] == "Tamil Nadu"
    assert payload["supported_business_types"] == ["cafe", "hotel", "retail"]
    assert payload["supported_languages"] == ["en", "ta"]
    assert payload["default_language"] == "en"
    bounds = payload["geo_bounds"]
    assert bounds["min_lat"] < bounds["max_lat"]
    assert bounds["min_lng"] < bounds["max_lng"]
    assert "http://localhost:5173" in payload["cors_origins"]


def test_cors_preflight_allows_local_origin(client: TestClient) -> None:
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code in {200, 204}
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_config_never_exposes_llm_api_key(client: TestClient) -> None:
    response = client.get("/api/config")
    assert response.status_code == 200
    payload = response.json()
    assert "llm_api_key" not in payload
    assert "api_key" not in payload
