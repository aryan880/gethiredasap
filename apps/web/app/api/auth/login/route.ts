import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/server/prisma'
import { authErrorMessage } from '@/lib/server/errors'
import { createAccessToken, createRefreshToken } from '@/lib/server/tokens'

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

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: userSelect,
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      )
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      )
    }

    const { passwordHash, ...safeUser } = user

    return NextResponse.json({
      message: 'Login successful',
      user: safeUser,
      accessToken: createAccessToken(safeUser),
      refreshToken: createRefreshToken(safeUser),
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: authErrorMessage(error) },
      { status: 500 },
    )
  }
}
