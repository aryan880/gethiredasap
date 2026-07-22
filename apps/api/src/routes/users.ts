import { Router, Response } from 'express'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { cleanString } from '../middleware/security'
import { clearPersonalizedMatchesCache } from '../services/jobHunterService'

const router = Router()

// All user routes require authentication
// authenticate middleware runs first on every route
router.use(authenticate)

// ── GET PROFILE ──
// GET /users/me
// Returns full user profile including their active job searches
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        tierExpiresAt: true,
        threshold: true,
        intervalMinutes: true,
        isActive: true,
        resumeText: true,
        createdAt: true,
        // Also fetch their active job searches in one query
        searches: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            location: true,
            createdAt: true,
          },
        },
      },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ user })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── UPDATE PROFILE ──
// PUT /users/me
// Update name, threshold, interval, or active status
router.put('/me', async (req: AuthRequest, res: Response) => {
  try {
    const name = req.body.name === undefined ? undefined : cleanString(req.body.name, 80)
    const threshold = req.body.threshold
    const intervalMinutes = req.body.intervalMinutes
    const isActive = req.body.isActive

    // Validate threshold if provided
    if (threshold !== undefined) {
      const numericThreshold = Number(threshold)
      if (!Number.isFinite(numericThreshold) || numericThreshold < 5 || numericThreshold > 80) {
        res.status(400).json({ error: 'Threshold must be between 5 and 80' })
        return
      }
    }

    // Validate interval if provided
    if (intervalMinutes !== undefined) {
      const numericInterval = Number(intervalMinutes)
      if (!Number.isFinite(numericInterval) || numericInterval < 5 || numericInterval > 60) {
        res.status(400).json({ error: 'Interval must be between 5 and 60 minutes' })
        return
      }
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive must be boolean' })
      return
    }

    // Only update fields that were actually sent
    // The spread operator (...) skips undefined values
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name && { name }),
        ...(threshold !== undefined && { threshold: Number(threshold) }),
        ...(intervalMinutes !== undefined && { intervalMinutes: Number(intervalMinutes) }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        threshold: true,
        intervalMinutes: true,
        isActive: true,
      },
    })

    res.json({ message: 'Profile updated successfully', user })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── SAVE RESUME ──
// POST /users/resume
// Saves the user's resume text for NLP job matching
router.post('/resume', async (req: AuthRequest, res: Response) => {
  try {
    const resumeText = typeof req.body.resumeText === 'string' ? req.body.resumeText.trim() : ''

    if (!resumeText) {
      res.status(400).json({ error: 'Resume text is required' })
      return
    }

    if (resumeText.length < 50) {
      res.status(400).json({
        error: 'Resume too short — paste more detail for better job matching',
      })
      return
    }

    if (resumeText.length > 100_000) {
      res.status(400).json({ error: 'Resume text is too long' })
      return
    }

    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { resumeText },
    })

    clearPersonalizedMatchesCache(req.user!.userId)

    res.json({
      message: 'Resume saved successfully',
      length: resumeText.length,
    })
  } catch (error) {
    console.error('Save resume error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET JOB SEARCHES ──
// GET /users/searches
// Returns all active job searches for this user
router.get('/searches', async (req: AuthRequest, res: Response) => {
  try {
    const searches = await prisma.jobSearch.findMany({
      where: {
        userId: req.user!.userId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ searches })
  } catch (error) {
    console.error('Get searches error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── ADD JOB SEARCH ──
// POST /users/searches
// Adds a new role + location combination to search
router.post('/searches', async (req: AuthRequest, res: Response) => {
  try {
    const role = cleanString(req.body.role, 120)
    const location = cleanString(req.body.location, 120)

    if (!role || !location) {
      res.status(400).json({ error: 'Role and location are required' })
      return
    }

    if (role.length < 2 || location.length < 2) {
      res.status(400).json({ error: 'Role must be at least 2 characters' })
      return
    }

    // Check for duplicate search
    const existing = await prisma.jobSearch.findFirst({
      where: {
        userId: req.user!.userId,
        role: role.toLowerCase().trim(),
        location: location.toLowerCase().trim(),
        isActive: true,
      },
    })

    if (existing) {
      res.status(409).json({ error: 'You already have this search' })
      return
    }

    const search = await prisma.jobSearch.create({
      data: {
        userId: req.user!.userId,
        role: role.toLowerCase().trim(),
        location: location.trim(),
      },
    })

    res.status(201).json({ message: 'Search added successfully', search })
  } catch (error) {
    console.error('Add search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── DELETE JOB SEARCH ──
// DELETE /users/searches/:id
// Soft deletes a search (sets isActive to false, keeps the record)
router.delete('/searches/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Verify the search belongs to this user
    // Prevents users from deleting other users' searches
    const search = await prisma.jobSearch.findFirst({
      where: {
        id: String(req.params.id),
        userId: req.user!.userId,
      },
    })

    if (!search) {
      res.status(404).json({ error: 'Search not found' })
      return
    }

    // Soft delete — keep the record but mark as inactive
    // Why? So we can analyse what searches users had historically
    await prisma.jobSearch.update({
      where: { id: String(req.params.id) },
      data: { isActive: false },
    })

    res.json({ message: 'Search removed successfully' })
  } catch (error) {
    console.error('Delete search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET STATS ──
// GET /users/stats
// Returns user's job matching statistics
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId

    // Count total jobs seen
    const totalSeen = await prisma.jobMatch.count({
      where: { userId },
    })

    // Count jobs alerted
    const totalAlerted = await prisma.jobMatch.count({
      where: { userId, alertedAt: { not: null } },
    })

    // Count early career jobs
    const earlyCareer = await prisma.jobMatch.count({
      where: { userId, isEarlyCareer: true },
    })

    // Get top 5 highest scoring matches
    const topMatches = await prisma.jobMatch.findMany({
      where: { userId },
      orderBy: { score: 'desc' },
      take: 5,
      include: {
        job: {
          select: {
            title: true,
            company: true,
            location: true,
            link: true,
          },
        },
      },
    })

    res.json({
      stats: {
        totalSeen,
        totalAlerted,
        earlyCareer,
        topMatches,
      },
    })
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
