import prisma from '../_lib/prisma'
import { setupErrorMessage } from '../_lib/errors'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    if (!process.env.DATABASE_URL) {
      res.status(500).json({
        status: 'error',
        error: 'DATABASE_URL is missing in Vercel environment variables',
      })
      return
    }

    await prisma.$queryRaw`SELECT 1`

    res.json({
      status: 'ok',
      database: 'connected',
    })
  } catch (error) {
    console.error('Database health error:', error)
    res.status(500).json({
      status: 'error',
      error: setupErrorMessage(error),
    })
  }
}
