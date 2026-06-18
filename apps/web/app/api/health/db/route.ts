import { NextResponse } from 'next/server'
import prisma from '@/lib/server/prisma'
import { authErrorMessage } from '@/lib/server/errors'

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'DATABASE_URL is missing in Vercel environment variables',
        },
        { status: 500 },
      )
    }

    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
    })
  } catch (error) {
    console.error('Database health error:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: authErrorMessage(error),
      },
      { status: 500 },
    )
  }
}
