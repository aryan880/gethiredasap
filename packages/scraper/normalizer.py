"""
Normalize scraped jobs into the shared scraper shape.
"""

from typing import Any, Dict


NORMALIZED_JOB_KEYS = (
    "id",
    "source",
    "title",
    "company",
    "location",
    "posted",
    "link",
    "description",
    "salary",
)


def normalize_job(job: Dict[str, Any], source: str) -> Dict[str, Any]:
    """
    Return a job with the canonical scraper fields.

    Existing extra fields are preserved so current consumers do not lose
    compatibility metadata such as the original search string.
    """
    normalized = dict(job)
    normalized["id"] = str(job.get("id", ""))
    normalized["source"] = str(job.get("source") or source)
    normalized["title"] = str(job.get("title", ""))
    normalized["company"] = str(job.get("company", ""))
    normalized["location"] = str(job.get("location", ""))
    normalized["posted"] = str(job.get("posted", ""))
    normalized["link"] = str(job.get("link", ""))
    normalized["description"] = str(job.get("description", ""))
    normalized["salary"] = str(job.get("salary", ""))
    return normalized
