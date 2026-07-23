import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import {
  getJobHunterJobs,
  getJobHunterSummary,
} from '../services/jobHunterService'

const router = Router()
router.use(authenticate)

const CACHE_TTL_MS = 60_000
const RECENT_JOBS_LIMIT = 100

type CacheEntry = {
  expiresAt: number
  value: unknown
}

const commandCenterCache = new Map<string, CacheEntry>()

function cacheKey(userId: string) {
  return `command-center:${userId}`
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeLabel(value?: string | null) {
  return String(value || '').trim()
}

function cityFromLocation(location?: string | null) {
  const raw = normalizeLabel(location)
  if (!raw) return 'Unknown'
  if (/remote/i.test(raw)) return 'Remote'
  return raw.split(',')[0]?.trim() || raw
}

async function savedSearchDashboardState(userId: string) {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [total, enabled, pendingAlerts, jobsMatchingToday] = await Promise.all([
    prisma.savedSearch.count({ where: { userId } }),
    prisma.savedSearch.count({ where: { userId, enabled: true } }),
    prisma.savedSearchAlert.count({
      where: { savedSearch: { userId }, notifiedAt: null },
    }),
    prisma.savedSearchAlert.count({
      where: { savedSearch: { userId }, matchedAt: { gte: startOfDay } },
    }),
  ])

  return {
    total,
    enabled,
    jobsMatchingToday,
    pendingAlerts,
    alertStatus: enabled > 0 ? 'active' : 'paused',
  }
}

async function buildCommandCenter(userId: string) {
  const savedSearchStatePromise = savedSearchDashboardState(userId).catch(error => {
    console.warn('Saved search evaluation unavailable for command center:', error)
    return {
      total: 0,
      enabled: 0,
      jobsMatchingToday: 0,
      pendingAlerts: 0,
      alertStatus: 'unavailable',
    }
  })

  const [summary, recentJobsResponse, user, pipelineGrouped, recentApplications, savedSearchState] = await Promise.all([
    getJobHunterSummary(),
    getJobHunterJobs({ page: 1, limit: RECENT_JOBS_LIMIT, sort: 'first_seen_desc' }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        resumeText: true,
        resumeUrl: true,
        searches: {
          where: { isActive: true },
          select: { role: true, location: true },
        },
      },
    }),
    prisma.jobApplication.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    }),
    prisma.jobApplication.findMany({
      where: {
        userId,
        OR: [
          { appliedDate: { not: null } },
          { status: { in: ['INTERVIEW', 'OFFER', 'REJECTED'] } },
        ],
      },
      orderBy: [
        { appliedDate: 'desc' },
        { lastUpdated: 'desc' },
      ],
      take: 8,
      select: {
        id: true,
        externalJobId: true,
        title: true,
        company: true,
        status: true,
        appliedDate: true,
        lastUpdated: true,
        jobUrl: true,
      },
    }),
    savedSearchStatePromise,
  ])
  const recentJobs: any[] = recentJobsResponse?.items || []

  const pipeline = {
    SAVED: 0,
    APPLIED: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0,
  }

  for (const row of pipelineGrouped) {
    if (row.status in pipeline) {
      pipeline[row.status as keyof typeof pipeline] = row._count.status
    }
  }

  const workModeCounts = new Map<string, number>(
    (summary?.jobs_by_work_mode || []).map((row: any) => [normalizeLabel(row.label), Number(row.count) || 0]),
  )
  const now = Date.now()
  const locationRows = (summary?.jobs_by_location || []).map((row: any) => ({
    label: cityFromLocation(row.label),
    count: Number(row.count) || 0,
  }))
  const locationCounts = new Map<string, number>()
  for (const row of locationRows) {
    locationCounts.set(row.label, (locationCounts.get(row.label) || 0) + row.count)
  }
  const jobsByCity = Array.from(locationCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)

  return {
    generated_at: new Date(now).toISOString(),
    scoring_mode: 'global_discovery_rank',
    overview: {
      total_jobs: Number(summary?.valid_jobs || summary?.total_jobs || 0),
      new_today: Number(summary?.new_today || 0),
      companies: Number(summary?.companies || 0),
      sources: Number(summary?.sources || 0),
      remote: workModeCounts.get('Remote') || 0,
      hybrid: workModeCounts.get('Hybrid') || 0,
      onsite: workModeCounts.get('On-site') || 0,
    },
    pipeline,
    saved_searches: {
      total: savedSearchState.total,
      enabled: savedSearchState.enabled,
      jobs_matching_today: savedSearchState.jobsMatchingToday,
      alert_status: savedSearchState.alertStatus,
      pending_alerts: savedSearchState.pendingAlerts,
    },
    charts: {
      jobs_over_time: summary?.jobs_over_time || [],
      jobs_by_source: (summary?.jobs_by_source || []).slice(0, 10),
      jobs_by_city: jobsByCity.slice(0, 10),
      jobs_by_category: (summary?.jobs_by_category || []).slice(0, 10),
      jobs_by_work_mode: (summary?.jobs_by_work_mode || []).slice(0, 10),
      match_score_distribution: summary?.score_distribution || [],
    },
    recent_activity: {
      newly_discovered_jobs: recentJobs
        .filter(job => parseDate(job.first_seen))
        .sort((left, right) => (parseDate(right.first_seen)?.getTime() || 0) - (parseDate(left.first_seen)?.getTime() || 0))
        .slice(0, 8)
        .map(job => ({
          id: job.id,
          title: job.title,
          company: job.company,
          source: job.source,
          location: job.location,
          timestamp: job.first_seen || job.posted || null,
          link: job.link,
        })),
      recently_applied_jobs: recentApplications.map(application => ({
        id: application.id,
        job_id: application.externalJobId,
        title: application.title,
        company: application.company,
        status: application.status,
        timestamp: application.appliedDate || application.lastUpdated,
        link: application.jobUrl,
      })),
      resume_uploads: user?.resumeText?.trim()
        ? [{
            id: `resume-${user.id}`,
            label: 'Resume profile updated',
            detail: user.resumeUrl ? 'Uploaded resume on file' : 'Resume text saved in profile',
            timestamp: user.updatedAt,
          }]
        : [],
    },
  }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  const startedAt = performance.now()
  try {
    const userId = req.user!.userId
    const key = cacheKey(userId)
    const cached = commandCenterCache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.value)
      return
    }

    const payload = await buildCommandCenter(userId)
    commandCenterCache.set(key, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value: payload,
    })

    const durationMs = Math.round(performance.now() - startedAt)
    res.setHeader('Server-Timing', `command-center;dur=${durationMs}`)
    console.info(`[timing] command-center user=${userId} duration_ms=${durationMs}`)
    res.json(payload)
  } catch (error) {
    console.error('Command center error:', error)
    res.status(500).json({ error: 'Unable to build job command center' })
  }
})

export default router
