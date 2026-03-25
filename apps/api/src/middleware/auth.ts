import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'

// Extend Express Request type to include our user data
// This lets us access req.user in any route handler
export interface AuthRequest extends Request {
  user?: {
    userId: string
    email: string
    tier: string
  }
}

// This middleware runs BEFORE route handlers
// It checks if the request has a valid JWT token
// If yes → attach user info to request and continue
// If no  → return 401 Unauthorized
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Token comes in the Authorization header like:
    // "Bearer eyJhbGciOiJIUzI1NiJ9..."
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    // Extract just the token part (remove "Bearer ")
    const token = authHeader.split(' ')[1]

    // Verify the token — throws if invalid or expired
    const payload = verifyAccessToken(token)

    // Attach user info to the request
    // Now any route handler can access req.user
    req.user = payload

    // Continue to the next middleware or route handler
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Middleware to check if user has required tier
// Usage: router.get('/premium-feature', authenticate, requireTier('PRO'), handler)
export const requireTier = (minimumTier: 'FREE' | 'PRO' | 'PREMIUM') => {
  const tierOrder = { FREE: 0, PRO: 1, PREMIUM: 2 }

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userTier = req.user?.tier as 'FREE' | 'PRO' | 'PREMIUM'

    if (!userTier || tierOrder[userTier] < tierOrder[minimumTier]) {
      res.status(403).json({
        error: 'Upgrade required',
        required: minimumTier,
        current: userTier,
      })
      return
    }

    next()
  }
}