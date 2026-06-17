import crypto from 'crypto'

type TokenPayload = {
  userId: string
  email: string
  tier: string
  exp: number
}

const encoder = new TextEncoder()

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sign(payload: TokenPayload, secret: string) {
  const body = base64url(JSON.stringify(payload))
  const signature = crypto
    .createHmac('sha256', encoder.encode(secret))
    .update(body)
    .digest()

  return `${body}.${base64url(signature)}`
}

export function createAccessToken(user: { id: string; email: string; tier: string }) {
  return sign(
    {
      userId: user.id,
      email: user.email,
      tier: user.tier,
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    },
    process.env.JWT_SECRET || 'fallback-secret',
  )
}

export function createRefreshToken(user: { id: string; email: string; tier: string }) {
  return sign(
    {
      userId: user.id,
      email: user.email,
      tier: user.tier,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    },
    process.env.JWT_REFRESH_SECRET || 'fallback-refresh',
  )
}
