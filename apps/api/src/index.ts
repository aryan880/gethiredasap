import express from 'express'
import type { RequestHandler } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const isVercel = process.env.VERCEL === '1'
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://192.168.1.110:3000',
  'https://gethiredasap.vercel.app',
  'https://gethiredasap-web.vercel.app',
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

// Raw body for Stripe webhook — must come before express.json()
app.use('/stripe/webhook', express.raw({ type: 'application/json' }))

// ── MIDDLEWARE ──
// Parse incoming JSON request bodies
app.use(express.json())

// Allow frontend to talk to this API
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || /\.vercel\.app$/.test(origin)) {
      callback(null, true)
      return
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`))
  },
  credentials: true,
}))

// ── ROUTES ──
app.use('/auth', lazyRouter(() => require('./routes/auth')))
app.use('/users', lazyRouter(() => require('./routes/users')))
app.use('/jobs', lazyRouter(() => require('./routes/jobs')))

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
app.post('/scrape/run', async (req, res) => {
  console.log('🔄 Manual scrape triggered')
  const { runScraperForAllUsers } = require('./workers/scraperWorker')
  runScraperForAllUsers() // run in background
  res.json({ message: 'Scraper started' })
})

// Trigger for specific user
app.post('/scrape/run/:userId', async (req, res) => {
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

// ── START SERVER ──
if (!isVercel) {
  const { startScheduler } = require('./workers/scheduler')

  app.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`)
    console.log(`📊 Health check: http://localhost:${PORT}/health`)
  })

  startScheduler()
}

export default app
module.exports = app
