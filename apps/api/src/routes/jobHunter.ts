import { Router, Response } from 'express'
import {
  analyzeResumeGap,
  clearPersonalizedMatchesCache,
  getJobHunterHealth,
  getJobHunterJob,
  getJobHunterJobs,
  getJobHunterMatches,
  getJobHunterSummary,
  JobHunterJobsQuery,
  runJobHunterRefresh,
} from '../services/jobHunterService'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { getCandidateMatchingProfile } from '../services/candidateProfileService'

const router = Router()

router.use(authenticate)

function startedAt() {
  return Date.now()
}

function logTiming(route: string, start: number, details?: Record<string, unknown>) {
  const suffix = details ? ` ${JSON.stringify(details)}` : ''
  console.info(`[timing] ${route} ${Date.now() - start}ms${suffix}`)
}

function workflowResponse(application: any) {
  return {
    status: application?.status || 'NEW',
    recruiter_name: application?.recruiterName || null,
    recruiter_email: application?.recruiterEmail || null,
    follow_up_notes: application?.followUpNotes || null,
    applied_date: application?.appliedDate || null,
    last_updated: application?.lastUpdated || null,
  }
}

async function workflowByJobId(userId: string, jobIds: string[]) {
  const uniqueIds = Array.from(new Set(jobIds.filter(Boolean)))
  if (!uniqueIds.length) return new Map<string, any>()

  const applications = await prisma.jobApplication.findMany({
    where: {
      userId,
      externalJobId: { in: uniqueIds },
    },
  })

  return new Map(applications.map(application => [application.externalJobId, application]))
}

async function enrichJobsResponse(data: any, userId: string) {
  const items = data?.items || []
  const ids = items.map((item: any) => item.id).filter(Boolean)
  const workflows = await workflowByJobId(userId, ids)

  return {
    ...data,
    items: items.map((item: any) => ({
      ...item,
      workflow: workflowResponse(workflows.get(item.id)),
    })),
  }
}

async function enrichMatchesResponse(data: any, userId: string) {
  const items = data?.items || []
  const ids = items.map((item: any) => item.job?.id).filter(Boolean)
  const workflows = await workflowByJobId(userId, ids)

  return {
    ...data,
    items: items.map((item: any) => ({
      ...item,
      job: {
        ...item.job,
        workflow: workflowResponse(workflows.get(item.job?.id)),
      },
    })),
  }
}

async function enrichJobResponse(data: any, userId: string) {
  const application = await prisma.jobApplication.findUnique({
    where: {
      userId_externalJobId: {
        userId,
        externalJobId: data.id,
      },
    },
  })

  return {
    ...data,
    workflow: workflowResponse(application),
  }
}

function handleProxyError(error: any, res: Response) {
  const status = error.response?.status || 502
  console.error('AI Job Hunter proxy failure:', {
    status,
    message: error.message,
  })
  res.status(status).json({
    error: status >= 500 ? 'AI Job Hunter service unavailable' : 'AI Job Hunter request failed',
  })
}

router.get('/health', async (_req, res) => {
  const start = startedAt()
  try {
    const data = await getJobHunterHealth()
    logTiming('job-hunter.health', start)
    res.json(data)
  } catch (error) {
    logTiming('job-hunter.health.error', start)
    handleProxyError(error, res)
  }
})

router.get('/summary', async (_req, res) => {
  const start = startedAt()
  try {
    const data = await getJobHunterSummary()
    logTiming('job-hunter.summary', start)
    res.json(data)
  } catch (error) {
    logTiming('job-hunter.summary.error', start)
    handleProxyError(error, res)
  }
})

router.get('/jobs', async (req: AuthRequest, res) => {
  const start = startedAt()
  try {
    const data = await getJobHunterJobs(req.query as JobHunterJobsQuery)
    const response = await enrichJobsResponse(data, req.user!.userId)
    logTiming('job-hunter.jobs', start, {
      total: response?.total ?? response?.items?.length ?? 0,
      page: response?.page ?? null,
      limit: response?.limit ?? null,
    })
    res.json(response)
  } catch (error) {
    logTiming('job-hunter.jobs.error', start)
    handleProxyError(error, res)
  }
})


router.post('/refresh', async (req: AuthRequest, res) => {
  const start = startedAt()
  try {
    clearPersonalizedMatchesCache(req.user!.userId)
    const health = await getJobHunterHealth()
    logTiming('job-hunter.refresh', start)
    res.json({
      status: 'ok',
      message: 'Feed refreshed from the latest discovery data.',
      total_jobs: health?.total_jobs ?? null,
    })
  } catch (error) {
    logTiming('job-hunter.refresh.error', start)
    handleProxyError(error, res)
  }
})

router.post('/refresh-sources', async (req: AuthRequest, res) => {
  const start = startedAt()
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }
  try {
    const data = await runJobHunterRefresh()
    clearPersonalizedMatchesCache()
    logTiming('job-hunter.refresh-sources', start, {
      inserted_new_jobs: data?.inserted_new_jobs ?? null,
      updated_existing_jobs: data?.updated_existing_jobs ?? null,
    })
    res.json(data)
  } catch (error) {
    logTiming('job-hunter.refresh-sources.error', start)
    handleProxyError(error, res)
  }
})

router.get('/matches', async (req: AuthRequest, res) => {
  const start = startedAt()
  try {
    const { resume_family: resumeFamily, ...jobQuery } = req.query
    const candidate = await getCandidateMatchingProfile(req.user!.userId, resumeFamily)

    if (!candidate) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const data = await getJobHunterMatches(jobQuery as JobHunterJobsQuery, candidate.profile, req.user!.userId)
    const response = await enrichMatchesResponse(data, req.user!.userId)
    logTiming('job-hunter.matches', start, {
      total: response?.total ?? response?.items?.length ?? 0,
      page: response?.page ?? null,
      limit: response?.limit ?? null,
      scoring_method: response?.scoring_method ?? null,
    })
    res.json({ ...response, resume_profile: candidate.selection })
  } catch (error) {
    logTiming('job-hunter.matches.error', start)
    handleProxyError(error, res)
  }
})

router.get('/jobs/:id/resume-gap', async (req: AuthRequest, res) => {
  try {
    const candidate = await getCandidateMatchingProfile(req.user!.userId, req.query.resume_family)

    if (!candidate) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const analysis = await analyzeResumeGap(String(req.params.id), candidate.profile)
    res.json({ ...analysis, resume_profile: candidate.selection })
  } catch (error) {
    handleProxyError(error, res)
  }
})

router.get('/jobs/:id', async (req: AuthRequest, res) => {
  try {
    const data = await getJobHunterJob(String(req.params.id))
    res.json(await enrichJobResponse(data, req.user!.userId))
  } catch (error) {
    handleProxyError(error, res)
  }
})

export default router
