"""
Base contracts for scraper sources.
"""

from abc import ABC, abstractmethod
from typing import Dict, List


class JobSource(ABC):
    """Interface implemented by each job source."""

    name: str

    @abstractmethod
    def scrape_jobs(
        self,
        keywords: str,
        location: str,
        count: int = 15,
        time_filter: str = "r86400",
    ) -> List[Dict]:
        """Fetch jobs for one role/location search."""
