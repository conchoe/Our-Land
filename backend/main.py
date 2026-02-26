import os
from dotenv import load_dotenv
import asyncio
import time
from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from models import PolicyEvent, Coordinate

# Import the functions we built in Phases 2 and 3
from federal_registry import search_documents
from openai_parser import extract_location_and_impact
from geo import get_coordinates

load_dotenv()
app = FastAPI()

# --- FIX 1 & 2: Correcting the static file path ---
current_dir = os.path.dirname(os.path.realpath(__file__))
# This looks for the 'frontend' folder sitting next to the 'backend' folder
frontend_path = os.path.join(current_dir, "..", "frontend")

app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# --- FIX 3: Handling the root URL ---
@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")

# ... rest of your /api/search routes below ...

# Enable CORS so your frontend can talk to your backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple In-Memory Cache: { "query": {"timestamp": 123, "data": [...]} }
cache = {}
CACHE_EXPIRATION = 3600  # 1 hour in seconds

# --- 1. Move this OUTSIDE and make it a standalone function ---
async def process_doc(doc):
    # AI Analysis
    analysis = await extract_location_and_impact(doc['title'], doc.get('abstract', ""))
    
    # Geocoding logic
    coords = []
    for loc in analysis.get("locations", []):
        geo_data = get_coordinates(loc)
        if geo_data:
            coords.append(Coordinate(lat=geo_data[0], lng=geo_data[1], label=loc))

    return PolicyEvent(
        document_number=doc['document_number'],
        title=doc['title'],
        summary=analysis.get("summary", "No summary available."),
        category=analysis.get("category", "other"),
        impact=analysis.get("impact_level", "low"),
        impact_score=analysis.get("impact_score", 5),
        publication_date=doc['publication_date'],
        locations=analysis.get("locations", []),
        coordinates=coords,
        federal_register_url=doc['html_url']
    )

# --- 2. Now your routes can both use it ---

@app.get("/api/search")
async def search(q: str = "public land transfer", page: int = 1):
    # ... (cache logic) ...
    
    raw_data = await search_documents(q, per_page=5, page=page)
    if not raw_data or "results" not in raw_data:
        return []

    # This now works because process_doc is defined above!
    tasks = [process_doc(doc) for doc in raw_data["results"]]
    policy_events = await asyncio.gather(*tasks)

    # ... (save cache and return) ...
    return policy_events

@app.get("/api/top_impact")
async def top_impact(q: str = "land disposal"):
    raw_data = await search_documents(q, per_page=20) # Get more to find the best
    
    # This also works now!
    tasks = [process_doc(doc) for doc in raw_data["results"]]
    all_events = await asyncio.gather(*tasks)

    # Sort by impact (High first, then Medium, then Low)
    impact_order = {"high": 3, "medium": 2, "low": 1}
    sorted_events = sorted(all_events, key=lambda x: impact_order.get(x.impact, 0), reverse=True)

    return sorted_events[:10]

@app.get("/api/health")
async def health_check():
    return {"status": "online", "cache_size": len(cache)}