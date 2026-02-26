import json
import os
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()
# Ensure your OPENAI_API_KEY is set in your environment variables
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def extract_location_and_impact(title: str, abstract: str) -> dict:
    if not abstract:
        abstract = "No abstract provided."

    prompt = f"""
    Title: {title}
    Abstract: {abstract}
    """
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": (
                        "You are a senior environmental policy analyst extracting structured data from Federal Register documents. "
                        "Identify the US states affected. Categorize the document. "
                        "Provide a 2-sentence summary. Assess impact level as either low, medium, or high,"
                        "also assign an impact score from 1-10 (10 being tremendous environmental/land change)"
                        "Respond in JSON format with keys: locations (list), category, summary, impact_level, impact_score (int)."
                    )
                },
                {"role": "user", "content": prompt}
            ],
            # 'json_object' ensures valid JSON, but 'gpt-4o-mini' 
            # is smart enough to follow the schema in the system prompt.
            response_format={"type": "json_object"}
        )
        
        # The content comes back as a string, we parse it into a dict
        raw_content = response.choices[0].message.content
        return json.loads(raw_content)
    
    except Exception as e:
        print(f"OpenAI Error: {e}")
        return {
            "locations": [],
            "category": "error",
            "summary": "Failed to parse document.",
            "impact_level": "unknown"
        }