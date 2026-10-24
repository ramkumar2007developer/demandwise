from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and optional .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "DemandWise"
    app_version: str = "1.0.0"
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000

    cors_origins: str = (
        "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,http://127.0.0.1:3000"
    )

    coimbatore_min_lat: float = 10.85
    coimbatore_max_lat: float = 11.20
    coimbatore_min_lng: float = 76.80
    coimbatore_max_lng: float = 77.20

    default_language: str = "en"
    supported_languages: str = "en,ta"
    allowed_business_types: str = "cafe,hotel,retail"

    min_budget_inr: float = 1
    max_budget_inr: float = 50_000_000

    region_name: str = "Coimbatore"
    region_state: str = "Tamil Nadu"

    ml_dataset_path: str = "data/synthetic_coimbatore_demand_demo.csv"
    ml_artifact_path: str = "artifacts/demand_pipeline.joblib"
    ml_metadata_path: str = "artifacts/training_metadata.json"

    # -----------------------------------------------------------------------
    # Phase 3: External Competitor Search & Retrieval Configuration
    # -----------------------------------------------------------------------
    overpass_api_url: str = "https://overpass-api.de/api/interpreter"
    competitor_search_radius_meters: int = 2000
    competitor_search_timeout_seconds: float = 10.0
    competitor_search_max_results: int = 50
    competitor_user_agent: str = (
        "DemandWise/1.0.0 (student project; https://github.com/demandwise)"
    )

    # -----------------------------------------------------------------------
    # Phase 3: Baseline Startup Budget Feasibility Assumptions (in INR)
    # -----------------------------------------------------------------------
    # Cafe baseline startup costs
    cafe_setup_renovation_inr: float = 350000.0
    cafe_equipment_inr: float = 250000.0
    cafe_rent_deposit_inr: float = 150000.0
    cafe_initial_inventory_inr: float = 80000.0
    cafe_working_capital_reserve_inr: float = 100000.0
    cafe_licensing_permits_inr: float = 20000.0

    # Hotel / Small Restaurant baseline startup costs
    hotel_setup_renovation_inr: float = 600000.0
    hotel_equipment_inr: float = 500000.0
    hotel_rent_deposit_inr: float = 250000.0
    hotel_initial_inventory_inr: float = 150000.0
    hotel_working_capital_reserve_inr: float = 150000.0
    hotel_licensing_permits_inr: float = 35000.0

    # Retail Shop baseline startup costs
    retail_setup_renovation_inr: float = 250000.0
    retail_equipment_inr: float = 120000.0
    retail_rent_deposit_inr: float = 120000.0
    retail_initial_inventory_inr: float = 300000.0
    retail_working_capital_reserve_inr: float = 80000.0
    retail_licensing_permits_inr: float = 15000.0

    # -----------------------------------------------------------------------
    # Phase 4: Multilingual LLM Explanation Service Configuration
    # -----------------------------------------------------------------------
    llm_provider: str = "groq"
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "llama-3.3-70b-versatile"
    llm_api_key: str | None = None
    llm_timeout_seconds: float = 30.0
    llm_temperature: float = 0.3

    def _split_csv(self, value: str) -> list[str]:
        return [item.strip() for item in value.split(",") if item.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return self._split_csv(self.cors_origins)

    @property
    def supported_language_list(self) -> list[str]:
        return [item.lower() for item in self._split_csv(self.supported_languages)]

    @property
    def allowed_business_type_list(self) -> list[str]:
        return [item.lower() for item in self._split_csv(self.allowed_business_types)]

    @property
    def geo_bounds(self) -> dict[str, float]:
        return {
            "min_lat": self.coimbatore_min_lat,
            "max_lat": self.coimbatore_max_lat,
            "min_lng": self.coimbatore_min_lng,
            "max_lng": self.coimbatore_max_lng,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
