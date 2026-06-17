import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import jobRoutes from './routes/jobs'
import { runScraperForAllUsers, runScraperForUser } from './workers/scraperWorker'
import { startScheduler } from './workers/scheduler'
import stripeRoutes from './routes/stripe'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const isVercel = process.env.VERCEL === '1'

// Raw body for Stripe webhook — must come before express.json()
app.use('/stripe/webhook', express.raw({ type: 'application/json' }))

// ── MIDDLEWARE ──
// Parse incoming JSON request bodies
app.use(express.json())

// Allow frontend to talk to this API
app.use(cors({
  origin: ['http://localhost:3000', 'http://192.168.1.110:3000'],
  credentials: true,
}))

// ── ROUTES ──
app.use('/auth', authRoutes)
app.use('/users', userRoutes)
app.use('/jobs', jobRoutes)

// add after app.use('/jobs', jobRoutes)
app.use('/stripe', stripeRoutes)

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
  runScraperForAllUsers() // run in background
  res.json({ message: 'Scraper started' })
})

// Trigger for specific user
app.post('/scrape/run/:userId', async (req, res) => {
  const { userId } = req.params
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
  app.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`)
    console.log(`📊 Health check: http://localhost:${PORT}/health`)
  })

  startScheduler()
}

export default app
