import 'dotenv/config'
import express from 'express'
import type { RequestHandler, ErrorRequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { authenticate, AuthRequest } from './middleware/auth'
import { authRateLimit, jobHunterRateLimit, matchingRateLimit, writeRateLimit } from './middleware/security'

const app = express()
const PORT = process.env.PORT || 3001
const enableLegacyScraper = process.env.ENABLE_LEGACY_SCRAPER === 'true'
const allowedOrigins = new Set([
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean))

function lazyRouter(loadRouter: () => unknown): RequestHandler {
  let router: RequestHandler | undefined

  return (req, res, next) => {
    try {
      if (!router) {
        const mod = loadRouter() as { default?: RequestHandler } | RequestHandler
        router = typeof mod === 'function' ? mod : mod.default
      }

      if (!router) {
        throw new Error('Route module did not export an Express router')
      }

      return router(req, res, next)
    } catch (error) {
      return next(error)
    }
  }
}

app.disable('x-powered-by')

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
}))
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  next()
})

// Raw body for Stripe webhook — must come before express.json()
app.use('/stripe/webhook', express.raw({ type: 'application/json' }))

// ── MIDDLEWARE ──
// Parse incoming JSON request bodies
app.use(express.json({ limit: '256kb' }))

// Allow frontend to talk to this API
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`))
  },
  credentials: true,
}))

// ── ROUTES ──
app.use('/auth', authRateLimit, lazyRouter(() => require('./routes/auth')))
app.use('/users/resume', writeRateLimit)
app.use('/users', lazyRouter(() => require('./routes/users')))
app.use('/jobs', lazyRouter(() => require('./routes/jobs')))
app.use('/api/job-hunter/matches', matchingRateLimit)
app.use('/api/job-hunter/jobs/:id/resume-gap', matchingRateLimit)
app.use('/api/job-hunter/command-center', jobHunterRateLimit, lazyRouter(() => require('./routes/jobHunterCommandCenter')))
app.use('/api/job-hunter', jobHunterRateLimit, lazyRouter(() => require('./routes/jobHunter')))
app.use('/api/saved-searches', writeRateLimit, lazyRouter(() => require('./routes/savedSearches')))
app.use('/api/applications', writeRateLimit, lazyRouter(() => require('./routes/applications')))

// add after app.use('/jobs', jobRoutes)
app.use('/stripe', lazyRouter(() => require('./routes/stripe')))

app.get('/', (req, res) => {
  res.json({
    name: 'gethiredasap-api',
    status: 'ok',
  })
})

// ── SCRAPER TRIGGER ──
// Manually trigger a scrape run (for testing)
function requireAdmin(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}

app.post('/scrape/run', authenticate, requireAdmin, async (_req, res) => {
  console.log('🔄 Manual scrape triggered')
  const { runScraperForAllUsers } = require('./workers/scraperWorker')
  runScraperForAllUsers() // run in background
  res.json({ message: 'Scraper started' })
})

// Trigger for specific user
app.post('/scrape/run/:userId', authenticate, requireAdmin, async (req, res) => {
  const { userId } = req.params
  const { runScraperForUser } = require('./workers/scraperWorker')
  runScraperForUser(userId) // run in background
  res.json({ message: `Scraper started for user ${userId}` })
})

// ── HEALTH CHECK ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  })
})

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body too large' })
    return
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Malformed JSON' })
    return
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('Unhandled API error:', err?.message || err)
  }

  res.status(500).json({ error: 'Internal server error' })
}

app.use(errorHandler)

// ── START SERVER ──
app.listen(PORT, () => {
  console.log(`🚀 API running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
})

if (enableLegacyScraper) {
  const { startScheduler } = require('./workers/scheduler')
  startScheduler()
} else {
  console.log('Legacy scraper disabled. Using AI Job Hunter API as job source.')
}

export default app
module.exports = app
