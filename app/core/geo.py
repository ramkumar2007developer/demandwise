"""Geographic utilities and boundary checks for DemandWise (Coimbatore, Tamil Nadu).

Spatial Service Distinction:
----------------------------
1. Map Tiles (Display Layer):
   Rendered 256x256 raster or vector tiles (e.g., OpenStreetMap standard Carto
   tiles at `https://tile.openstreetmap.org/{z}/{x}/{y}.png`). Used strictly for
   visual map rendering in map components (Leaflet, MapLibre). Map tiles do NOT
   provide structured search or competitor lists.

2. Geocoding (Address <-> Coordinate Layer):
   Translating text addresses to latitude/longitude coordinates (forward) or
   coordinates to formatted addresses (reverse) using services like Nominatim
   (`https://nominatim.openstreetmap.org/search`).

3. Place Search (Spatial POI Layer):
   Querying structured points-of-interest (POI) features (e.g., cafes, hotels,
   retail shops) around a target coordinate or within a bounding box using
   OpenStreetMap tag queries via Overpass API (`https://overpass-api.de/api/interpreter`).
   This is the service type implemented in Phase 3 for competitor retrieval.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.config import Settings


# Earth radius in kilometers (WGS-84 mean radius)
EARTH_RADIUS_KM = 6371.0


def is_within_coimbatore(latitude: float, longitude: float, settings: Settings | None = None) -> bool:
    """Return True if coordinates fall inside the configured Coimbatore bounding box."""
    from app.config import get_settings

    bounds = (settings or get_settings()).geo_bounds
    return (
        bounds["min_lat"] <= latitude <= bounds["max_lat"]
        and bounds["min_lng"] <= longitude <= bounds["max_lng"]
    )


def location_error_message(settings: Settings | None = None) -> str:
    """Return a descriptive error message when coordinates are outside the Coimbatore boundary."""
    from app.config import get_settings

    cfg = settings or get_settings()
    bounds = cfg.geo_bounds
    return (
        f"Location must be inside the approximate {cfg.region_name}, {cfg.region_state} boundary "
        f"(lat {bounds['min_lat']} to {bounds['max_lat']}, "
        f"lng {bounds['min_lng']} to {bounds['max_lng']})."
    )


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two geographic points in kilometers.

    Uses the Haversine formula assuming a spherical Earth of radius 6371.0 km.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    # Clamp to avoid floating point precision edge cases slightly exceeding 1.0
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(EARTH_RADIUS_KM * c, 4)
