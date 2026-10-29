"""Tests for Phase 3 external competitor search service and /api/competitors endpoint.

Verifies:
- Geographic boundary enforcement before making external calls.
- Overpass QL query construction for cafe, hotel, retail.
- Result parsing, distance calculation, deduplication, and sorting.
- Error handling: timeouts, rate limits (429), HTTP errors, and malformed JSON.
- Zero fabrication rule: honest reporting when no POIs exist.
- HTTP API contract and structured response validation.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.services.competitors import (
    CompetitorBoundaryError,
    CompetitorServiceError,
    CompetitorServiceRateLimitError,
    CompetitorServiceTimeoutError,
    build_overpass_query,
    search_competitors,
)

# Coordinates inside Coimbatore
COIMBATORE_LAT = 11.0168
COIMBATORE_LNG = 76.9558

# Coordinates outside Coimbatore (Chennai)
CHENNAI_LAT = 13.0827
CHENNAI_LNG = 80.2707


# Sample mock Overpass JSON response
MOCK_OVERPASS_ELEMENTS = {
    "version": 0.6,
    "elements": [
        {
            "type": "node",
            "id": 1001,
            "lat": 11.0180,
            "lon": 76.9570,
            "tags": {
                "name": "Coimbatore Coffee Roasters",
                "amenity": "cafe",
                "addr:street": "DB Road",
                "addr:suburb": "RS Puram",
                "brand": "Coffee Roasters",
            },
        },
        {
            "type": "node",
            "id": 1002,
            "lat": 11.0250,
            "lon": 76.9650,
            "tags": {
                "name": "Chai Point",
                "amenity": "cafe",
                "addr:street": "Cross Cut Road",
            },
        },
        # Duplicate of 1001 by OSM ID
        {
            "type": "node",
            "id": 1001,
            "lat": 11.0180,
            "lon": 76.9570,
            "tags": {"name": "Coimbatore Coffee Roasters (Duplicate)"},
        },
        # Duplicate by name and close coordinates
        {
            "type": "node",
            "id": 1003,
            "lat": 11.01802,
            "lon": 76.95701,
            "tags": {"name": "Coimbatore Coffee Roasters"},
        },
        # Way element with center coordinates
        {
            "type": "way",
            "id": 2001,
            "center": {"lat": 11.0195, "lon": 76.9585},
            "tags": {
                "name": "Filter Kaapi Corner",
                "amenity": "cafe",
            },
        },
        # Unnamed element (should be filtered out)
        {
            "type": "node",
            "id": 3001,
            "lat": 11.0200,
            "lon": 76.9600,
            "tags": {"amenity": "cafe"},
        },
        # Element without coordinates (should be safely skipped)
        {
            "type": "node",
            "id": 4001,
            "tags": {"name": "Ghost Cafe", "amenity": "cafe"},
        },
    ],
}


def _mock_httpx_client(json_data: dict, status_code: int = 200) -> httpx.Client:
    """Create a mock httpx.Client returning a specific JSON response."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=status_code, json=json_data, request=request)

    transport = httpx.MockTransport(handler)
    return httpx.Client(transport=transport)


# ---------------------------------------------------------------------------
# Unit Tests: Boundary & Query Building
# ---------------------------------------------------------------------------

def test_search_rejects_out_of_boundary_coordinates() -> None:
    """Out-of-boundary coordinates must raise CompetitorBoundaryError without calling external APIs."""
    with pytest.raises(CompetitorBoundaryError, match="Location must be inside"):
        search_competitors(CHENNAI_LAT, CHENNAI_LNG, "cafe")


def test_build_overpass_query_contains_coordinates_and_tags() -> None:
    query = build_overpass_query(
        latitude=11.0168,
        longitude=76.9558,
        radius_meters=1500,
        business_type="cafe",
        timeout_seconds=8,
    )
    assert "around:1500,11.0168,76.9558" in query
    assert 'amenity"="cafe' in query
    assert "[timeout:8]" in query
    assert "out center;" in query


def test_build_overpass_query_supports_hotel_and_retail() -> None:
    hotel_query = build_overpass_query(11.01, 76.95, 2000, "hotel")
    assert 'amenity"="restaurant' in hotel_query
    assert 'tourism"="hotel' in hotel_query

    retail_query = build_overpass_query(11.01, 76.95, 2000, "retail")
    assert 'shop"' in retail_query


# ---------------------------------------------------------------------------
# Unit Tests: Result Parsing, Deduplication & Distance
# ---------------------------------------------------------------------------

