"""
main.py — NLP Microservice
--------------------------
FastAPI server that exposes the NLP scorer as an HTTP API.
Node.js API calls this service to score jobs against resumes.

Run:
    uvicorn main:app --host 0.0.0.0 --port 8002 --reload

Endpoints:
    POST /score        → score a single job against a resume
    POST /score/batch  → score multiple jobs at once (most efficient)
    GET  /health       → health check
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

from scorer import (
    build_vectorizer,
    score_job,
    score_jobs_batch,
    get_score_label,
)

load_dotenv()


def parse_allowed_origins() -> list[str]:
    raw = os.getenv("NLP_ALLOWED_ORIGINS", "http://localhost:3001")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def required_api_key() -> str:
    value = os.getenv("NLP_API_KEY", "")
    if len(value) < 24:
        raise RuntimeError("NLP_API_KEY must be set to a strong shared secret")
    return value


INTERNAL_API_KEY = required_api_key()

app = FastAPI(
    title="GetHiredASAP NLP Service",
    description="Job matching NLP microservice",
    version="1.0.0",
)

# Allow Node.js API to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_allowed_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Internal-Api-Key"],
)


@app.middleware("http")
async def require_internal_api_key(request: Request, call_next):
    header_value = request.headers.get("x-internal-api-key", "")
    if header_value != INTERNAL_API_KEY:
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized internal request"},
        )
    return await call_next(request)


# ── REQUEST / RESPONSE MODELS ──

class JobItem(BaseModel):
    id:          str
    title:       str
    company:     str
    location:    str
    description: Optional[str] = ""
    link:        Optional[str] = ""
    salary:      Optional[str] = ""
    posted:      Optional[str] = ""

class ScoreRequest(BaseModel):
    resume_text:     str
    job_text:        str     # title + company + location + description combined
    candidate_years: Optional[float] = 1.5

class BatchScoreRequest(BaseModel):
    resume_text:     str
    jobs:            List[JobItem]
    candidate_years: Optional[float] = 1.5

class ScoreResult(BaseModel):
    score:           float
    label:           str
    is_early_career: bool
    exp_label:       Optional[str] = ""
    method:          str


# ── CACHE ──
# Cache vectorizers per resume to avoid rebuilding on every request
# Key: first 100 chars of resume (enough to identify it)
# Value: (vectorizer, resume_vector)
_vectorizer_cache: Dict[str, Any] = {}

def get_or_build_vectorizer(resume_text: str):
    """Get cached vectorizer or build a new one."""
    cache_key = resume_text[:100]
    if cache_key not in _vectorizer_cache:
        _vectorizer_cache[cache_key] = build_vectorizer(resume_text)
        # Keep cache small — max 100 entries
        if len(_vectorizer_cache) > 100:
            oldest_key = next(iter(_vectorizer_cache))
            del _vectorizer_cache[oldest_key]
    return _vectorizer_cache[cache_key]


# ── ENDPOINTS ──

@app.get("/health")
def health():
    """Health check."""
    return {
        "status":       "ok",
        "service":      "nlp",
        "model":        "sentence-transformers" if True else "tfidf",
        "cache_size":   len(_vectorizer_cache),
    }


@app.post("/score", response_model=ScoreResult)
async def score_single(request: ScoreRequest):
    """
    Score a single job against a resume.

    Node.js sends:
        {
            "resume_text": "Aryan Sawhney. Full Stack Developer...",
            "job_text": "Sales Rep at Telus. Vancouver. 2 years exp...",
            "candidate_years": 1.5
        }

    Returns:
        {
            "score": 72.5,
            "label": "✅ Strong match",
            "is_early_career": true,
            "exp_label": "👍 1.5yr exp — 2yr required (1yr gap)",
            "method": "semantic"
        }
    """
    try:
        if len(request.resume_text) < 20:
            raise HTTPException(
                status_code=400,
                detail="Resume text too short"
            )

        vec, rvec     = get_or_build_vectorizer(request.resume_text)
        score, detail = score_job(request.job_text, vec, rvec)

        return ScoreResult(
            score=           score,
            label=           get_score_label(score),
            is_early_career= detail.get("early", False),
            exp_label=       detail.get("exp_label", ""),
            method=          detail.get("method", "unknown"),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/score/batch")
async def score_batch(request: BatchScoreRequest):
    """
    Score multiple jobs against a resume in one request.
    Most efficient — builds vectorizer once, scores all jobs.

    Node.js sends:
        {
            "resume_text": "Aryan Sawhney...",
            "candidate_years": 1.5,
            "jobs": [
                {"id": "123", "title": "Sales Rep", "company": "Telus", ...},
                {"id": "456", "title": "Frontend Dev", "company": "Shopify", ...}
            ]
        }

    Returns:
        {
            "jobs": [
                {...job, "score": 78, "label": "✅ Strong match", ...},
                {...job, "score": 65, "label": "👍 Good match", ...}
            ],
            "total": 2
        }
    """
    try:
        if len(request.resume_text) < 20:
            raise HTTPException(
                status_code=400,
                detail="Resume text too short"
            )

        if not request.jobs:
            return {"jobs": [], "total": 0}

        # Convert Pydantic models to dicts
        jobs = [job.dict() for job in request.jobs]

        # Score all jobs
        scored = score_jobs_batch(
            jobs=            jobs,
            resume_text=     request.resume_text,
            candidate_years= request.candidate_years,
        )

        return {
            "jobs":  scored,
            "total": len(scored),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
