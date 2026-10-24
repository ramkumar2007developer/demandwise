from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["app_name"]
    assert payload["version"]
    assert payload["environment"]


def test_unknown_route_returns_structured_error(client: TestClient) -> None:
    response = client.get("/api/missing")
    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "http_error"
    assert "message" in payload["error"]
