"""
Scraper source registry and orchestration.
"""

from typing import Dict, List, Optional

try:
    from .normalizer import normalize_job
    from .sources.jobbank import JobBankSource
    from .sources.linkedin import LinkedInSource, extract_salary, fetch_job_description
except ImportError:
    from normalizer import normalize_job
    from sources.jobbank import JobBankSource
    from sources.linkedin import LinkedInSource, extract_salary, fetch_job_description


SOURCES = {
    "linkedin": LinkedInSource(),
    "jobbank": JobBankSource(),
}

DEFAULT_SOURCE = "linkedin"


def get_source(name: str = DEFAULT_SOURCE):
    if name not in SOURCES:
        available = ", ".join(sorted(SOURCES))
        raise ValueError(f"Unknown scraper source '{name}'. Available sources: {available}")

    return SOURCES[name]


def scrape_multiple(
    searches: List[Dict],
    count_per_search: int = 15,
    fetch_descriptions: bool = True,
    sources: Optional[List[str]] = None,
) -> List[Dict]:
    """
    Scrape multiple role + location combinations.
    Deduplicates results by source + job ID.
    """
    all_jobs = []
    seen_ids = set()
    selected_source_names = sources if sources is not None else [DEFAULT_SOURCE]
    selected_sources = [get_source(source_name) for source_name in selected_source_names]

    for source in selected_sources:
        for search in searches:
            role = search.get("role", "")
            location = search.get("location", "")

            if not role or not location:
                continue

            print(f"🔍 Scraping {source.name}: '{role}' in '{location}'...")
            jobs = source.scrape_jobs(role, location, count_per_search)
            print(f"   Found {len(jobs)} jobs")

            for job in jobs:
                normalized_job = normalize_job(job, source.name)
                seen_key = (normalized_job["source"], normalized_job["id"])
                if seen_key in seen_ids:
                    continue

                seen_ids.add(seen_key)

                if source.name == "linkedin" and fetch_descriptions and normalized_job["link"] != "#":
                    desc = fetch_job_description(normalized_job["link"])
                    normalized_job["description"] = desc
                    normalized_job["salary"] = extract_salary(desc)
                elif not fetch_descriptions:
                    normalized_job["description"] = ""
                    normalized_job["salary"] = ""

                all_jobs.append(normalized_job)

    print(f"✅ Total unique jobs: {len(all_jobs)}")
    return all_jobs
