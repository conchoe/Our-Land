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