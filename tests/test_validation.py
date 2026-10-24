import pytest
from pydantic import ValidationError

from app.schemas.analysis import BusinessAnalysisRequest


def _request_payload(location: dict, **overrides) -> dict:
    payload = {
        "business_name": "Aroma Cafe",
        "business_type": "cafe",
        "language": "en",
        "budget_inr": 500000,
        "location": location,
    }
    payload.update(overrides)
    return payload


def test_valid_analysis_request_is_accepted(valid_location: dict) -> None:
    request = BusinessAnalysisRequest.model_validate(_request_payload(valid_location, language="tamil"))
    assert request.business_type.value == "cafe"
    assert request.language.value == "ta"
    assert request.location.city == "Coimbatore"


@pytest.mark.parametrize(
    "business_type,expected",
    [
        ("Cafe", "cafe"),
        ("hotel", "hotel"),
        ("Hotel/Small Restaurant", "hotel"),
        ("Retail Shop", "retail"),
    ],
)
def test_business_type_aliases(valid_location: dict, business_type: str, expected: str) -> None:
    request = BusinessAnalysisRequest.model_validate(
        _request_payload(valid_location, business_type=business_type)
    )
    assert request.business_type.value == expected


def test_invalid_business_type_is_rejected(valid_location: dict) -> None:
    with pytest.raises(ValidationError):
        BusinessAnalysisRequest.model_validate(
            _request_payload(valid_location, business_type="warehouse")
        )


def test_invalid_language_is_rejected(valid_location: dict) -> None:
    with pytest.raises(ValidationError):
        BusinessAnalysisRequest.model_validate(_request_payload(valid_location, language="fr"))


def test_budget_below_minimum_is_rejected(valid_location: dict) -> None:
    with pytest.raises(ValidationError):
        BusinessAnalysisRequest.model_validate(_request_payload(valid_location, budget_inr=0))


def test_budget_above_maximum_is_rejected(valid_location: dict) -> None:
    with pytest.raises(ValidationError):
        BusinessAnalysisRequest.model_validate(_request_payload(valid_location, budget_inr=99_000_000))


def test_non_coimbatore_city_is_rejected(valid_location: dict) -> None:
    location = {**valid_location, "city": "Chennai"}
    with pytest.raises(ValidationError):
        BusinessAnalysisRequest.model_validate(_request_payload(location))


def test_coordinates_outside_boundary_are_rejected(valid_location: dict) -> None:
    location = {**valid_location, "latitude": 13.08, "longitude": 80.27}
    with pytest.raises(ValidationError):
        BusinessAnalysisRequest.model_validate(_request_payload(location))
