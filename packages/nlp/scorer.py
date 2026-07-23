"""
scorer.py
---------
NLP job scoring engine — extracted from bot.py
Only responsible for scoring jobs against resumes.
No scraping, no Telegram, no email — just NLP.

Scoring approach:
  Pure TF-IDF cosine similarity — 100% personalised per user.
  Each user's resume is vectorised and compared against job descriptions.
  Score range: 0-100
"""

import os
import re
from typing import List, Dict, Tuple, Optional

# Try to load sentence-transformers for semantic matching
# Falls back to TF-IDF if not installed
_st_model = None
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    model_name = os.getenv("NLP_MODEL_NAME", "all-MiniLM-L6-v2")
    local_only = os.getenv("NLP_MODEL_LOCAL_ONLY", "true").lower() not in {"0", "false", "no"}
    _st_model = SentenceTransformer(model_name, local_files_only=local_only)
    USE_SEMANTIC = True
    print("✅ sentence-transformers loaded — semantic matching active")
except Exception as exc:
    USE_SEMANTIC = False
    print(f"⚠️  semantic model unavailable ({type(exc).__name__}) — using TF-IDF")

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# ── EARLY CAREER SIGNALS ──
# Universal signals that indicate a job targets junior candidates
EARLY_CAREER_TERMS = [
    "0-2 years", "0 to 2 years", "1-2 years",
    "entry level", "entry-level", "early career", "early-career",
    "new grad", "new graduate", "recent graduate", "graduate program",
    "junior", "no experience required", "fresh graduate",
    "0+ years", "1+ year", "up to 2 years", "less than 2 years",
]


# ── TEXT CLEANING ──

