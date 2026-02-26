import time
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

# Use a unique user_agent so they don't block you
geocoder = Nominatim(user_agent="land_tracker_v1")

def get_coordinates(location: str) -> tuple:
    """
    Converts a location string (e.g., 'Nevada') into (lat, lng).
    Includes a small delay to respect Nominatim's usage policy.
    """
    if location.lower() in ["nationwide", "all us states", "various"]:
        return (39.8283, -98.5795) # Center of the USA
    
    try:
        # Nominatim asks for max 1 request per second
        time.sleep(1.1) 
        
        # We append 'USA' to ensure we don't get 'Georgia' the country
        result = geocoder.geocode(f"{location}, USA", timeout=10)
        
        if result:
            return (result.latitude, result.longitude)
        return None
    
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        print(f"Geocoding error for {location}: {e}")
        return None