import { generateAccessToken, generateRefreshToken } from '../../src/utils/jwt'

type TokenUser = {
  id: string
  email: string
  tier: string
  isAdmin?: boolean
}

export function createAccessToken(user: TokenUser) {
  return generateAccessToken({
    userId: user.id,
    email: user.email,
    tier: user.tier,
    isAdmin: user.isAdmin,
  })
}

export function createRefreshToken(user: TokenUser) {
  return generateRefreshToken({
    userId: user.id,
    email: user.email,
    tier: user.tier,
    isAdmin: user.isAdmin,
  })
}
