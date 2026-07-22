"""
LinkedIn scraper source.

Only responsible for fetching job listings from LinkedIn.
No NLP, no Telegram, no email — just scraping.
"""

import random
import re
import time
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

try:
    from .base import JobSource
except ImportError:
    from sources.base import JobSource

try:
    from ..normalizer import normalize_job
except ImportError:
    from normalizer import normalize_job


SOURCE_NAME = "linkedin"


# Rotate between different browser signatures so LinkedIn can't fingerprint us as a bot.
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
]


def get_headers() -> Dict:
    """Return headers with a randomly picked user agent."""
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://www.linkedin.com/jobs/search/",
        "DNT": "1",
    }


def fetch_job_description(url: str) -> str:
    """
    Fetch full job description from LinkedIn job page.
    Uses LinkedIn's guest API endpoint for unauthenticated access.
    Returns empty string if fetch fails.
    """
    try:
        job_id = None

        patterns = [
            r"/view/(\d+)",
            r"currentJobId=(\d+)",
            r"-(\d+)(?:\?|$)",
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                job_id = match.group(1)
                break

        if not job_id:
            return ""

        # Use LinkedIn's guest API — no login required
        api_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
        time.sleep(random.uniform(2, 4))
        r = requests.get(api_url, headers=get_headers(), timeout=15)

        if r.status_code != 200:
            return ""

        soup = BeautifulSoup(r.text, "html.parser")

        # Try multiple selectors — LinkedIn changes these occasionally
        for cls in ["description__text", "show-more-less-html__markup", "decorated-job-posting__details"]:
            d = soup.find("div", {"class": cls})
            if d and len(d.get_text(strip=True)) > 50:
                return d.get_text(separator=" ", strip=True)

        # Fallback — all text from page
        all_text = soup.get_text(separator=" ", strip=True)
        if len(all_text) > 100:
            return all_text[:3000]

        return ""

    except Exception:
        return ""


def extract_salary(text: str) -> str:
    """
    Extract salary/wage mentions from job description text.
    Returns empty string if no salary found.
    """
    if not text:
        return ""

    patterns = [
        r"\$[\d,]+(?:\.\d{2})?\s*[-–]\s*\$[\d,]+(?:\.\d{2})?(?:\s*(?:per\s+)?(?:hour|hr|year|yr|annual|annually))?",
        r"\$[\d,]+(?:\.\d{2})?(?:\s*[-–/]\s*\$[\d,]+(?:\.\d{2})?)?(?:\s*(?:per\s+)?(?:hour|hr|year|yr|annual|annually))",
        r"(?:salary|compensation|pay|wage|rate)[\s:]+\$[\d,]+",
        r"(?:up\s+to|starting\s+at|from)\s+\$[\d,]+",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()

    return ""


class LinkedInSource(JobSource):
    name = SOURCE_NAME

    def scrape_jobs(
        self,
        keywords: str,
        location: str,
        count: int = 15,
        time_filter: str = "r86400",
    ) -> List[Dict]:
        """
        Scrape LinkedIn public job listings.
        No login required — uses LinkedIn's guest API.
        """
        jobs = []
        url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
        params = {
            "keywords": keywords,
            "location": location,
            "f_TPR": time_filter,
            "start": 0,
            "count": count,
        }

        try:
            # Random delay to mimic human browsing
            time.sleep(random.uniform(4, 10))
            r = requests.get(url, params=params, headers=get_headers(), timeout=15)

            # Handle rate limiting — wait and retry once
            if r.status_code == 429:
                print(f"  ⚠️  Rate limited. Waiting 60s...")
                time.sleep(60)
                r = requests.get(url, params=params, headers=get_headers(), timeout=15)

            if r.status_code != 200:
                print(f"  ⚠️  HTTP {r.status_code} for '{keywords}' in '{location}'")
                return jobs

            soup = BeautifulSoup(r.text, "html.parser")
            cards = soup.find_all("li")

            for card in cards:
                try:
                    id_tag = card.find("div", {"data-entity-urn": True})
                    job_id = id_tag["data-entity-urn"].split(":")[-1] if id_tag else None
                    t_tag = card.find("h3", class_="base-search-card__title")
                    c_tag = card.find("h4", class_="base-search-card__subtitle")
                    l_tag = card.find("span", class_="job-search-card__location")
                    p_tag = card.find("time")
                    a_tag = card.find("a", class_="base-card__full-link")

                    title = t_tag.get_text(strip=True) if t_tag else "N/A"
                    company = c_tag.get_text(strip=True) if c_tag else "N/A"
                    loc = l_tag.get_text(strip=True) if l_tag else location
                    posted = p_tag.get("datetime", "") if p_tag else ""
                    link = a_tag["href"] if a_tag else "#"

                    if not job_id or title == "N/A":
                        continue

                    jobs.append(
                        normalize_job(
                            {
                                "id": job_id,
                                "title": title,
                                "company": company,
                                "location": loc,
                                "posted": posted,
                                "link": link,
                                "search": f"{keywords} @ {location}",
                            },
                            self.name,
                        )
                    )

                except Exception:
                    continue

        except requests.RequestException as e:
            print(f"  ❌ Request failed: {e}")

        return jobs


def scrape_jobs(
    keywords: str,
    location: str,
    count: int = 15,
    time_filter: str = "r86400",
) -> List[Dict]:
    return LinkedInSource().scrape_jobs(keywords, location, count, time_filter)
