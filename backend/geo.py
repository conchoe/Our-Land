import time
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

# Use a unique user_agent so they don't block you
geocoder = Nominatim(user_agent="land_tracker_v1")

# In-memory cache: same location string returns instantly (big speedup for repeated states)
_geo_cache: dict[str, tuple[float, float]] = {}

def get_coordinates(location: str) -> tuple | None:
    """
    Converts a location string (e.g., 'Nevada') into (lat, lng).
    Results are cached so repeated locations don't hit Nominatim again.
    """
    key = location.strip().lower()
    if key in _geo_cache:
        return _geo_cache[key]

    if key in ["nationwide", "all us states", "various"]:
        coords = (39.8283, -98.5795)  # Center of the USA
        _geo_cache[key] = coords
        return coords

    try:
        # Nominatim asks for max 1 request per second (only when we actually call the API)
        time.sleep(1.1)

        # We append 'USA' to ensure we don't get 'Georgia' the country
        result = geocoder.geocode(f"{location}, USA", timeout=10)

        if result:
            coords = (result.latitude, result.longitude)
            _geo_cache[key] = coords
            return coords
        return None

    except (GeocoderTimedOut, GeocoderServiceError) as e:
        print(f"Geocoding error for {location}: {e}")
        return None