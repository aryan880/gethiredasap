import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../config/database'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt'
import { authenticate, AuthRequest } from '../middleware/auth'
import {
  authAttemptRateLimit,
  authRefreshRateLimit,
  cleanString,
  isEmail,
} from '../middleware/security'

const router = Router()

// ── REGISTER ──
// POST /auth/register
// Creates a new user account
router.post('/register', authAttemptRateLimit, async (req: Request, res: Response) => {
  try {
    const email = cleanString(req.body.email, 254).toLowerCase()
    const password = typeof req.body.password === 'string' ? req.body.password : ''
    const name = cleanString(req.body.name, 80)

    // Validate input
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password and name are required' })
      return
    }

    if (!isEmail(email)) {
      res.status(400).json({ error: 'Invalid email address' })
      return
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters' })
      return
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    // Hash the password
    // Never store plain text passwords!
    // bcrypt adds a "salt" so even identical passwords hash differently
    const passwordHash = await bcrypt.hash(password, 12)
    // 12 = how many rounds of hashing (higher = slower but more secure)

    // Create the user in database
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        tierExpiresAt: true,
        threshold: true,
        intervalMinutes: true,
        isActive: true,
        isAdmin: true,
        resumeText: true,
        createdAt: true,
      },
    })

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
      isAdmin: user.isAdmin,
    })

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
      isAdmin: user.isAdmin,
    })

    res.status(201).json({
      message: 'Account created successfully',
      user,
      accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── LOGIN ──
// POST /auth/login
// Authenticates user and returns tokens
router.post('/login', authAttemptRateLimit, async (req: Request, res: Response) => {
  try {
    const email = cleanString(req.body.email, 254).toLowerCase()
    const password = typeof req.body.password === 'string' ? req.body.password : ''

    if (!email || !password || !isEmail(email) || password.length > 128) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // Use same error message for wrong email OR wrong password
      // This prevents attackers from knowing which one was wrong
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    // Compare password with stored hash
    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
      isAdmin: user.isAdmin,
    })

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
      isAdmin: user.isAdmin,
    })

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        tierExpiresAt: user.tierExpiresAt,
        threshold: user.threshold,
        intervalMinutes: user.intervalMinutes,
        isActive: user.isActive,
        isAdmin: user.isAdmin,
        resumeText: user.resumeText,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── REFRESH TOKEN ──
// POST /auth/refresh
// Gets a new access token using a refresh token
router.post('/refresh', authRefreshRateLimit, async (req: Request, res: Response) => {
  try {
    const refreshToken = typeof req.body.refreshToken === 'string' ? req.body.refreshToken : ''

    if (!refreshToken || refreshToken.length > 4096) {
      res.status(400).json({ error: 'Refresh token required' })
      return
    }

    // Verify the refresh token
    const payload = verifyRefreshToken(refreshToken)

    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
      isAdmin: user.isAdmin,
    })

    res.json({ accessToken })
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// ── GET CURRENT USER ──
// GET /auth/me
// Returns the currently logged in user's info
// Requires authentication (the authenticate middleware checks the token)
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
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
        isAdmin: true,
        resumeText: true,
        createdAt: true,
      },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({ user })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
