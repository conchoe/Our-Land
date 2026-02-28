import httpx
import asyncio
from datetime import datetime

BASE_URL = "https://www.federalregister.gov/api/v1"

async def search_documents(query: str, per_page: int = 10, page: int = 1, significant = False):
    params = {
        "conditions[term]": query,
        "conditions[agencies][]": [
            "land-management-bureau",        
            "forest-service",                
            "environmental-protection-agency",
             "national-park-service",
             "fish-and-wildlife-service"

        ],
        "per_page": per_page,
        "page": page,
        "order": "newest",
        "fields[]": [
            "title", "abstract", "publication_date", "document_number",
            "agencies", "full_text_xml_url", "html_url", "cfr_references"
        ]
    }
    
    if significant: #if user wants significant events 
        params["conditions[significant]"] = 1
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{BASE_URL}/documents.json", params=params)
            response.raise_for_status()  # Catch 4xx or 5xx errors
            return response.json()
        except httpx.HTTPStatusError as e:
            print(f"Error fetching data: {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            return None

def display_results(data):
    """Helper to print results in a readable format."""
    if not data or "results" not in data:
        print("No results found.")
        return

    print(f"--- Found {data['count']} total documents ---")
    for doc in data["results"]:
        date = doc.get("publication_date", "N/A")
        title = doc.get("title", "No Title")
        agency_names = [a["name"] for a in doc.get("agencies", [])]
        
        print(f"[{date}] {title}")
        print(f"Agencies: {', '.join(agency_names)}")
        print(f"Link: {doc.get('html_url')}")
        print("-" * 30)

# Quick Test Execution
if __name__ == "__main__":
    query_term = "mining permit"
    print(f"Searching for: {query_term}...")
    
    results = asyncio.run(search_documents(query_term))
    display_results(results)