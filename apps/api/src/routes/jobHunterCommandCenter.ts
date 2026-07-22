import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import {
  getJobHunterJobs,
  getJobHunterMatches,
  getJobHunterSummary,
  type JobHunterJob,
  type UserProfileForMatching,
} from '../services/jobHunterService'
import { evaluateSavedSearchesForUser } from '../services/savedSearchService'

const router = Router()
router.use(authenticate)

const CACHE_TTL_MS = 60_000
const PAGE_SIZE = 500
const MAX_PAGES = 12

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

function hoursAgo(hours: number) {
  return Date.now() - (hours * 60 * 60 * 1000)
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

function countBy<T extends string>(values: T[]) {
  const map = new Map<string, number>()
  for (const value of values) {
    const key = normalizeLabel(value) || 'Unknown'
    map.set(key, (map.get(key) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
}

function scoreDistribution(scores: number[]) {
  const buckets = [
    { label: '0-39', min: 0, max: 39, count: 0 },
    { label: '40-59', min: 40, max: 59, count: 0 },
    { label: '60-74', min: 60, max: 74, count: 0 },
    { label: '75-89', min: 75, max: 89, count: 0 },
    { label: '90-100', min: 90, max: 100, count: 0 },
  ]

  for (const score of scores) {
    const numeric = Math.max(0, Math.min(100, Math.round(Number(score) || 0)))
    const bucket = buckets.find(item => numeric >= item.min && numeric <= item.max)
    if (bucket) bucket.count += 1
  }

  return buckets.map(({ label, count }) => ({ label, count }))
}

function jobsOverTime(jobs: any[]) {
  const labels: string[] = []
  const counts = new Map<string, number>()
  for (let day = 13; day >= 0; day -= 1) {
    const date = new Date(Date.now() - (day * 24 * 60 * 60 * 1000))
    const label = date.toISOString().slice(0, 10)
    labels.push(label)
    counts.set(label, 0)
  }

  for (const job of jobs) {
    const date = parseDate(job.first_seen)
    if (!date) continue
    const key = date.toISOString().slice(0, 10)
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }

  return labels.map(label => ({ label, count: counts.get(label) || 0 }))
}

async function fetchAllJobs() {
  const firstPage = await getJobHunterJobs({ page: 1, limit: PAGE_SIZE, sort: 'first_seen_desc' })
  const totalPages = Math.min(
    Number(firstPage?.total_pages || Math.ceil((Number(firstPage?.total) || 0) / PAGE_SIZE) || 1),
    MAX_PAGES,
  )

  const responses = [firstPage]
  if (totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => getJobHunterJobs({
        page: index + 2,
        limit: PAGE_SIZE,
        sort: 'first_seen_desc',
      })),
    )
    responses.push(...remaining)
  }

  const items = responses.flatMap(response => response?.items || [])
  const unique = new Map<string, any>()
  for (const job of items) {
    if (job?.id && !unique.has(job.id)) {
      unique.set(job.id, job)
    }
  }

  return Array.from(unique.values())
}

async function buildCommandCenter(userId: string) {
  const baseSavedSearchState = {
    searches: [],
    summary: {
      total: 0,
      enabled: 0,
      disabled: 0,
      jobsMatchingToday: 0,
      pendingAlerts: 0,
      alertStatus: 'unavailable',
    },
  }

  const savedSearchStatePromise = evaluateSavedSearchesForUser(userId).catch(error => {
    console.warn('Saved search evaluation unavailable for command center:', error)
    return baseSavedSearchState
  })

  const [summary, allJobs, user, pipelineGrouped, recentApplications, savedSearchState] = await Promise.all([
    getJobHunterSummary(),
    fetchAllJobs(),
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

  const companies = new Set(allJobs.map(job => normalizeLabel(job.company)).filter(Boolean)).size
  const sourceCount = new Set(allJobs.map(job => normalizeLabel(job.source)).filter(Boolean)).size
  const remoteCount = allJobs.filter(job => normalizeLabel(job.work_mode) === 'Remote').length
  const hybridCount = allJobs.filter(job => normalizeLabel(job.work_mode) === 'Hybrid').length
  const onsiteCount = allJobs.filter(job => normalizeLabel(job.work_mode) === 'On-site').length
  const now = Date.now()
  const newToday = allJobs.filter(job => {
    const date = parseDate(job.first_seen)
    return date ? date.getTime() >= hoursAgo(24) : false
  }).length

  let matchScores = allJobs.map(job => Number(job.score) || 0)
  let scoringMode = 'global_feed'

  if (user?.resumeText?.trim()) {
    try {
      const matchResponse = await getJobHunterMatches({ limit: 100 }, user as UserProfileForMatching, userId)
      const personalizedScores = (matchResponse?.items || [])
        .map((item: any) => Number(item.final_match_score ?? item.user_match_score ?? item.rule_score ?? 0))
        .filter((value: number) => !Number.isNaN(value))
      if (personalizedScores.length) {
        matchScores = personalizedScores
        scoringMode = String(matchResponse?.scoring_method || 'personalized')
      }
    } catch {
      // Keep global feed distribution if personalized matching is temporarily unavailable.
    }
  }

  return {
    generated_at: new Date(now).toISOString(),
    scoring_mode: scoringMode,
    overview: {
      total_jobs: Number(summary?.total_jobs || allJobs.length || 0),
      new_today: newToday,
      companies,
      sources: sourceCount,
      remote: remoteCount,
      hybrid: hybridCount,
      onsite: onsiteCount,
    },
    pipeline,
    saved_searches: {
      total: savedSearchState.summary.total,
      enabled: savedSearchState.summary.enabled,
      jobs_matching_today: savedSearchState.summary.jobsMatchingToday,
      alert_status: savedSearchState.summary.alertStatus,
      pending_alerts: savedSearchState.summary.pendingAlerts,
    },
    charts: {
      jobs_over_time: jobsOverTime(allJobs),
      jobs_by_source: (summary?.jobs_by_source || countBy(allJobs.map(job => normalizeLabel(job.source) || 'Unknown'))).slice(0, 10),
      jobs_by_city: countBy(allJobs.map(job => cityFromLocation(job.location))).slice(0, 10),
      jobs_by_category: (summary?.jobs_by_category || countBy(allJobs.map(job => normalizeLabel(job.category) || 'Unknown'))).slice(0, 10),
      jobs_by_work_mode: countBy(allJobs.map(job => normalizeLabel(job.work_mode) || 'Unknown')).slice(0, 10),
      match_score_distribution: scoreDistribution(matchScores),
    },
    recent_activity: {
      newly_discovered_jobs: allJobs
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

    res.json(payload)
  } catch (error) {
    console.error('Command center error:', error)
    res.status(500).json({ error: 'Unable to build job command center' })
  }
})

export default router
