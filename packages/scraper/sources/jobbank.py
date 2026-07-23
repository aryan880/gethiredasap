"""
Job Bank Canada scraper source.
"""

import re
from typing import Dict, List
from urllib.parse import urljoin

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


SOURCE_NAME = "jobbank"
BASE_URL = "https://www.jobbank.gc.ca"
SEARCH_URL = f"{BASE_URL}/jobsearch/jobsearch"


def get_headers() -> Dict:
    return {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-CA,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }


def build_search_url(keywords: str, location: str) -> str:
    params = requests.models.PreparedRequest()
    params.prepare_url(
        SEARCH_URL,
        {
            "searchstring": keywords,
            "locationstring": location,
        },
    )
    return params.url


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def extract_posting_id(link: str) -> str:
    match = re.search(r"/jobsearch/jobposting/(\d+)", link)
    if match:
        return match.group(1)

    match = re.search(r"(\d{6,})", link)
    return match.group(1) if match else ""


def extract_salary(text: str) -> str:
    if not text:
        return ""

    patterns = [
        r"\$[\d,.]+\s*(?:to|-|–)\s*\$[\d,.]+(?:\s*(?:hourly|annually|per\s+hour|per\s+year|a\s+year))?",
        r"\$[\d,.]+(?:\s*(?:hourly|annually|per\s+hour|per\s+year|a\s+year))",
        r"(?:salary|wage|pay)[\s:]+\$[\d,.]+",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return clean_text(match.group(0))

    return ""


def find_first_text(container, selectors: List[str]) -> str:
    for selector in selectors:
        node = container.select_one(selector)
        if node:
            text = clean_text(node.get_text(" ", strip=True))
            if text:
                return text
    return ""


def parse_listing_cards(html: str, fallback_location: str) -> List[Dict]:
    soup = BeautifulSoup(html, "html.parser")
    cards = []

    for link in soup.select('a[href*="/jobsearch/jobposting/"]'):
        card = link.find_parent(["article", "li", "div"]) or link
        href = urljoin(BASE_URL, link.get("href", ""))
        job_id = extract_posting_id(href)
        title = clean_text(link.get_text(" ", strip=True))

        if not job_id or not title:
            continue

        company = find_first_text(
            card,
            [
                ".business",
                ".employer",
                "[data-cy='business-name']",
                "[class*='business']",
                "[class*='employer']",
            ],
        )
        location = find_first_text(
            card,
            [
                ".location",
                "[data-cy='job-location']",
                "[class*='location']",
            ],
        )
        posted = find_first_text(
            card,
            [
                "time",
                ".date",
                "[class*='date']",
                "[class*='posted']",
            ],
        )

        cards.append(
            {
                "id": job_id,
                "source": SOURCE_NAME,
                "title": title,
                "company": company or "N/A",
                "location": location or fallback_location,
                "posted": posted,
                "link": href,
                "description": "",
                "salary": "",
            }
        )

    return cards


def fetch_job_detail(link: str) -> Dict:
    try:
        response = requests.get(link, headers=get_headers(), timeout=15)
        if response.status_code != 200:
            return {"description": "", "salary": ""}

        soup = BeautifulSoup(response.text, "html.parser")
        detail = soup.select_one("#jobdetails, .job-posting-detail, main") or soup
        description = clean_text(detail.get_text(" ", strip=True))
        if len(description) > 3000:
            description = description[:3000]

        return {
            "description": description,
            "salary": extract_salary(description),
        }
    except requests.RequestException:
        return {"description": "", "salary": ""}


class JobBankSource(JobSource):
    name = SOURCE_NAME

    def scrape_jobs(
        self,
        keywords: str,
        location: str,
        count: int = 15,
        time_filter: str = "r86400",
    ) -> List[Dict]:
        jobs = []
        url = build_search_url(keywords, location)

        try:
            response = requests.get(url, headers=get_headers(), timeout=15)
            if response.status_code != 200:
                print(f"  HTTP {response.status_code} for Job Bank '{keywords}' in '{location}'")
                return jobs

            for job in parse_listing_cards(response.text, location)[:count]:
                if job["link"] != "#":
                    detail = fetch_job_detail(job["link"])
                    job["description"] = detail["description"]
                    job["salary"] = detail["salary"]

                jobs.append(normalize_job(job, self.name))

        except requests.RequestException as e:
            print(f"  Job Bank request failed: {e}")

        return jobs


def scrape_jobs(
    keywords: str,
    location: str,
    count: int = 15,
    time_filter: str = "r86400",
) -> List[Dict]:
    return JobBankSource().scrape_jobs(keywords, location, count, time_filter)
