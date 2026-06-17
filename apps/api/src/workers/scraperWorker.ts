import prisma from '../config/database'
import { scrapeJobs, scoreJobs } from '../services/scraperService'

type ActiveSearch = { role: string; location: string }
type ExistingMatch = { jobId: string }

// ── MAIN SCRAPER WORKER ──
// Runs on a schedule for each active user
// Scrapes LinkedIn → scores with NLP → saves to DB
export async function runScraperForUser(userId: string) {
  try {
    console.log(`\n🔍 Running scraper for user: ${userId}`)

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        searches: { where: { isActive: true } }
      }
    })

    if (!user) {
      console.log(`  ❌ User not found: ${userId}`)
      return
    }

    if (!user.isActive) {
      console.log(`  ⏸  User paused: ${user.email}`)
      return
    }

    if (!user.resumeText) {
      console.log(`  ⚠️  No resume set for: ${user.email}`)
      return
    }

    if (!user.searches.length) {
      console.log(`  ⚠️  No searches set for: ${user.email}`)
      return
    }

    // ── STEP 1: SCRAPE ──
    console.log(`  📡 Scraping ${user.searches.length} searches...`)
    const searches = user.searches.map((s: ActiveSearch) => ({
      role:     s.role,
      location: s.location,
    }))

    const rawJobs = await scrapeJobs(searches, 15)
    console.log(`  📋 Found ${rawJobs.length} raw jobs`)

    if (!rawJobs.length) {
      console.log(`  ℹ️  No jobs found`)
      return
    }

    // ── STEP 2: FILTER ALREADY SEEN ──
    // Get job IDs user has already seen
    const existingMatches = await prisma.jobMatch.findMany({
      where: { userId },
      select: { jobId: true }
    })
    const seenIds = new Set(existingMatches.map((m: ExistingMatch) => m.jobId))

    const newJobs = rawJobs.filter((j: any) => !seenIds.has(j.id))
    console.log(`  🆕 ${newJobs.length} new unseen jobs`)

    if (!newJobs.length) {
      console.log(`  ℹ️  No new jobs`)
      return
    }

    // ── STEP 3: SCORE WITH NLP ──
    console.log(`  🧠 Scoring with NLP...`)
    const scoredJobs = await scoreJobs(
      newJobs,
      user.resumeText,
      1.5, // default candidate years — will make configurable later
    )

    // ── STEP 4: SAVE TO DATABASE ──
    let savedCount   = 0
    let alertedCount = 0

    for (const job of scoredJobs) {
      try {
        // Save job to jobs table (ignore if already exists)
        await prisma.job.upsert({
          where: { id: job.id },
          create: {
            id:          job.id,
            title:       job.title,
            company:     job.company,
            location:    job.location,
            link:        job.link,
            description: job.description || '',
            salary:      job.salary      || '',
            postedAt:    job.posted ? new Date(job.posted) : null,
          },
          update: {}, // don't update if already exists
        })

        // Save match for this user
        await prisma.jobMatch.create({
          data: {
            userId,
            jobId:         job.id,
            score:         job.score,
            expLabel:      job.exp_label      || '',
            isEarlyCareer: job.is_early_career || false,
            alertedAt:     job.score >= user.threshold ? new Date() : null,
          }
        })

        savedCount++

        // ── STEP 5: ALERT IF ABOVE THRESHOLD ──
        if (job.score >= user.threshold) {
          alertedCount++
          console.log(
            `  ✅ ${job.title} @ ${job.company} → ${job.score}%`
          )

          // Save alert record
          await prisma.alert.create({
            data: {
              userId,
              jobId:   job.id,
              channel: 'IN_APP',
            }
          })

          // TODO: send push notification (Phase 2)
          // TODO: send Telegram message (Phase 2)
        } else {
          console.log(
            `  ⏭  ${job.title} @ ${job.company} → ${job.score}% (below threshold)`
          )
        }

      } catch (err: any) {
        // Skip duplicates silently
        if (err.code !== 'P2002') {
          console.error(`  ❌ Error saving job ${job.id}:`, err.message)
        }
      }
    }

    console.log(`\n  📊 Summary for ${user.email}:`)
    console.log(`     Jobs scraped:  ${rawJobs.length}`)
    console.log(`     New jobs:      ${newJobs.length}`)
    console.log(`     Saved:         ${savedCount}`)
    console.log(`     Alerted:       ${alertedCount}`)

  } catch (error: any) {
    console.error(`❌ Scraper error for ${userId}:`, error.message)
  }
}

// ── RUN FOR ALL ACTIVE USERS ──
export async function runScraperForAllUsers() {
  console.log('\n' + '='.repeat(50))
  console.log(`🤖 Scraper run — ${new Date().toISOString()}`)
  console.log('='.repeat(50))

  const activeUsers = await prisma.user.findMany({
    where: {
      isActive:   true,
      resumeText: { not: null },
    },
    select: { id: true, email: true }
  })

  console.log(`👥 Active users with resumes: ${activeUsers.length}`)

  for (const user of activeUsers) {
    await runScraperForUser(user.id)
  }

  console.log('\n✅ Scraper run complete\n')
}
