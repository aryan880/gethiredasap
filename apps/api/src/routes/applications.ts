import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { cleanString, isEmail } from '../middleware/security'
import { clearPersonalizedMatchesCache } from '../services/jobHunterService'

const router = Router()

router.use(authenticate)

const ALLOWED_STATUSES = new Set(['NEW', 'SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'])

function normalizeStatus(value: unknown) {
  const status = String(value || '').trim().toUpperCase()
  return ALLOWED_STATUSES.has(status) ? status : null
}

function applicationResponse(application: any) {
  if (!application) return null
  return {
    id: application.id,
    job_id: application.externalJobId,
    status: application.status,
    recruiter_name: application.recruiterName,
    recruiter_email: application.recruiterEmail,
    follow_up_notes: application.followUpNotes,
    applied_date: application.appliedDate,
    last_updated: application.lastUpdated,
  }
}

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const grouped = await prisma.jobApplication.groupBy({
      by: ['status'],
      where: { userId: req.user!.userId },
      _count: { status: true },
    })

    const counts = {
      NEW: 0,
      SAVED: 0,
      APPLIED: 0,
      INTERVIEW: 0,
      OFFER: 0,
      REJECTED: 0,
    }

    for (const row of grouped) {
      counts[row.status] = row._count.status
    }

    res.json({ counts })
  } catch (error) {
    console.error('Application stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:jobId', async (req: AuthRequest, res: Response) => {
  try {
    const externalJobId = String(req.params.jobId)
    const status = normalizeStatus(req.body.status)
    const hasRecruiterName = Object.prototype.hasOwnProperty.call(req.body, 'recruiter_name')
    const hasRecruiterEmail = Object.prototype.hasOwnProperty.call(req.body, 'recruiter_email')
    const hasFollowUpNotes = Object.prototype.hasOwnProperty.call(req.body, 'follow_up_notes')
    const recruiterName = hasRecruiterName ? cleanString(req.body.recruiter_name, 120) || null : undefined
    const recruiterEmail = hasRecruiterEmail ? cleanString(req.body.recruiter_email, 254) || null : undefined
    const followUpNotes = hasFollowUpNotes ? cleanString(req.body.follow_up_notes, 5000) || null : undefined

    if (typeof recruiterEmail === 'string' && recruiterEmail && !isEmail(recruiterEmail)) {
      res.status(400).json({ error: 'Invalid recruiter email' })
      return
    }

    if (!status) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    if (!externalJobId || externalJobId.length > 128) {
      res.status(400).json({ error: 'Invalid job id' })
      return
    }

    const existing = await prisma.jobApplication.findUnique({
      where: {
        userId_externalJobId: {
          userId: req.user!.userId,
          externalJobId,
        },
      },
    })

    const appliedDate =
      status === 'APPLIED' && !existing?.appliedDate
        ? new Date()
        : existing?.appliedDate

    const application = await prisma.jobApplication.upsert({
      where: {
        userId_externalJobId: {
          userId: req.user!.userId,
          externalJobId,
        },
      },
      create: {
        userId: req.user!.userId,
        externalJobId,
        status: status as any,
        source: cleanString(req.body.source, 80) || null,
        title: cleanString(req.body.title, 300) || null,
        company: cleanString(req.body.company, 200) || null,
        location: cleanString(req.body.location, 200) || null,
        jobUrl: cleanString(req.body.job_url || req.body.link, 2000) || null,
        recruiterName: recruiterName || null,
        recruiterEmail: recruiterEmail || null,
        followUpNotes: followUpNotes || null,
        appliedDate: status === 'APPLIED' ? new Date() : null,
      },
      update: {
        status: status as any,
        source: cleanString(req.body.source, 80) || existing?.source,
        title: cleanString(req.body.title, 300) || existing?.title,
        company: cleanString(req.body.company, 200) || existing?.company,
        location: cleanString(req.body.location, 200) || existing?.location,
        jobUrl: cleanString(req.body.job_url || req.body.link, 2000) || existing?.jobUrl,
        ...(hasRecruiterName && { recruiterName }),
        ...(hasRecruiterEmail && { recruiterEmail }),
        ...(hasFollowUpNotes && { followUpNotes }),
        appliedDate,
      },
    })

    clearPersonalizedMatchesCache(req.user!.userId)

    res.json({ application: applicationResponse(application) })
  } catch (error) {
    console.error('Update application error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
