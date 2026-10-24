import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


@pytest.fixture
def client() -> TestClient:
    get_settings.cache_clear()
    return TestClient(app)


@pytest.fixture
def valid_location() -> dict:
    return {
        "latitude": 11.0168,
        "longitude": 76.9558,
        "area_name": "RS Puram",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
    }
