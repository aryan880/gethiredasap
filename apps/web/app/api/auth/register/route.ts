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
}

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password and name are required' },
        { status: 400 },
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 },
      )
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

    return NextResponse.json(
      {
        message: 'Account created successfully',
        user,
        accessToken: createAccessToken(user),
        refreshToken: createRefreshToken(user),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: authErrorMessage(error) },
      { status: 500 },
    )
  }
}
