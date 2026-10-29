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


import time

# In-memory TTL cache: (rounded_lat, rounded_lng, radius, category) -> (CompetitorSearchResponse, timestamp)
# Only successful results with competitors are cached; empty/error results are intentionally NOT cached
# so transient mirror failures do not block real results from being found on retry.
_COMPETITOR_CACHE: dict[tuple, tuple[CompetitorSearchResponse, float]] = {}
_COMPETITOR_CACHE_TTL_SEC: float = 300.0  # 5 minutes cache to prevent redundant Overpass requests

# Separate connect timeout (TCP handshake) from read timeout (Overpass query processing).
# A slow mirror's handshake must not consume the entire budget allocated for the Overpass query.
_CONNECT_TIMEOUT_SEC: float = 5.0

# Total wall-clock deadline for the entire mirror sweep.
# Prevents multi-mirror failures from blocking the backend for minutes.
# Set to slightly more than the per-mirror read timeout to allow at least one full attempt.
_TOTAL_SWEEP_DEADLINE_SEC: float = 35.0


def normalize_business_category(business_type: str) -> str:
    """Normalize user or form business type into standard 'cafe', 'hotel', or 'retail'."""
    cleaned = business_type.lower().strip().replace(" ", "_").replace("-", "_")
    aliases = {
        "cafe": "cafe",
        "café": "cafe",
        "coffee_shop": "cafe",
        "coffee": "cafe",
        "tea": "cafe",
        "hotel": "hotel",
        "hotel/small_restaurant": "hotel",
        "hotel_small_restaurant": "hotel",
        "restaurant": "hotel",
        "small_restaurant": "hotel",
        "lodging": "hotel",
        "guest_house": "hotel",
        "retail": "retail",
        "retail_shop": "retail",
        "shop": "retail",
        "store": "retail",
    }
    return aliases.get(cleaned, "cafe")


