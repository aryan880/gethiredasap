import axios from 'axios'
import { useAuthStore } from '@/lib/store'

const productionApiUrl = '/api'
const localApiUrl = 'http://localhost:3001'

const isLocalBrowserHost =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)

const fallbackApiUrl = isLocalBrowserHost
  ? localApiUrl
  : productionApiUrl

const api = axios.create({
  baseURL: fallbackApiUrl,
  headers: { 'Content-Type': 'application/json' },
})

function isAuthEndpoint(url?: string) {
  if (!url) return false
  return [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
  ].some(path => url.includes(path))
}

export type JobHunterJobsQuery = {
  page?: number
  limit?: number
  offset?: number
  source?: string
  category?: string
  priority?: string
  status?: string
  work_mode?: string
  q?: string
  sort?: string
}

export function normalizeJobHunterQuery(query: JobHunterJobsQuery = {}) {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([left], [right]) => left.localeCompare(right)),
  ) as JobHunterJobsQuery
}

export const DEFAULT_PERSONALIZED_MATCHES_QUERY: JobHunterJobsQuery = {
  limit: 100,
}

export const jobHunterQueryKeys = {
  personalizedMatchesRoot: ['job-hunter-matches'] as const,
  personalizedMatches: (query: JobHunterJobsQuery = DEFAULT_PERSONALIZED_MATCHES_QUERY) => (
    ['job-hunter-matches', normalizeJobHunterQuery(query)] as const
  ),
}

export function getJobHunterHealth() {
  return api.get('/api/job-hunter/health').then(response => response.data)
}

export function getJobHunterSummary() {
  return api.get('/api/job-hunter/summary').then(response => response.data)
}

export function refreshJobHunter() {
  return api.post('/api/job-hunter/refresh').then(response => response.data)
}

export function getJobHunterCommandCenter() {
  return api.get('/api/job-hunter/command-center').then(response => response.data)
}

export function getJobHunterJobs(query: JobHunterJobsQuery = {}) {
  return api.get('/api/job-hunter/jobs', { params: query }).then(response => response.data)
}

export function getJobHunterMatches(query: JobHunterJobsQuery = {}) {
  return api.get('/api/job-hunter/matches', { params: query }).then(response => response.data)
}

export function getJobHunterJob(id: string) {
  return api.get(`/api/job-hunter/jobs/${encodeURIComponent(id)}`).then(response => response.data)
}

export function getJobHunterResumeGap(id: string) {
  return api.get(`/api/job-hunter/jobs/${encodeURIComponent(id)}/resume-gap`).then(response => response.data)
}

export function getApplicationStats() {
  return api.get('/api/applications/stats').then(response => response.data)
}

export function getSavedSearches() {
  return api.get('/api/saved-searches').then(response => response.data)
}

export function getSavedSearch(id: string) {
  return api.get(`/api/saved-searches/${encodeURIComponent(id)}`).then(response => response.data)
}

export function getSavedSearchJobs(id: string, query: JobHunterJobsQuery = {}) {
  return api.get(`/api/saved-searches/${encodeURIComponent(id)}/jobs`, { params: query }).then(response => response.data)
}

export function createSavedSearch(payload: Record<string, unknown>) {
  return api.post('/api/saved-searches', payload).then(response => response.data)
}

export function updateSavedSearch(id: string, payload: Record<string, unknown>) {
  return api.patch(`/api/saved-searches/${encodeURIComponent(id)}`, payload).then(response => response.data)
}

export function deleteSavedSearch(id: string) {
  return api.delete(`/api/saved-searches/${encodeURIComponent(id)}`).then(response => response.data)
}

export function updateApplicationStatus(jobId: string, payload: {
  status: 'NEW' | 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED'
  source?: string
  title?: string
  company?: string
  location?: string
  job_url?: string
  recruiter_name?: string
  recruiter_email?: string
  follow_up_notes?: string
}) {
  return api.patch(`/api/applications/${encodeURIComponent(jobId)}`, payload).then(response => response.data)
}

// Automatically attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto logout if token expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthEndpoint(error.config?.url)) {
      useAuthStore.getState().clearAuth()
      if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
