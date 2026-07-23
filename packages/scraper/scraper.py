"""
Backwards-compatible scraper module.

The implementation now lives in the source registry and LinkedIn source.
"""

try:
    from .registry import scrape_multiple
    from .sources.linkedin import (
        USER_AGENTS,
        extract_salary,
        fetch_job_description,
        get_headers,
        scrape_jobs,
    )
except ImportError:
    from registry import scrape_multiple
    from sources.linkedin import (
        USER_AGENTS,
        extract_salary,
        fetch_job_description,
        get_headers,
        scrape_jobs,
    )


__all__ = [
    "USER_AGENTS",
    "extract_salary",
    "fetch_job_description",
    "get_headers",
    "scrape_jobs",
    "scrape_multiple",
]
