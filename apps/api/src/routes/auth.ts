import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../config/database'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// ── REGISTER ──
// POST /auth/register
// Creates a new user account
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body

    // Validate input
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password and name are required' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
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
        resumeText: true,
        createdAt: true,
      },
    })

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
    })

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
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
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
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
    })

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
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
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
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