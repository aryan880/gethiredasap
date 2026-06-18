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
  passwordHash: true,
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { email, password } =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: userSelect,
    })

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const { passwordHash, ...safeUser } = user

    res.json({
      message: 'Login successful',
      user: safeUser,
      accessToken: createAccessToken(safeUser),
      refreshToken: createRefreshToken(safeUser),
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: setupErrorMessage(error) })
  }
}