# OpenStreetMap tag definitions per category
OSM_TAG_QUERIES: dict[str, list[str]] = {
    "cafe": [
        'node["amenity"="cafe"]',
        'node["amenity"="coffee_shop"]',
        'node["amenity"="tea"]',
        'way["amenity"="cafe"]',
    ],
    "hotel": [
        'node["tourism"="hotel"]',
        'node["tourism"="guest_house"]',
        'node["tourism"="motel"]',
        'node["tourism"="hostel"]',
        'node["tourism"="lodging"]',
        'node["amenity"="restaurant"]',
        'way["tourism"="hotel"]',
        'way["amenity"="restaurant"]',
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
    timeout_seconds: int = 15,
) -> str:
    """Build an Overpass QL query around a coordinate for the specified business type."""
    normalized_type = normalize_business_category(business_type)
    clauses = OSM_TAG_QUERIES.get(normalized_type) or OSM_TAG_QUERIES["cafe"]

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
        val = tags.get(key)
        if val and isinstance(val, str) and val.strip():
            parts.append(val.strip())
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
    norm_type = normalize_business_category(business_type)

    # In-memory TTL Cache check (only for live client calls without injected mock client)
    cache_key = (round(latitude, 3), round(longitude, 3), effective_radius, norm_type)
    now = time.time()
    if http_client is None and cache_key in _COMPETITOR_CACHE:
        cached_resp, cached_time = _COMPETITOR_CACHE[cache_key]
        if now - cached_time < _COMPETITOR_CACHE_TTL_SEC:
            logger.info("Returning cached competitor search for %s at (%.4f, %.4f)", norm_type, latitude, longitude)
            return cached_resp

    # 2. Build Overpass Query
    query = build_overpass_query(
        latitude=latitude,
        longitude=longitude,
        radius_meters=effective_radius,
        business_type=norm_type,
        timeout_seconds=int(timeout_sec),
    )

    # 3. Execute HTTP Place Search with robust error handling & multi-mirror failover
    retrieval_timestamp = datetime.now(timezone.utc).isoformat()
    raw_json: dict[str, Any] | None = None

    if http_client is not None:
        # Injected client (used by unit tests)
        try:
            response = http_client.post(
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
    else:
        # Production failover across configured mirrors
        mirrors = cfg.overpass_mirror_list
        last_exception: Exception | None = None
        sweep_start = time.monotonic()

        for mirror_url in mirrors:
            # Check if we have enough remaining time budget to attempt this mirror.
            elapsed_sweep = time.monotonic() - sweep_start
            remaining_sec = _TOTAL_SWEEP_DEADLINE_SEC - elapsed_sweep
            if remaining_sec < 2.0:
                # Insufficient time left to make a meaningful attempt — stop here.
                logger.warning(
                    "Overpass mirror sweep deadline reached after %.1fs, skipping remaining mirrors.",
                    elapsed_sweep,
                )
                if last_exception is None:
                    last_exception = CompetitorServiceTimeoutError(
                        f"Competitor search timed out after {elapsed_sweep:.0f}s across all mirrors."
                    )
                break

            # Clamp per-mirror timeouts to the remaining wall-clock budget.
            per_mirror_connect = min(_CONNECT_TIMEOUT_SEC, remaining_sec)
            per_mirror_read = min(timeout_sec, remaining_sec)

            # Use separate connect and read timeouts.
            # connect_timeout: max time to establish TCP connection to the mirror.
            # read timeout: max time to receive the full Overpass query response.
            # This prevents a slow handshake from consuming the entire query budget.
            client = httpx.Client(
                timeout=httpx.Timeout(
                    connect=per_mirror_connect,
                    read=per_mirror_read,
                    write=10.0,
                    pool=5.0,
                )
            )
            try:
                response = client.post(
                    mirror_url,
                    data={"data": query},
                    headers={"User-Agent": user_agent, "Accept": "application/json"},
                )
                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After", "")
                    retry_msg = f" Retry after {retry_after}s." if retry_after else ""
                    logger.warning(
                        "Overpass mirror %s returned HTTP 429 rate limit.%s",
                        mirror_url, retry_msg,
                    )
                    last_exception = CompetitorServiceRateLimitError(
                        f"OpenStreetMap Overpass service rate limit exceeded (HTTP 429).{retry_msg} Please retry shortly."
                    )
                    continue
                if response.status_code in (502, 503, 504):
                    logger.warning(
                        "Overpass mirror %s returned HTTP %s, trying next mirror",
                        mirror_url, response.status_code,
                    )
                    last_exception = CompetitorServiceError(
                        f"Competitor search provider returned HTTP {response.status_code}."
                    )
                    continue
                response.raise_for_status()
                # Attempt JSON decode; some mirrors send HTML on unexpected errors
                try:
                    raw_json = response.json()
                except Exception:
                    body_preview = response.text[:200] if response.text else "(empty)"
                    logger.warning(
                        "Overpass mirror %s returned non-JSON response (status %s). Preview: %s",
                        mirror_url, response.status_code, body_preview,
                    )
                    last_exception = CompetitorServiceError(
                        f"Invalid JSON received from competitor search provider ({mirror_url})."
                    )
                    continue
                logger.info("Successfully fetched competitor data from %s", mirror_url)
                break
            except (httpx.TimeoutException, CompetitorServiceTimeoutError) as exc:
                logger.warning(
                    "Overpass mirror %s timed out after %s seconds, trying next mirror",
                    mirror_url, timeout_sec,
                )
                last_exception = CompetitorServiceTimeoutError(
                    f"Competitor search service timed out after {timeout_sec:g}s. Overpass server may be busy."
                )
                continue
            except CompetitorServiceRateLimitError as exc:
                last_exception = exc
                continue
            except httpx.HTTPStatusError as exc:
                logger.warning("Overpass mirror %s returned HTTP %s", mirror_url, exc.response.status_code)
                last_exception = CompetitorServiceError(
                    f"Competitor search provider returned HTTP {exc.response.status_code}."
                )
                continue
            except (httpx.RequestError, Exception) as exc:
                logger.warning("Overpass mirror %s connection error: %s", mirror_url, exc)
                last_exception = CompetitorServiceError(
                    f"Failed to connect to competitor search provider ({mirror_url}): {exc}"
                )
                continue
            finally:
                client.close()

        if raw_json is None:
            if last_exception:
                raise last_exception
            raise CompetitorServiceError("Unable to reach OpenStreetMap Overpass servers. Please try again.")

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

    result = CompetitorSearchResponse(
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

    # Cache ONLY successful results that found at least one competitor.
    # Intentionally do NOT cache empty results: an empty response may be from a
    # glitching mirror or a temporarily incomplete Overpass dataset. Caching zeros
    # would prevent users from finding real competitors on a retry.
    if http_client is None and total_found > 0:
        _COMPETITOR_CACHE[cache_key] = (result, time.time())
        logger.debug(
            "Cached %d competitor(s) for key %s", total_found, cache_key
        )

    return result
