"""
main.py — Scraper Microservice
------------------------------
FastAPI server that exposes the LinkedIn scraper as an HTTP API.
Node.js API calls this service to trigger job scraping.

Run:
    uvicorn main:app --host 0.0.0.0 --port 8001 --reload

Endpoints:
    POST /scrape   → scrape jobs for given searches
    GET  /health   → health check
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

from scraper import scrape_multiple

load_dotenv()

app = FastAPI(
    title="GetHiredASAP Scraper Service",
    description="LinkedIn job scraper microservice",
    version="1.0.0",
)

# Allow Node.js API to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REQUEST / RESPONSE MODELS ──
# Pydantic models validate incoming data automatically
# If required fields are missing → 422 error returned automatically

class SearchItem(BaseModel):
    role:     str
    location: str

class ScrapeRequest(BaseModel):
    searches:           List[SearchItem]
    count_per_search:   Optional[int] = 15
    fetch_descriptions: Optional[bool] = True
    time_filter:        Optional[str] = "r86400"  # last 24 hours

class ScrapeResponse(BaseModel):
    jobs:  list
    total: int


# ── ENDPOINTS ──

@app.get("/health")
def health():
    """Health check — used by Node.js to verify scraper is running."""
    return {
        "status":  "ok",
        "service": "scraper",
    }


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape(request: ScrapeRequest):
    """
    Scrape LinkedIn jobs for given role + location combinations.

    Node.js sends:
        {
            "searches": [
                {"role": "sales representative", "location": "Vancouver, BC"},
                {"role": "web developer", "location": "Remote"}
            ],
            "count_per_search": 15,
            "fetch_descriptions": true
        }

    Returns:
        {
            "jobs": [...],
            "total": 23
        }
    """
    try:
        if not request.searches:
            raise HTTPException(
                status_code=400,
                detail="At least one search is required"
            )

        if len(request.searches) > 20:
            raise HTTPException(
                status_code=400,
                detail="Maximum 20 searches per request"
            )

        # Convert Pydantic models to dicts
        searches = [
            {"role": s.role, "location": s.location}
            for s in request.searches
        ]

        # Run the scraper
        jobs = scrape_multiple(
            searches=searches,
            count_per_search=request.count_per_search,
            fetch_descriptions=request.fetch_descriptions,
        )

        return ScrapeResponse(jobs=jobs, total=len(jobs))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))