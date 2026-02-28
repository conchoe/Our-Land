from pydantic import BaseModel
from typing import List, Optional

class Coordinate(BaseModel):
    lat: float
    lng: float
    label: str

class PolicyEvent(BaseModel):
    document_number: str
    title: str
    summary: str
    category: str
    impact: str
    impact_score: int
    publication_date: str
    locations: List[str]
    coordinates: List[Coordinate]
    federal_register_url: str
    environment_effect: str  # "beneficial", "detrimental", or "neutral" (fallback)
    relevance_score: int  # 1-10, how well the document matches the user's search query