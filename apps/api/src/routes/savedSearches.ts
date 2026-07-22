import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { evaluateSavedSearchesForUser, getSavedSearchById, getSavedSearchMatches, validateSavedSearchInput } from '../services/savedSearchService'

const router = Router()
router.use(authenticate)

async function workflowByJobId(userId: string, jobIds: string[]) {
  const uniqueIds = Array.from(new Set(jobIds.filter(Boolean)))
  if (!uniqueIds.length) return new Map<string, any>()

  const applications = await prisma.jobApplication.findMany({
    where: {
      userId,
      externalJobId: { in: uniqueIds },
    },
  })

  return new Map(applications.map(application => [application.externalJobId, {
    status: application?.status || 'NEW',
    recruiter_name: application?.recruiterName || null,
    recruiter_email: application?.recruiterEmail || null,
    follow_up_notes: application?.followUpNotes || null,
    applied_date: application?.appliedDate || null,
    last_updated: application?.lastUpdated || null,
  }]))
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const payload = await evaluateSavedSearchesForUser(req.user!.userId)
    res.json(payload)
  } catch (error) {
    console.error('Get saved searches error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const payload = await evaluateSavedSearchesForUser(req.user!.userId)
    const search = payload.searches.find(item => item.id === String(req.params.id))
    if (!search) {
      res.status(404).json({ error: 'Saved search not found' })
      return
    }
    res.json({ search })
  } catch (error) {
    console.error('Get saved search detail error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id/jobs', async (req: AuthRequest, res: Response) => {
  try {
    const raw = await getSavedSearchMatches(req.user!.userId, String(req.params.id), req.query as any)
    const workflows = await workflowByJobId(
      req.user!.userId,
      (raw.items || []).map((item: any) => String(item.id)).filter(Boolean),
    )

    res.json({
      ...raw,
      items: (raw.items || []).map((item: any) => ({
        ...item,
        workflow: workflows.get(String(item.id)) || item.workflow || {
          status: 'NEW',
          recruiter_name: null,
          recruiter_email: null,
          follow_up_notes: null,
          applied_date: null,
          last_updated: null,
        },
      })),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Saved search not found') {
      res.status(404).json({ error: error.message })
      return
    }
    console.error('Get saved search jobs error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const input = validateSavedSearchInput(req.body || {})
    const search = await prisma.savedSearch.create({
      data: {
        userId: req.user!.userId,
        name: input.name,
        keywords: input.keywords,
        location: input.location,
        category: input.category,
        workMode: input.workMode,
        minimumMatchScore: input.minimumMatchScore,
        companies: input.companies,
        sources: input.sources,
        frequency: input.frequency,
        matchMode: input.matchMode,
        excludeSeniorRoles: input.excludeSeniorRoles,
        preferJuniorRoles: input.preferJuniorRoles,
        excludeContract: input.excludeContract,
        excludeStaffingAgencies: input.excludeStaffingAgencies,
        enabled: input.enabled,
      },
    })

    res.status(201).json({ search })
  } catch (error: any) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Create saved search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.savedSearch.findFirst({
      where: { id: String(req.params.id), userId: req.user!.userId },
    })

    if (!existing) {
      res.status(404).json({ error: 'Saved search not found' })
      return
    }

    const merged = validateSavedSearchInput({
      name: req.body.name ?? existing.name,
      keywords: req.body.keywords ?? existing.keywords,
      location: req.body.location ?? existing.location,
      category: req.body.category ?? existing.category,
      workMode: req.body.workMode ?? existing.workMode,
      minimumMatchScore: req.body.minimumMatchScore ?? existing.minimumMatchScore,
      companies: req.body.companies ?? existing.companies,
      sources: req.body.sources ?? existing.sources,
      frequency: req.body.frequency ?? existing.frequency,
      matchMode: req.body.matchMode ?? existing.matchMode,
      excludeSeniorRoles: req.body.excludeSeniorRoles ?? existing.excludeSeniorRoles,
      preferJuniorRoles: req.body.preferJuniorRoles ?? existing.preferJuniorRoles,
      excludeContract: req.body.excludeContract ?? existing.excludeContract,
      excludeStaffingAgencies: req.body.excludeStaffingAgencies ?? existing.excludeStaffingAgencies,
      enabled: req.body.enabled ?? existing.enabled,
    })

    const search = await prisma.savedSearch.update({
      where: { id: existing.id },
      data: {
        name: merged.name,
        keywords: merged.keywords,
        location: merged.location,
        category: merged.category,
        workMode: merged.workMode,
        minimumMatchScore: merged.minimumMatchScore,
        companies: merged.companies,
        sources: merged.sources,
        frequency: merged.frequency,
        matchMode: merged.matchMode,
        excludeSeniorRoles: merged.excludeSeniorRoles,
        preferJuniorRoles: merged.preferJuniorRoles,
        excludeContract: merged.excludeContract,
        excludeStaffingAgencies: merged.excludeStaffingAgencies,
        enabled: merged.enabled,
      },
    })

    res.json({ search })
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Update saved search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.savedSearch.findFirst({
      where: { id: String(req.params.id), userId: req.user!.userId },
    })

    if (!existing) {
      res.status(404).json({ error: 'Saved search not found' })
      return
    }

    await prisma.savedSearch.delete({ where: { id: existing.id } })
    res.json({ message: 'Saved search deleted' })
  } catch (error) {
    console.error('Delete saved search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
