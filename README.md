<div align="center">

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ●  GetHiredASAP                          RADAR LIVE ●  ║
║                                                           ║
║   Scanning LinkedIn...                                    ║
║   ████████████████████░░░░░  847 jobs found              ║
║                                                           ║
║   ✅ Frontend Developer @ Shopify    →  78% match         ║
║   ✅ Sales Representative @ Fresha   →  65% match         ║
║   👍 Account Executive @ Telus       →  48% match         ║
║                                                           ║
║   📲 2 alerts sent · Next scan in 14 min                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

# GetHiredASAP

**AI-powered job matching. LinkedIn scanned every 15 minutes.**
**NLP scored against your resume. You apply first.**

[![Live](https://img.shields.io/badge/LIVE-gethiredasap.ca-00FF88?style=for-the-badge&logo=vercel&logoColor=black)](https://gethiredasap.ca)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://fastapi.tiangolo.com)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com)
[![Expo](https://img.shields.io/badge/Expo-Mobile-000020?style=for-the-badge&logo=expo)](https://expo.dev)

</div>

---

## ◈ The Problem

Most people apply to jobs **hours after posting** — competing with hundreds of applicants who got there first.

**GetHiredASAP flips that.**

```
  LinkedIn posts a job
         │
         ▼
  ┌─────────────────┐
  │   Job Radar     │  ← Scans every 15 minutes
  │   📡 LIVE       │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   NLP Engine    │  ← sentence-transformers scores 0–100%
  │   🧠 Matching   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   Your Feed     │  ← Only strong matches, ranked by score
  │   ✅ 78% match  │
  └────────┬────────┘
           │
           ▼
     You apply first.
```

---

## ◆ Features

| Feature | Description |
|---------|-------------|
| 📡 **Real-Time Scanning** | LinkedIn scraped every 15 minutes automatically |
| 🧠 **Semantic NLP** | `sentence-transformers` understands meaning, not just keywords |
| ⭐ **Early Career Detection** | Flags entry-level roles even when not labelled "junior" |
| 💰 **Salary Extraction** | Pulls compensation ranges from job descriptions |
| 🏆 **Ranked Feed** | Jobs sorted by match score — highest first, always |
| 📲 **Instant Alerts** | Telegram notifications the moment a strong match is found |
| 📱 **Mobile App** | React Native app for iOS and Android |
| 💳 **Monetisation** | Free / Pro / Premium tiers via Stripe |

---

## ◇ Stack

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                         │
│  Next.js 16  ·  TypeScript  ·  React Query          │
├─────────────────────────────────────────────────────┤
│                     API                             │
│  Node.js  ·  Express  ·  Prisma  ·  PostgreSQL      │
│  Redis  ·  JWT Auth  ·  Stripe Webhooks             │
├─────────────────────────────────────────────────────┤
│                  Python Services                    │
│  FastAPI  ·  sentence-transformers  ·  BeautifulSoup│
│  TF-IDF fallback  ·  scikit-learn                   │
├─────────────────────────────────────────────────────┤
│                    Mobile                           │
│  React Native  ·  Expo  ·  Zustand  ·  SecureStore  │
├─────────────────────────────────────────────────────┤
│                 Infrastructure                      │
│  Hostinger VPS  ·  Nginx  ·  PM2  ·  Docker         │
│  Let's Encrypt SSL  ·  GitHub CI                    │
└─────────────────────────────────────────────────────┘
```

---

## ◉ Project Structure

```
gethiredasap/
│
├── apps/
│   ├── api/                  # Node.js + Express + Prisma
│   │   ├── src/
│   │   │   ├── routes/       # auth, jobs, users, stripe
│   │   │   ├── workers/      # scraperWorker.ts (cron)
│   │   │   └── config/       # db, redis
│   │   └── prisma/
│   │       └── schema.prisma
│   │
│   └── web/                  # Next.js 16
│       └── app/
│           ├── (auth)/       # login, register
│           ├── (dashboard)/  # feed, top, settings, pricing
│           └── page.tsx      # landing page
│
├── packages/
│   ├── nlp/                  # Python NLP microservice :8002
│   │   └── main.py           # sentence-transformers scoring
│   └── scraper/              # Python scraper microservice :8001
│       └── main.py           # LinkedIn public API
│
└── gethiredasap-mobile/      # React Native + Expo (standalone)
    └── src/
        ├── screens/          # Feed, Top, Settings, Pricing
        ├── store/            # Zustand auth store
        └── lib/              # API client, theme
```

---

## ◈ How the NLP Works

```python
# Each resume and job description embedded into 384-dim vectors
model = SentenceTransformer('all-MiniLM-L6-v2')

resume_embedding = model.encode(resume_text)
job_embedding    = model.encode(job_description)

# Cosine similarity → base score
base_score = cosine_similarity(resume_embedding, job_embedding)

# Adjustments
if years_required > years_in_resume:
    score -= experience_gap_penalty   # penalise experience gap

if is_entry_level_role:
    score += early_career_boost       # surface to top of feed

# TF-IDF fallback when semantic confidence is low
if base_score < threshold:
    score = tfidf_score(resume_text, job_description)
```

---

## ◆ Running Locally

**Requirements:** Node 20+, Python 3.12, Docker Desktop

```bash
# 1. Clone
git clone https://github.com/aryan880/gethiredasap.git
cd gethiredasap

# 2. Start database + cache
docker compose up -d

# 3. Install dependencies
npm install

# 4. Environment setup
cp apps/api/.env.example apps/api/.env
# → Fill in DATABASE_URL, JWT_SECRET, STRIPE_* keys

# 5. Run migrations
cd apps/api && npx prisma migrate dev && cd ../..

# 6. Python environments
cd packages/nlp     && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
cd packages/scraper && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

Then open 5 terminals:

```bash
cd apps/api      && npm run dev                                           # :3001
cd apps/web      && npm run dev                                           # :3000
cd packages/nlp     && source venv/bin/activate && uvicorn main:app --port 8002
cd packages/scraper && source venv/bin/activate && uvicorn main:app --port 8001
stripe listen --forward-to localhost:3001/stripe/webhook
```

Open [http://localhost:3000](http://localhost:3000)

---

## ◇ Deployment Architecture

```
                    gethiredasap.ca
                          │
                    ┌─────▼─────┐
                    │   Nginx   │  ← SSL (Let's Encrypt)
                    │  :80/:443 │    Reverse proxy
                    └─────┬─────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
    ┌──────▼──────┐ ┌─────▼──────┐      │
    │  Next.js    │ │    API     │      │
    │   :3000     │ │   :3001    │      │
    └─────────────┘ └─────┬──────┘      │
                          │             │
              ┌───────────┼───────────┐ │
              │           │           │ │
       ┌──────▼───┐ ┌─────▼────┐     │ │
       │   NLP    │ │ Scraper  │     │ │
       │  :8002   │ │  :8001   │     │ │
       └──────────┘ └──────────┘     │ │
                                     │ │
                    ┌────────────┐   │ │
                    │   Docker   │◄──┘ │
                    │ PostgreSQL │     │
                    │   Redis    │◄────┘
                    └────────────┘

              All managed by PM2 · Auto-restart on crash
```

---

## ◉ Environment Variables

```bash
# apps/api/.env
PORT=3001
NODE_ENV=production
CLIENT_URL=https://gethiredasap.ca

DATABASE_URL=postgresql://user:pass@localhost:5432/gethiredasap
REDIS_URL=redis://localhost:6379

JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
```

---

## ◈ Roadmap

```
✅ LinkedIn scraping + NLP matching
✅ Web dashboard — feed, top, settings, pricing
✅ Stripe payments — Free / Pro / Premium
✅ Telegram bot alerts
✅ VPS deployment + SSL domain
✅ React Native mobile app (iOS + Android)
⬜ Email alerts for Premium users
⬜ Admin dashboard
⬜ Indeed + Glassdoor + Workday scrapers
⬜ Push notifications (Expo)
⬜ App Store + Play Store submission
```

---

<div align="center">

Built by **Aryan Sawhney** · Vancouver, BC

[![LinkedIn](https://img.shields.io/badge/LinkedIn-aryansawhney-0077B5?style=flat-square&logo=linkedin)](https://linkedin.com/in/aryansawhney)
[![GitHub](https://img.shields.io/badge/GitHub-aryan880-181717?style=flat-square&logo=github)](https://github.com/aryan880)

*Built with Next.js · FastAPI · sentence-transformers · Stripe · React Native · ☕*

</div>