def test_search_competitors_parses_and_deduplicates() -> None:
    client = _mock_httpx_client(MOCK_OVERPASS_ELEMENTS)
    result = search_competitors(
        latitude=COIMBATORE_LAT,
        longitude=COIMBATORE_LNG,
        business_type="cafe",
        http_client=client,
    )
    assert result.provider == "openstreetmap_overpass"
    assert result.service_type == "place_search"
    assert result.total_found == 3  # 1001, 1002, 2001 (duplicates and unnamed filtered)
    assert len(result.competitors) == 3

    # Verify deduplication
    ids = [c.osm_id for c in result.competitors]
    assert len(ids) == len(set(ids))

    # Verify sorting by distance ascending
    distances = [c.distance_km for c in result.competitors]
    assert distances == sorted(distances)

    # First item should be the closest
    closest = result.competitors[0]
    assert closest.name == "Coimbatore Coffee Roasters"
    assert closest.street == "DB Road"
    assert "RS Puram" in (closest.address or "")
    assert closest.distance_km > 0.0


def test_search_competitors_honestly_reports_zero_found() -> None:
    """Never fabricate competitor records or counts when OSM returns empty elements."""
    empty_payload = {"version": 0.6, "elements": []}
    client = _mock_httpx_client(empty_payload)
    result = search_competitors(
        latitude=COIMBATORE_LAT,
        longitude=COIMBATORE_LNG,
        business_type="cafe",
        http_client=client,
    )
    assert result.total_found == 0
    assert result.competitors == []
    assert result.status == "empty"
    assert result.note is not None


# ---------------------------------------------------------------------------
# Unit Tests: Error Handling
# ---------------------------------------------------------------------------

def test_search_competitors_handles_rate_limit_429() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=429, text="Too Many Requests", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(CompetitorServiceRateLimitError, match="rate limit exceeded"):
        search_competitors(COIMBATORE_LAT, COIMBATORE_LNG, "cafe", http_client=client)


def test_search_competitors_handles_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("Read timed out")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(CompetitorServiceTimeoutError, match="timed out"):
        search_competitors(COIMBATORE_LAT, COIMBATORE_LNG, "cafe", http_client=client)


def test_search_competitors_handles_http_500() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=500, text="Internal Server Error", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(CompetitorServiceError, match="HTTP 500"):
        search_competitors(COIMBATORE_LAT, COIMBATORE_LNG, "cafe", http_client=client)


def test_search_competitors_handles_malformed_json() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=200, text="NOT_JSON_BODY", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(CompetitorServiceError, match="Invalid JSON"):
        search_competitors(COIMBATORE_LAT, COIMBATORE_LNG, "cafe", http_client=client)


# ---------------------------------------------------------------------------
# API Tests: POST /api/competitors
# ---------------------------------------------------------------------------

