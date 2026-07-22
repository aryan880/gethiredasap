import rateLimit from 'express-rate-limit'
import type { Request, Response } from 'express'

const isDevelopment = process.env.NODE_ENV !== 'production'

function retryAfterSeconds(req: Request) {
  const resetTime = (req as any).rateLimit?.resetTime as Date | undefined
  if (!resetTime) return null
  const diffMs = resetTime.getTime() - Date.now()
  return Math.max(1, Math.ceil(diffMs / 1000))
}

function sendRateLimitError(error: string) {
  return (req: Request, res: Response) => {
    const retryAfter = retryAfterSeconds(req)
    res.status(429).json({
      error,
      retryAfter,
      detail: retryAfter
        ? `Try again in ${retryAfter} seconds.`
        : 'Try again later.',
    })
  }
}

export const authAttemptRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDevelopment ? 100 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: sendRateLimitError('Too many authentication attempts.'),
})

export const authRefreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDevelopment ? 240 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimitError('Too many session refresh attempts.'),
})

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDevelopment ? 300 : 80,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const path = req.path || ''
    if (path === '/me') return true
    if (path === '/refresh') return true
    return false
  },
  handler: sendRateLimitError('Too many authentication requests.'),
})

export const writeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimitError('Too many write requests.'),
})

export const jobHunterRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimitError('Too many job requests.'),
})

export const matchingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimitError('Too many matching requests.'),
})

export function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
