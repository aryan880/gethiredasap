import jwt from 'jsonwebtoken'

function requiredSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET') {
  const value = process.env[name]
  if (!value || value.length < 32 || value.startsWith('change-me') || value.startsWith('fallback')) {
    throw new Error(`${name} must be set to a strong environment secret`)
  }
  return value
}

const JWT_SECRET = requiredSecret('JWT_SECRET')
const JWT_REFRESH_SECRET = requiredSecret('JWT_REFRESH_SECRET')

// What we store inside the token
export interface TokenPayload {
  userId: string
  email: string
  tier: string
  isAdmin?: boolean
}

// Create a short-lived access token (15 minutes)
// Used for every API request
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m',
  })
}

// Create a long-lived refresh token (7 days)
// Used to get a new access token without logging in again
export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  })
}

// Verify an access token and return the payload
// Throws an error if token is invalid or expired
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}

// Verify a refresh token
export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload
}