def test_api_competitors_success() -> None:
    client = TestClient(app)
    mock_search = MagicMock()
    mock_search.return_value = search_competitors(
        COIMBATORE_LAT,
        COIMBATORE_LNG,
        "cafe",
        http_client=_mock_httpx_client(MOCK_OVERPASS_ELEMENTS),
    )

    with patch("app.services.competitors.search_competitors", mock_search):
        response = client.post(
            "/api/competitors",
            json={
                "business_type": "cafe",
                "latitude": COIMBATORE_LAT,
                "longitude": COIMBATORE_LNG,
                "radius_meters": 2000,
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "openstreetmap_overpass"
    assert data["service_type"] == "place_search"
    assert data["total_found"] == 3
    assert len(data["competitors"]) == 3
    assert "retrieval_timestamp" in data


def test_api_competitors_rejects_out_of_boundary() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/competitors",
        json={
            "business_type": "cafe",
            "latitude": CHENNAI_LAT,
            "longitude": CHENNAI_LNG,
        },
    )
    assert response.status_code == 422
    err = response.json()
    assert "error" in err


def test_api_competitors_returns_504_on_timeout() -> None:
    client = TestClient(app)
    with patch(
        "app.services.competitors.search_competitors",
        side_effect=CompetitorServiceTimeoutError("Timed out"),
    ):
        response = client.post(
            "/api/competitors",
            json={
                "business_type": "cafe",
                "latitude": COIMBATORE_LAT,
                "longitude": COIMBATORE_LNG,
            },
        )
    assert response.status_code == 504


def test_api_competitors_returns_429_on_rate_limit() -> None:
    client = TestClient(app)
    with patch(
        "app.services.competitors.search_competitors",
        side_effect=CompetitorServiceRateLimitError("Rate limit exceeded"),
    ):
        response = client.post(
            "/api/competitors",
            json={
                "business_type": "cafe",
                "latitude": COIMBATORE_LAT,
                "longitude": COIMBATORE_LNG,
            },
        )
    assert response.status_code == 429


def test_api_competitors_returns_502_on_provider_error() -> None:
    client = TestClient(app)
    with patch(
        "app.services.competitors.search_competitors",
        side_effect=CompetitorServiceError("Overpass HTTP 500 error"),
    ):
        response = client.post(
            "/api/competitors",
            json={
                "business_type": "cafe",
                "latitude": COIMBATORE_LAT,
                "longitude": COIMBATORE_LNG,
            },
        )
    assert response.status_code == 502


def test_normalize_business_category_aliases() -> None:
    from app.services.competitors import normalize_business_category

    assert normalize_business_category("hotel") == "hotel"
    assert normalize_business_category("HOTEL") == "hotel"
    assert normalize_business_category("hotel/small_restaurant") == "hotel"
    assert normalize_business_category("restaurant") == "hotel"
    assert normalize_business_category("lodging") == "hotel"
    assert normalize_business_category("cafe") == "cafe"
    assert normalize_business_category("coffee_shop") == "cafe"
    assert normalize_business_category("retail") == "retail"
    assert normalize_business_category("shop") == "retail"


def test_build_overpass_query_normalizes_hotel_alias() -> None:
    hotel_alias_query = build_overpass_query(COIMBATORE_LAT, COIMBATORE_LNG, 2000, "hotel/small_restaurant")
    assert 'tourism"="hotel' in hotel_alias_query
    assert 'amenity"="restaurant' in hotel_alias_query


def test_competitor_preview_contains_coordinates() -> None:
    from app.schemas.analysis import CompetitorPreview

    preview = CompetitorPreview(
        name="Taj Surya",
        category="hotel",
        distance_km=0.85,
        latitude=11.0180,
        longitude=76.9570,
        osm_id=12345,
        street="Race Course Road",
    )
    assert preview.latitude == 11.0180
    assert preview.longitude == 76.9570
    assert preview.osm_id == 12345
    assert preview.street == "Race Course Road"


# ---------------------------------------------------------------------------
# Unit Tests: Caching Behaviour
# ---------------------------------------------------------------------------

def test_empty_result_is_not_cached_allowing_retry() -> None:
    """Empty Overpass responses must NOT be cached so a later retry can find real competitors.

    Guards against: transient mirror glitch returns empty elements list, gets cached 5 min,
    blocks real results on retry.
    """
    from app.services.competitors import _COMPETITOR_CACHE

    empty_payload = {"version": 0.6, "elements": []}
    lat, lng = 11.05, 76.97
    cache_key = (round(lat, 3), round(lng, 3), 2000, "cafe")
    _COMPETITOR_CACHE.pop(cache_key, None)

    client = _mock_httpx_client(empty_payload)
    result = search_competitors(
        latitude=lat,
        longitude=lng,
        business_type="cafe",
        http_client=client,
    )
    assert result.total_found == 0
    assert result.status == "empty"
    assert cache_key not in _COMPETITOR_CACHE, (
        "Empty results must not be cached; a retry should be allowed to find real competitors."
    )


def test_successful_result_with_competitors_is_cached() -> None:
    """Results with real competitors must be cached to prevent redundant Overpass requests.

    Caching only occurs in the production path (no injected http_client).
    Use a mocked httpx.Client to verify the production path writes to cache.
    """
    from unittest.mock import patch
    from app.services.competitors import _COMPETITOR_CACHE

    lat, lng = 11.07, 76.99  # unique coords not used by any other test
    cache_key = (round(lat, 3), round(lng, 3), 2000, "cafe")
    _COMPETITOR_CACHE.pop(cache_key, None)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=200, json=MOCK_OVERPASS_ELEMENTS, request=request)

    class MockedClient(httpx.Client):
        def __init__(self, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(**kwargs)

    settings = Settings(
        overpass_api_url="https://cache-test-mirror.example.com/api/interpreter",
        overpass_fallback_urls="",
        competitor_search_timeout_seconds=10.0,
        competitor_search_radius_meters=2000,
    )

    with patch("app.services.competitors.httpx.Client", MockedClient):
        result = search_competitors(
            latitude=lat,
            longitude=lng,
            business_type="cafe",
            settings=settings,
        )

    assert result.total_found > 0
    assert cache_key in _COMPETITOR_CACHE, (
        "Non-empty successful results must be cached to prevent redundant Overpass requests."
    )


# ---------------------------------------------------------------------------
# Unit Tests: HTTP Error Variants (502, 503, 504) and non-JSON responses
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("status_code", [502, 503, 504])
def test_search_competitors_handles_gateway_errors(status_code: int) -> None:
    """HTTP 502/503/504 from an injected mock client must raise CompetitorServiceError."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=status_code, text="Gateway Error", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(CompetitorServiceError):
        search_competitors(COIMBATORE_LAT, COIMBATORE_LNG, "cafe", http_client=client)


def test_search_competitors_handles_html_response_from_mirror() -> None:
    """Some Overpass mirrors return HTML error pages on failures; must raise CompetitorServiceError."""
    def handler(request: httpx.Request) -> httpx.Response:
        html = "<html><body><h1>Service Unavailable</h1></body></html>"
        return httpx.Response(status_code=200, text=html, request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(CompetitorServiceError, match="Invalid JSON"):
        search_competitors(COIMBATORE_LAT, COIMBATORE_LNG, "cafe", http_client=client)


def test_search_competitors_rate_limit_includes_retry_after() -> None:
    """HTTP 429 with Retry-After header must raise CompetitorServiceRateLimitError."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=429,
            text="Too Many Requests",
            headers={"Retry-After": "60"},
            request=request,
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(CompetitorServiceRateLimitError, match="rate limit exceeded"):
        search_competitors(COIMBATORE_LAT, COIMBATORE_LNG, "cafe", http_client=client)


# ---------------------------------------------------------------------------
# Unit Tests: Production Mirror Failover (mocked httpx.Client via patch)
# ---------------------------------------------------------------------------

def test_production_mirrors_failover_on_first_mirror_timeout() -> None:
    """When the first mirror times out and the second succeeds, results should be returned."""
    from unittest.mock import patch

    from app.services.competitors import _COMPETITOR_CACHE
    _COMPETITOR_CACHE.clear()

    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise httpx.TimeoutException("First mirror timed out")
        return httpx.Response(status_code=200, json=MOCK_OVERPASS_ELEMENTS, request=request)

    class MockedClient(httpx.Client):
        def __init__(self, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(**kwargs)

    settings = Settings(
        overpass_api_url="https://mirror1.example.com/api/interpreter",
        overpass_fallback_urls="https://mirror2.example.com/api/interpreter",
        competitor_search_timeout_seconds=10.0,
        competitor_search_radius_meters=2000,
    )

    with patch("app.services.competitors.httpx.Client", MockedClient):
        result = search_competitors(
            latitude=COIMBATORE_LAT,
            longitude=COIMBATORE_LNG,
            business_type="cafe",
            settings=settings,
        )

    assert result.total_found == 3
    assert call_count["n"] == 2


def test_production_mirrors_all_fail_raises_service_error() -> None:
    """When all mirrors fail, a CompetitorServiceError or timeout variant must be raised.

    Uses unique coordinates to avoid hitting the in-memory TTL cache from earlier tests.
    """
    from unittest.mock import patch
    from app.services.competitors import _COMPETITOR_CACHE

    # Unique coords not used by any other test to avoid cache hits
    lat, lng = 11.08, 76.91
    cache_key = (round(lat, 3), round(lng, 3), 2000, "cafe")
    _COMPETITOR_CACHE.pop(cache_key, None)

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("Mirror timed out")

    class MockedClient(httpx.Client):
        def __init__(self, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(**kwargs)

    settings = Settings(
        overpass_api_url="https://mirror1.example.com/api/interpreter",
        overpass_fallback_urls="https://mirror2.example.com/api/interpreter",
        competitor_search_timeout_seconds=10.0,
        competitor_search_radius_meters=2000,
    )

    with patch("app.services.competitors.httpx.Client", MockedClient):
        with pytest.raises((CompetitorServiceError, CompetitorServiceTimeoutError)):
            search_competitors(
                latitude=lat,
                longitude=lng,
                business_type="cafe",
                settings=settings,
            )


def test_production_mirrors_502_skips_to_next_mirror() -> None:
    """HTTP 502 from the first mirror must cause failover to the next mirror.

    Uses unique coordinates to avoid hitting the in-memory TTL cache from earlier tests.
    """
    from unittest.mock import patch
    from app.services.competitors import _COMPETITOR_CACHE

    # Unique coords not used by any other test to avoid cache hits
    lat, lng = 11.09, 76.92
    cache_key = (round(lat, 3), round(lng, 3), 2000, "cafe")
    _COMPETITOR_CACHE.pop(cache_key, None)

    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        if call_count["n"] == 1:
            return httpx.Response(status_code=502, text="Bad Gateway", request=request)
        return httpx.Response(status_code=200, json=MOCK_OVERPASS_ELEMENTS, request=request)

    class MockedClient(httpx.Client):
        def __init__(self, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(**kwargs)

    settings = Settings(
        overpass_api_url="https://mirror1.example.com/api/interpreter",
        overpass_fallback_urls="https://mirror2.example.com/api/interpreter",
        competitor_search_timeout_seconds=10.0,
        competitor_search_radius_meters=2000,
    )

    with patch("app.services.competitors.httpx.Client", MockedClient):
        result = search_competitors(
            latitude=lat,
            longitude=lng,
            business_type="cafe",
            settings=settings,
        )

    assert result.total_found == 3
    assert call_count["n"] == 2

