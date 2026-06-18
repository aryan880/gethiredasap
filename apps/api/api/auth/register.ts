import bcrypt from 'bcryptjs'
import prisma from '../_lib/prisma'
import { setupErrorMessage } from '../_lib/errors'
import { createAccessToken, createRefreshToken } from '../_lib/tokens'

const userSelect = {
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
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { email, password, name } =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password and name are required' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
      select: userSelect,
    })

    res.status(201).json({
      message: 'Account created successfully',
      user,
      accessToken: createAccessToken(user),
      refreshToken: createRefreshToken(user),
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: setupErrorMessage(error) })
  }
}
