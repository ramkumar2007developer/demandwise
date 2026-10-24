"""Competitor search service using OpenStreetMap Overpass API for Coimbatore.

Spatial Service Architecture Distinction:
-----------------------------------------
- Map Tiles: Image rendering service providing 256x256 pixel raster/vector tiles
  (e.g., `https://tile.openstreetmap.org/{z}/{x}/{y}.png`) to render a visual map
  canvas in a UI (Leaflet, Mapbox, MapLibre). Map tiles do NOT provide structured
  search, POI attributes, or competitor listings.
- Geocoding: Forward and reverse textual address-to-coordinate lookup (e.g., Nominatim).
- Place Search: Structured geospatial queries for points-of-interest (POI) based on
  tags, category filters, and spatial proximity around a coordinate or within a boundary.
  This service implements Place Search via the Overpass API (`interpreter` endpoint).

Strict Data Integrity:
- Real data only from the external provider.
- Never fabricates competitor records, counts, or simulated names.
- Zero results are reported honestly as zero results.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.core.geo import haversine_distance_km, is_within_coimbatore, location_error_message
from app.schemas.competitors import CompetitorItem, CompetitorSearchResponse

logger = logging.getLogger(__name__)


class CompetitorServiceError(Exception):
    """Base exception for competitor service failures."""


class CompetitorServiceTimeoutError(CompetitorServiceError):
    """Raised when external OSM service times out."""


class CompetitorServiceRateLimitError(CompetitorServiceError):
    """Raised when external OSM service rate-limits the query (HTTP 429)."""


class CompetitorBoundaryError(CompetitorServiceError, ValueError):
    """Raised when search coordinates fall outside the Coimbatore service boundary."""


# OpenStreetMap tag definitions per category
OSM_TAG_QUERIES: dict[str, list[str]] = {
    "cafe": [
        'node["amenity"="cafe"]',
        'node["amenity"="coffee_shop"]',
        'way["amenity"="cafe"]',
    ],
    "hotel": [
        'node["amenity"="restaurant"]',
        'node["amenity"="fast_food"]',
        'node["tourism"="hotel"]',
        'node["tourism"="guest_house"]',
        'way["amenity"="restaurant"]',
        'way["tourism"="hotel"]',
    ],
    "retail": [
        'node["shop"]',
        'way["shop"]',
    ],
}


def build_overpass_query(
    latitude: float,
    longitude: float,
    radius_meters: int,
    business_type: str,
    timeout_seconds: int = 10,
) -> str:
    """Build an Overpass QL query around a coordinate for the specified business type."""
    normalized_type = business_type.lower().strip()
    clauses = OSM_TAG_QUERIES.get(normalized_type)
    if not clauses:
        # Default fallback to cafe if unknown
        clauses = OSM_TAG_QUERIES["cafe"]

    filter_blocks = "\n  ".join(f"{clause}(around:{radius_meters},{latitude},{longitude});" for clause in clauses)

    # Overpass QL block requesting center coordinates for ways/nodes with a hard timeout
    query = f"""[out:json][timeout:{timeout_seconds}];
