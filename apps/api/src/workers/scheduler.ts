import cron from 'node-cron'
import { runScraperForAllUsers } from './scraperWorker'

// ── SCHEDULER ──
// Runs the scraper automatically every 15 minutes
// No manual triggering needed

export function startScheduler() {
  console.log('⏰ Scheduler started — scraping every 15 minutes')

  // Cron syntax: '*/15 * * * *'
  // means: every 15 minutes, every hour, every day
  cron.schedule('*/15 * * * *', async () => {
    console.log('⏰ Scheduled scrape triggered')
    await runScraperForAllUsers()
  })

  // Also run immediately on startup
  // So you don't wait 15 min for first results
  console.log('🚀 Running initial scrape on startup...')
  runScraperForAllUsers()
}