import axios from 'axios'

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:8001'
const NLP_URL     = process.env.NLP_URL     || 'http://localhost:8002'

// ── SCRAPE JOBS ──
// Calls the Python scraper microservice
export async function scrapeJobs(
  searches: { role: string; location: string }[],
  countPerSearch: number = 15,
) {
  const response = await axios.post(`${SCRAPER_URL}/scrape`, {
    searches,
    count_per_search:   countPerSearch,
    fetch_descriptions: true,
  })
  return response.data.jobs
}

// ── SCORE JOBS ──
// Calls the Python NLP microservice
export async function scoreJobs(
  jobs:           any[],
  resumeText:     string,
  candidateYears: number = 1.5,
) {
  const response = await axios.post(`${NLP_URL}/score/batch`, {
    resume_text:     resumeText,
    jobs,
    candidate_years: candidateYears,
  })
  return response.data.jobs
}

// ── CHECK SERVICES ──
// Verify both Python services are running
export async function checkServices() {
  const [scraper, nlp] = await Promise.allSettled([
    axios.get(`${SCRAPER_URL}/health`),
    axios.get(`${NLP_URL}/health`),
  ])

  return {
    scraper: scraper.status === 'fulfilled' ? 'ok' : 'down',
    nlp:     nlp.status     === 'fulfilled' ? 'ok' : 'down',
  }
}