def clean_text(text: str) -> str:
    """Lowercase, remove punctuation, strip extra whitespace."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ── VECTORIZER ──

def build_vectorizer(resume_text: str):
    """
    Build a matching model from a user's resume text.

    If sentence-transformers is available:
      → encodes resume into a semantic embedding vector
      → understands meaning, not just keywords
      → "account executive" matches "sales rep" correctly

    Otherwise falls back to TF-IDF:
      → counts word overlaps
      → fast and lightweight
      → less accurate for synonyms

    Returns:
      (model_type, resume_vector)
      model_type is either "semantic" or a TfidfVectorizer instance
    """
    if USE_SEMANTIC:
        embedding = _st_model.encode(
            resume_text,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return "semantic", embedding
    else:
        cleaned = clean_text(resume_text)
        vec = TfidfVectorizer(
            ngram_range=(1, 2),    # unigrams + bigrams
            stop_words="english",
            min_df=1,
            max_features=5000,
            sublinear_tf=True,     # dampens high-frequency terms
        )
        vec.fit([cleaned])
        return vec, vec.transform([cleaned])


# ── SCORING ──

def score_job(
    job_text: str,
    vectorizer,
    resume_vector,
) -> Tuple[float, Dict]:
    """
    Score a job description against a user's resume.

    Args:
        job_text:       job title + company + location + description
        vectorizer:     built from build_vectorizer()
        resume_vector:  built from build_vectorizer()

    Returns:
        (score 0-100, breakdown dict)
    """
    early = any(t in job_text.lower() for t in EARLY_CAREER_TERMS)

    if vectorizer is None or resume_vector is None:
        return 0.0, {"total": 0, "early": early, "method": "none"}

    if USE_SEMANTIC and vectorizer == "semantic":
        # Semantic matching — understands meaning
        job_emb = _st_model.encode(job_text, convert_to_numpy=True)
        dot     = float(np.dot(resume_vector, job_emb))
        norm    = float(
            np.linalg.norm(resume_vector) * np.linalg.norm(job_emb)
        )
        raw   = dot / norm if norm > 0 else 0.0
        # Scale: semantic cosine is 0.1-0.8 for relevant matches
        # Subtract baseline 0.1, multiply by 125 to get 0-100
        score = min(max(round((raw - 0.1) * 125, 1), 0), 100)
        method = "semantic"
    else:
        # TF-IDF fallback
        cleaned = clean_text(job_text)
        if not cleaned:
            return 0.0, {"total": 0, "early": early, "method": "tfidf"}
        job_vec = vectorizer.transform([cleaned])
        raw     = float(cosine_similarity(resume_vector, job_vec)[0][0])
        score   = min(round(raw * 200, 1), 100)
        method  = "tfidf"

    return score, {
        "total":  score,
        "cosine": round(raw, 4),
        "early":  early,
        "method": method,
    }


# ── EXPERIENCE MATCHING ──

def extract_experience_required(text: str) -> Optional[float]:
    """
    Extract years of experience required from job description.
    Returns float (years) or None if not found.
    """
    if not text:
        return None

    patterns = [
        r"(\d+)\s*\+\s*years?\s*(?:of\s+)?(?:experience|exp)",
        r"(\d+)\s*[-to]+\s*(\d+)\s*years?\s*(?:of\s+)?(?:experience|exp)",
        r"(?:minimum|min|at\s+least)\s+(\d+)\s*years?\s*(?:of\s+)?(?:experience|exp)",
        r"(\d+)\s*years?\s*(?:of\s+)?(?:relevant\s+)?(?:experience|exp)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text.lower())
        if match:
            groups = [g for g in match.groups() if g is not None]
            if groups:
                return float(groups[0])

    return None


def experience_adjustment(
    required: Optional[float],
    candidate_years: float,
) -> Tuple[float, str]:
    """
    Calculate score adjustment based on experience gap.

    Args:
        required:        years required by job (None if unknown)
        candidate_years: years the candidate has

    Returns:
        (adjustment: float, label: str)
        adjustment is added to the base NLP score
    """
    if required is None:
        return 0.0, ""

    gap = required - candidate_years

    if gap <= 0:
        return 15.0, f"✅ {candidate_years}yr exp — meets {required}yr requirement"
    elif gap <= 1:
        return 10.0, f"👍 {candidate_years}yr exp — {required}yr required (1yr gap, still good)"
    elif gap <= 2:
        return 5.0,  f"🔎 {candidate_years}yr exp — {required}yr required (2yr gap, possible)"
    elif gap <= 3:
        return 0.0,  f"🔎 {candidate_years}yr exp — {required}yr required (stretch role)"
    elif required >= 7 and candidate_years < 2:
        return -10.0, f"⚠️ {candidate_years}yr exp — {required}yr required (senior role)"
    else:
        return -5.0, f"⚠️ {candidate_years}yr exp — {required}yr required (gap)"


def get_score_label(score: float) -> str:
    """Convert numeric score to human readable label."""
    if score >= 70: return "🔥 Excellent match"
    if score >= 50: return "✅ Strong match"
    if score >= 35: return "👍 Good match"
    if score >= 20: return "🔎 Possible match"
    return "📋 Low match"


# ── BATCH SCORING ──

def score_jobs_batch(
    jobs: List[Dict],
    resume_text: str,
    candidate_years: Optional[float] = None,
) -> List[Dict]:
    """
    Score a list of jobs against a resume.
    Most efficient way to score many jobs — builds vectorizer once.

    Args:
        jobs:            list of job dicts (must have title, company, location, description)
        resume_text:     user's resume as plain text
        candidate_years: user's years of experience (used for exp adjustment)

    Returns:
        List of jobs with score, breakdown, label added
        Sorted by: early career first, then score descending
    """
    if not jobs or not resume_text:
        return jobs

    # Build vectorizer once for all jobs
    vectorizer, resume_vector = build_vectorizer(resume_text)

    full_texts = [
        " ".join([
            job.get("title", ""),
            job.get("company", ""),
            job.get("location", ""),
            job.get("description", ""),
        ])
        for job in jobs
    ]

    semantic_scores = None
    if USE_SEMANTIC and vectorizer == "semantic" and _st_model is not None:
        job_embeddings = _st_model.encode(
            full_texts,
            convert_to_numpy=True,
            batch_size=32,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        with np.errstate(over="ignore", invalid="ignore", divide="ignore"):
            raw_similarities = job_embeddings @ resume_vector
        similarities = np.nan_to_num(
            raw_similarities,
            nan=0.0,
            posinf=0.0,
            neginf=0.0,
        )
        semantic_scores = [
            min(max(round((float(raw) - 0.1) * 125, 1), 0), 100)
            for raw in similarities
        ]

    scored_jobs = []

    for index, job in enumerate(jobs):
        full_text = full_texts[index]
        if semantic_scores is not None:
            base_score = semantic_scores[index]
            breakdown = {
                "early": any(term in full_text.lower() for term in EARLY_CAREER_TERMS),
                "method": "semantic",
            }
        else:
            base_score, breakdown = score_job(full_text, vectorizer, resume_vector)

        # Experience adjustment
        required = extract_experience_required(job.get("description", ""))
        if candidate_years is None:
            adj, exp_label = 0.0, ""
        else:
            adj, exp_label = experience_adjustment(required, candidate_years)

        # Final score
        final = min(max(round(base_score + adj, 1), 0), 100)

        scored_jobs.append({
            **job,
            "score":         final,
            "base_score":    base_score,
            "exp_label":     exp_label,
            "is_early_career": breakdown.get("early", False),
            "match_label":   get_score_label(final),
            "method":        breakdown.get("method", "unknown"),
        })

    # Sort: early career first, then by score descending
    scored_jobs.sort(
        key=lambda j: (
            1 if j.get("is_early_career") else 0,
            j.get("score", 0),
        ),
        reverse=True,
    )

    return scored_jobs
