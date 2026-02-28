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
async def process_doc(doc, query: str = ""):
    # AI Analysis (pass query so the model can score relevance)
    analysis = await extract_location_and_impact(
        doc['title'], doc.get('abstract', ""), search_query=query
    )
    
    #get rid of meetings etc.
    title = doc.get('title', "").lower()
    skip_words = ["administrative", "agenda", "committee", "nomination", "personnel"]
    for word in skip_words:
        if word in title:
            return None

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
        federal_register_url=doc['html_url'],
        environment_effect=analysis.get("environment_effect", "neutral"),
        relevance_score=analysis.get("relevance_score", 5),
    )

# --- 2. Now your routes can both use it ---
@app.get("/api/search")
async def search(q: str = "public land", mode: str = "recent", page: int = 1):
    # 0. Return cached result if still valid (makes repeat searches instant)
    cache_key = f"{q}|{mode}|{page}"
    if cache_key in cache:
        entry = cache[cache_key]
        if (time.time() - entry["timestamp"]) < CACHE_EXPIRATION:
            return entry["data"]

    # 1. Determine if we are looking for significant items
    is_significant = (mode == "significant")
    
    # 2. Fetch from Federal Register
    count = 20 if is_significant else 10  # number of docs to fetch
    raw_data = await search_documents(q, per_page=count, page=page, significant=is_significant)
    
    if not raw_data or "results" not in raw_data:
        return []

    # 3. Process (filter out None from skipped docs); pass query for relevance scoring
    tasks = [process_doc(doc, q) for doc in raw_data["results"]]
    results = await asyncio.gather(*tasks)
    policy_events = [e for e in results if e is not None]

    # 4. Re-rank by relevance to the search query (then impact as tiebreak)
    policy_events.sort(key=lambda x: (x.relevance_score, x.impact_score), reverse=True)
    if is_significant:
        policy_events = policy_events[:10]

    # 5. Cache response for repeat searches
    cache[cache_key] = {"timestamp": time.time(), "data": [e.model_dump() for e in policy_events]}
    return policy_events

@app.get("/api/health")
async def health_check():
    return {"status": "online", "cache_size": len(cache)}