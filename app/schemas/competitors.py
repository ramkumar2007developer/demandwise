"""Schemas for Phase 3 external competitor search and retrieval.

Spatial Service Distinction:
- Map Tiles: Image rendering service (e.g., raster/vector tiles for UI map canvas).
- Geocoding: Forward/reverse address-to-coordinate conversion (e.g., Nominatim).
- Place Search: Structured POI geospatial proximity queries (e.g., Overpass API).
This module defines the models for the Place Search service.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.config import get_settings
from app.core.geo import is_within_coimbatore, location_error_message


class CompetitorItem(BaseModel):
    """Structured details for a single nearby competitor retrieved from OpenStreetMap."""

    name: str = Field(..., description="Business or venue name.")
    category: str = Field(..., description="Normalized category (cafe, hotel, retail).")
    osm_type: str = Field(default="node", description="OSM element type (node, way, relation).")
    osm_id: int = Field(..., description="OpenStreetMap element ID.")
    latitude: float = Field(..., description="Latitude of the competitor.")
    longitude: float = Field(..., description="Longitude of the competitor.")
    distance_km: float = Field(..., description="Calculated Haversine distance in km from search center.")
    address: str | None = Field(default=None, description="Formatted address if tags available.")
    street: str | None = Field(default=None, description="Street name if tag available.")
    brand: str | None = Field(default=None, description="Brand name if tag available.")


class CompetitorSearchRequest(BaseModel):
    """Input request for searching nearby competitors in Coimbatore."""

    model_config = ConfigDict(str_strip_whitespace=True)

    business_type: str = Field(
        ...,
        description="One of: cafe, hotel, retail (aliases like 'coffee_shop', 'restaurant' accepted).",
        examples=["cafe"],
    )
    latitude: float = Field(
        ...,
        ge=-90,
        le=90,
        description="Search center latitude (must be within Coimbatore bounds).",
        examples=[11.0168],
    )
    longitude: float = Field(
        ...,
        ge=-180,
        le=180,
        description="Search center longitude (must be within Coimbatore bounds).",
        examples=[76.9558],
    )
    radius_meters: int | None = Field(
        default=None,
        ge=100,
        le=10000,
        description="Search radius in meters (default from configuration, typically 2000m).",
        examples=[2000],
    )

    @model_validator(mode="after")
    def coordinates_must_be_in_coimbatore(self) -> "CompetitorSearchRequest":
        settings = get_settings()
        if not is_within_coimbatore(self.latitude, self.longitude, settings):
            raise ValueError(location_error_message(settings))
        return self


class CompetitorSearchResponse(BaseModel):
    """Output response containing verified nearby competitors from OpenStreetMap.

    Never fabricates competitor records or counts. If none are found, total_found is 0.
    """

    provider: str = Field(
        ...,
        description="Data provider identifier (e.g., 'openstreetmap_overpass').",
        examples=["openstreetmap_overpass"],
    )
    service_type: str = Field(
        default="place_search",
        description="Service type distinguishing Place Search from Map Tiles and Geocoding.",
    )
    retrieval_timestamp: str = Field(
        ...,
        description="ISO 8601 UTC timestamp of when data was retrieved from the provider.",
    )
    search_center: dict[str, float] = Field(
        ...,
        description="Coordinates of the search origin {'latitude': float, 'longitude': float}.",
    )
    search_radius_meters: int = Field(
        ...,
        description="Effective radius searched in meters.",
    )
    business_type: str = Field(
        ...,
        description="Requested business category.",
    )
    total_found: int = Field(
        ...,
        description="Exact count of deduplicated real competitors returned (never fabricated).",
    )
    competitors: list[CompetitorItem] = Field(
        default_factory=list,
        description="Deduplicated list of competitors sorted by distance ascending.",
    )
    status: str = Field(
        default="success",
        description="Query status: 'success', 'empty', or 'degraded'.",
    )
    note: str | None = Field(
        default=None,
        description="Operational note (e.g. rate limit retry, empty result clarification).",
    )
