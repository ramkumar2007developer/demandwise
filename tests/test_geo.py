from app.config import Settings
from app.core.geo import is_within_coimbatore


def test_coimbatore_center_is_inside_default_bounds() -> None:
    settings = Settings()
    assert is_within_coimbatore(11.0168, 76.9558, settings) is True


def test_chennai_is_outside_coimbatore_bounds() -> None:
    settings = Settings()
    assert is_within_coimbatore(13.0827, 80.2707, settings) is False


def test_custom_bounds_are_respected() -> None:
    settings = Settings(
        coimbatore_min_lat=11.0,
        coimbatore_max_lat=11.1,
        coimbatore_min_lng=76.9,
        coimbatore_max_lng=77.0,
    )
    assert is_within_coimbatore(11.05, 76.95, settings) is True
    assert is_within_coimbatore(10.90, 76.95, settings) is False


def test_haversine_distance_zero_for_same_point() -> None:
    from app.core.geo import haversine_distance_km

    assert haversine_distance_km(11.0168, 76.9558, 11.0168, 76.9558) == 0.0


def test_haversine_distance_symmetry() -> None:
    from app.core.geo import haversine_distance_km

    d1 = haversine_distance_km(11.0168, 76.9558, 11.0250, 76.9650)
    d2 = haversine_distance_km(11.0250, 76.9650, 11.0168, 76.9558)
    assert d1 == d2
    assert d1 > 0.0


def test_haversine_distance_known_points() -> None:
    from app.core.geo import haversine_distance_km

    # Gandhipuram (11.0183, 76.9725) to RS Puram (11.0090, 76.9490) is ~3 km
    dist = haversine_distance_km(11.0183, 76.9725, 11.0090, 76.9490)
    assert 2.5 <= dist <= 3.5


def test_haversine_distance_one_degree_latitude() -> None:
    from app.core.geo import haversine_distance_km

    # 1 degree of latitude is roughly 111.19 km
    dist = haversine_distance_km(11.0, 77.0, 12.0, 77.0)
    assert 110.0 <= dist <= 112.0


def test_location_error_message_contains_region() -> None:
    from app.core.geo import location_error_message

    msg = location_error_message()
    assert "Coimbatore" in msg
    assert "Tamil Nadu" in msg
