from math import asin, cos, radians, sin, sqrt


def haversine_distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_m = 6_371_000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * earth_radius_m * asin(sqrt(a))


def evaluate_geofence(
    *,
    mark_lat: float | None,
    mark_lng: float | None,
    location_lat: float | None,
    location_lng: float | None,
    radius_meters: int,
    accuracy_meters: float | None,
) -> tuple[bool, float | None, bool]:
    if mark_lat is None or mark_lng is None or location_lat is None or location_lng is None:
        return False, None, True
    distance = haversine_distance_meters(mark_lat, mark_lng, float(location_lat), float(location_lng))
    inside = distance <= radius_meters
    suspicious = not inside or (accuracy_meters is not None and accuracy_meters > 100)
    return inside, round(distance, 2), suspicious

