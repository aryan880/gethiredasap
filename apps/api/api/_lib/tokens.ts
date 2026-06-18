import crypto from 'crypto'

type TokenUser = {
  id: string
  email: string
  tier: string
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is missing in Vercel environment variables`)
  }
  return value
}

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sign(payload: Record<string, unknown>, secret: string) {
  const body = base64url(JSON.stringify(payload))
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest()

  return `${body}.${base64url(signature)}`
}

export function createAccessToken(user: TokenUser) {
  return sign(
    {
      userId: user.id,
      email: user.email,
      tier: user.tier,
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    },
    requiredEnv('JWT_SECRET'),
  )
}

export function createRefreshToken(user: TokenUser) {
  return sign(
    {
      userId: user.id,
      email: user.email,
      tier: user.tier,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    },
    requiredEnv('JWT_REFRESH_SECRET'),
  )
}
