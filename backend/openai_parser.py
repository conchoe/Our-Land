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
                        "You are a land-use expert. Analyze the following title/abstract."

                        "CRITICAL RULES:"

                            "Category MUST be one of: [mining, logging, grazing, conservation, land_transfer, other]."

                            "Impact_score MUST be an integer 1-10 based on surface acreage affected."

                            "1-3: Administrative changes, small renewals."

                            "4-7: Active drilling, harvesting, or large-scale grazing."

                           "8-10: New mines, thousands of acres, or permanent land ownership changes."
                        "Provide a 2-sentence summary on how this policy will affect people living in that area"
                        "Respond in JSON format with keys: locations (list), category (string), summary (string), impact_level (string), impact_score (int)."
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