import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

router.use(authenticate)

// ── GET MATCHED JOBS ──
// GET /jobs
// Returns all jobs matched to this user, newest first
// Supports pagination and filtering
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId

    // Pagination — default page 1, 20 jobs per page
    const page  = Number(req.query.page)  || 1
    const limit = Number(req.query.limit) || 20
    const skip  = (page - 1) * limit

    // Optional filters from query params
    // e.g. GET /jobs?earlyCareer=true&minScore=50
    const earlyCareer = req.query.earlyCareer === 'true'
    const minScore    = Number(req.query.minScore) || 0

    const where = {
      userId,
      score:        { gte: minScore },
      ...(earlyCareer && { isEarlyCareer: true }),
    }

    // Run both queries in parallel for speed
    // Promise.all waits for both to finish
    const [matches, total] = await Promise.all([
      prisma.jobMatch.findMany({
        where,
        orderBy: [
          { isEarlyCareer: 'desc' }, // early career jobs first
          { score: 'desc' },         // then by score
          { seenAt: 'desc' },        // then newest first
        ],
        skip,
        take: limit,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              company: true,
              location: true,
              postedAt: true,
              link: true,
              salary: true,
              description: true,
            },
          },
        },
      }),
      prisma.jobMatch.count({ where }),
    ])

    res.json({
      jobs: matches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    })
  } catch (error) {
    console.error('Get jobs error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET TOP MATCHES ──
// GET /jobs/top
// Returns user's top 10 highest scoring job matches ever
router.get('/top', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const limit  = Number(req.query.limit) || 10

    const topMatches = await prisma.jobMatch.findMany({
      where: { userId },
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            link: true,
            salary: true,
            postedAt: true,
          },
        },
      },
    })

    res.json({ jobs: topMatches })
  } catch (error) {
    console.error('Get top jobs error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET SINGLE JOB ──
// GET /jobs/:id
// Returns full details of a specific job match
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const match = await prisma.jobMatch.findFirst({
      where: {
        id: String(req.params.id),
        userId: req.user!.userId,
      },
      include: {
        job: true, // include full job details
      },
    })

    if (!match) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    res.json({ job: match })
  } catch (error) {
    console.error('Get job error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router