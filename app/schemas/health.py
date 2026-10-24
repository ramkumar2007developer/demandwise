from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(examples=["ok"])
    app_name: str
    version: str
    environment: str


class GeoBoundsResponse(BaseModel):
    min_lat: float
    max_lat: float
    min_lng: float
    max_lng: float


class ConfigResponse(BaseModel):
    app_name: str
    version: str
    environment: str
    region: str
    state: str
    supported_business_types: list[str]
    supported_languages: list[str]
    default_language: str
    min_budget_inr: float
    max_budget_inr: float
    geo_bounds: GeoBoundsResponse
    cors_origins: list[str]