(
  {filter_blocks}
);
out center;"""
    return query


def _extract_name(tags: dict[str, Any]) -> str | None:
    """Extract a meaningful name from OSM tags, prioritizing English or local names."""
    if not tags:
        return None
    for key in ("name", "name:en", "name:ta", "brand", "operator"):
        val = tags.get(key)
        if val and isinstance(val, str) and val.strip():
            return val.strip()
    return None


def _extract_category(tags: dict[str, Any], requested_type: str) -> str:
    """Extract or normalize category string from tags."""
    if not tags:
        return requested_type
    if "amenity" in tags:
        return str(tags["amenity"])
    if "shop" in tags:
        return f"shop:{tags['shop']}"
    if "tourism" in tags:
        return str(tags["tourism"])
    return requested_type


def _extract_address(tags: dict[str, Any]) -> tuple[str | None, str | None]:
    """Extract street and formatted address from OSM tags if present."""
    if not tags:
        return None, None
    street = tags.get("addr:street")
    parts = []
    for key in ("addr:housenumber", "addr:street", "addr:suburb", "addr:city", "addr:postcode"):
        v = tags.get(key)
        if v and isinstance(v, str) and v.strip():
            parts.append(v.strip())
    formatted = ", ".join(parts) if parts else None
    return street, formatted


def search_competitors(
    latitude: float,
    longitude: float,
    business_type: str,
    radius_meters: int | None = None,
    settings: Settings | None = None,
    http_client: httpx.Client | None = None,
) -> CompetitorSearchResponse:
    """Retrieve verified nearby competitors in Coimbatore using OpenStreetMap Overpass API.

    Features:
    - Validates coordinates against Coimbatore service boundary.
    - Queries Overpass API with structured POI tags for cafe, hotel, or retail.
    - Computes exact Haversine distances in km from the search center.
    - Deduplicates identical OSM elements and overlapping names.
    - Records provider ('openstreetmap_overpass'), service_type ('place_search'), and retrieval timestamp.
    - Never fabricates competitor records or counts.
    """
    cfg = settings or get_settings()

    # 1. Geographic Boundary Validation
    if not is_within_coimbatore(latitude, longitude, cfg):
        raise CompetitorBoundaryError(location_error_message(cfg))

    effective_radius = radius_meters or cfg.competitor_search_radius_meters
    timeout_sec = cfg.competitor_search_timeout_seconds
    user_agent = cfg.competitor_user_agent
    api_url = cfg.overpass_api_url
    max_results = cfg.competitor_search_max_results

    # 2. Build Overpass Query
    query = build_overpass_query(
        latitude=latitude,
        longitude=longitude,
        radius_meters=effective_radius,
        business_type=business_type,
        timeout_seconds=int(timeout_sec),
    )

    # 3. Execute HTTP Place Search with robust error handling
    client_provided = http_client is not None
    client = http_client or httpx.Client(timeout=timeout_sec)
    retrieval_timestamp = datetime.now(timezone.utc).isoformat()

    try:
        response = client.post(
            api_url,
            data={"data": query},
            headers={"User-Agent": user_agent, "Accept": "application/json"},
        )
        if response.status_code == 429:
            raise CompetitorServiceRateLimitError(
                "OpenStreetMap Overpass service rate limit exceeded (HTTP 429). Please retry shortly."
            )
        response.raise_for_status()
        raw_json = response.json()
    except httpx.TimeoutException as exc:
        logger.warning("Overpass API request timed out after %s seconds: %s", timeout_sec, exc)
        raise CompetitorServiceTimeoutError(
            f"Competitor search service timed out after {timeout_sec:g}s. Overpass server may be busy."
        ) from exc
    except httpx.HTTPStatusError as exc:
        logger.warning("Overpass API returned HTTP error %s: %s", exc.response.status_code, exc)
        raise CompetitorServiceError(
            f"Competitor search provider returned HTTP {exc.response.status_code}."
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("Overpass API network request error: %s", exc)
        raise CompetitorServiceError(
            f"Failed to connect to competitor search provider: {exc}"
        ) from exc
    except ValueError as exc:
        logger.warning("Failed to decode JSON from Overpass API: %s", exc)
        raise CompetitorServiceError(
            "Invalid JSON received from competitor search provider."
        ) from exc
    finally:
        if not client_provided:
            client.close()

    # 4. Parse, Calculate Distance, Deduplicate
    elements = raw_json.get("elements", [])
    deduped_items: list[CompetitorItem] = []
    seen_osm_ids: set[tuple[str, int]] = set()
    seen_names: set[tuple[str, float, float]] = set()

    for el in elements:
        osm_type = el.get("type", "node")
        osm_id = el.get("id")
        if osm_id is None:
            continue

        # Coordinate resolution: node coordinates vs way/relation center coordinates
        el_lat = el.get("lat") or (el.get("center", {}).get("lat") if isinstance(el.get("center"), dict) else None)
        el_lon = el.get("lon") or (el.get("center", {}).get("lon") if isinstance(el.get("center"), dict) else None)
        if el_lat is None or el_lon is None:
            continue

        tags = el.get("tags") or {}
        name = _extract_name(tags)
        if not name:
            # Skip unnamed POIs to avoid noisy unlabeled points
            continue

        # Deduplication Check 1: By OSM Type and ID
        osm_key = (osm_type, int(osm_id))
        if osm_key in seen_osm_ids:
            continue
        seen_osm_ids.add(osm_key)

        # Deduplication Check 2: By normalized name and approximate coordinates (within ~20m)
        name_key = (name.lower(), round(float(el_lat), 3), round(float(el_lon), 3))
        if name_key in seen_names:
            continue
        seen_names.add(name_key)

        # Calculate exact Haversine distance from search center
        dist_km = haversine_distance_km(latitude, longitude, float(el_lat), float(el_lon))
        street, address = _extract_address(tags)
        category = _extract_category(tags, business_type)
        brand = tags.get("brand")

        item = CompetitorItem(
            name=name,
            category=category,
            osm_type=osm_type,
            osm_id=int(osm_id),
            latitude=float(el_lat),
            longitude=float(el_lon),
            distance_km=dist_km,
            address=address,
            street=street,
            brand=brand,
        )
        deduped_items.append(item)

    # 5. Sort by distance ascending and cap to max_results
    deduped_items.sort(key=lambda x: x.distance_km)
    if len(deduped_items) > max_results:
        deduped_items = deduped_items[:max_results]

    total_found = len(deduped_items)
    status = "success" if total_found > 0 else "empty"
    note = None if total_found > 0 else "No competitors found within the requested radius."

    return CompetitorSearchResponse(
        provider="openstreetmap_overpass",
        service_type="place_search",
        retrieval_timestamp=retrieval_timestamp,
        search_center={"latitude": latitude, "longitude": longitude},
        search_radius_meters=effective_radius,
        business_type=business_type,
        total_found=total_found,
        competitors=deduped_items,
        status=status,
        note=note,
    )
