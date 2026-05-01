# Roam Hosting & Infrastructure Costs

**Last Updated:** April 30, 2026  
**Current State:** ~1.45M URLs seeded, Supabase free tier maxed out

---

## Current Infrastructure

| Service | Current | Tier | Cost |
|---|---|---|---|
| **Supabase (DB + Auth + Edge Functions)** | Free | 500 MB storage, 500K invocations/mo, 50K MAU | $0 |
| **Vercel (Web Layer)** | Free | 100 GB bandwidth/mo, unlimited deploys | $0 |
| **cron-job.org (Keep-alive ping)** | Free | 1 job/day | $0 |
| **Google Safe Browsing API** | Free | ~5K calls/day | $0 |
| **Domain (roam.example.com)** | — | — | ~$12/year |
| **Total** | — | — | **~$1/month** |

---

## Storage Analysis

### Current Usage (Estimated)
- **1.45M URLs** × ~200 bytes per row (url, title, description, og_image_url, metadata) ≈ **290 MB**
- **Ratings & seen_urls** (transient, cleaned nightly) ≈ **50 MB**
- **Migrations, users, collections, auth tables** ≈ **50 MB**
- **Total: ~390 MB of 500 MB free tier** (78% full)

### Growth Projection
- **Curlie import** (1-3M URLs) + other seeders: **+2-4M URLs** → **~600-850 MB total**
- **At current seeding pace** (remaining seeders + user submissions): **hit 500 MB limit in 1-2 weeks**

---

## Option Comparison

### Option A: Supabase Pro ($25/month)
| Metric | Free | Pro |
|---|---|---|
| **Storage** | 500 MB | 100 GB |
| **Edge Functions** | 500K/mo | 2M/mo |
| **Database connections** | 5 | 20 |
| **Monthly active users** | 50K | unlimited |
| **Cost** | $0 | $25 |

**Pros:**
- No migration or code changes
- Proven stack (everything already works)
- 100 GB = ~500M URLs (years of content)
- Same tooling, CLI, dashboard

**Cons:**
- $25 × 12 = **$300/year** recurring
- Only viable if you monetize or have committed usage

---

### Option B: Self-Hosted PostgreSQL + Supabase Auth ($20-30/month)

#### Stack:
1. **Postgres** — DigitalOcean ($5/mo) or AWS RDS ($15/mo)
2. **Supabase Auth** — Free (can still use Supabase for auth only, no storage)
3. **Edge Functions** — Vercel Edge Functions (free) or Deno Deploy ($5/mo)
4. **Backups & Monitoring** — pgBackRest ($0, self-hosted) or AWS Backup ($5/mo)

| Component | Cost | Notes |
|---|---|---|
| DigitalOcean Droplet (PostgreSQL 16, 1 GB RAM) | $5 | Or AWS RDS at $15 |
| Supabase Auth + Users table | $0 | Auth only, no storage |
| Vercel Edge Functions | $0 | Free tier; $0.50/1M invocations after |
| Backups (pgBackRest/S3) | $5 | Or $0 if you're OK with risky backups |
| Domain | $1 | anuual, amortized |
| **Total** | ~$11-25/mo | Depending on backup strategy |

**Pros:**
- ~50% cheaper than Pro ($300/year → $150/year)
- Full control over data
- Can scale vertically (bigger Postgres) without Supabase lock-in
- Easier to migrate away later

**Cons:**
- **Migration effort:** 2-3 weeks to rewrite Edge Functions, test, deploy
- **Ops overhead:** you manage backups, uptime, scaling decisions
- **More moving parts:** Postgres + Vercel + Auth0/Supabase hybrid = more things to break
- **Requires knowledge** of SQL, Docker, PostgreSQL administration

---

### Option C: PlanetScale (MySQL) + Auth0 ($10-20/month)

| Component | Cost |
|---|---|
| PlanetScale (5 GB free, overage $0.10/GB) | $0-10 |
| Auth0 (free tier, 7,500 monthly active users) | $0 |
| Vercel Edge Functions | $0 |
| Backups | $0 (PlanetScale handles) |
| **Total** | ~$5-15/mo |

**Pros:**
- Cheapest option
- Serverless MySQL (no ops)
- Generous free tier

**Cons:**
- Requires rewriting all Supabase RLS policies → raw SQL + application-layer auth
- Auth0 free tier has limits; paid tier is $600/month
- Schema migration from PostgreSQL to MySQL (data types, window functions, CTEs)

---

### Option D: Firebase ($0-50/mo, pay-as-you-go)

| Component | Cost |
|---|---|
| Cloud Firestore (1 GB free, $0.06/100K reads, $0.18/100K writes) | $0-20 |
| Cloud Storage (5 GB free) | $0 |
| Cloud Functions | Free tier, then $0.40/1M invocations |
| Authentication | Free |
| **Total** | ~$0-30/mo |

**Pros:**
- Aggressive free tier
- Auto-scales, no ops needed
- Realtime database (built-in pub/sub)

**Cons:**
- **Massive refactor:** Firestore has a completely different data model (documents, collections) vs relational SQL
- **Vendor lock-in:** Google ecosystem only
- **Cost unpredictability:** pay-as-you-go can spike with sudden traffic
- Estimated migration: **4-6 weeks** of heavy engineering

---

## Recommendation

### For Roam's Current State (Pre-revenue, MVP):

**Short-term (Next 6 months):**
- **✅ Upgrade to Supabase Pro ($25/month)**
- Unblocks Curlie import + remaining seeders immediately
- Zero risk, zero downtime
- If you get 10+ paying users, the $25/month is covered

### Long-term (If Roam grows):

**At 100 GB storage (5-10M URLs) + real users:**
- **Evaluate self-hosted Postgres** (Option B)
- By then you'll have revenue or committed usage to justify the ops work
- DigitalOcean Postgres is battle-tested for hobby projects

**Never choose Option C or D unless:**
- You have strong reasons to abandon SQL (you don't)
- You want to learn Firestore (fine, but not now)

---

## Action Items

1. **Upgrade to Supabase Pro** — Go to dashboard → Billing → upgrade to Pro tier
   - Billing starts immediately; no downtime
   - 100 GB available within minutes

2. **Resume seeding** after upgrade:
   - Rerun Curlie seeder (currently broken)
   - Run PubMed seeder to completion
   - Import remaining seeders (YouTube, IGDB, etc.)

3. **Revisit in 6 months** — Check storage usage; plan long-term strategy

---

## Cost Breakdown (Annual)

| Option | Monthly | Annual | Notes |
|---|---|---|---|
| **Current (Free tier, maxed)** | $0 | $0 | Blocked on storage limit |
| **Pro ($25/mo)** | $25 | $300 | Recommended for next 6 months |
| **Self-hosted (DigitalOcean)** | $15-25 | $180-300 | Same cost, more work |
| **PlanetScale** | $10-20 | $120-240 | Requires major refactor |
| **Firebase** | $5-30 | $60-360 | Massive refactor, unpredictable |

---

## Storage Roadmap

| Milestone | URLs | Storage | Action |
|---|---|---|---|
| **Now (Apr 30)** | 1.45M | 390 MB | Upgrade to Pro |
| **After Curlie** | 4-5M | 1-1.2 GB | Still on Pro free tier |
| **After all seeders** | 7-10M | 2-3 GB | Still on Pro free tier |
| **At 100 GB** | ~500M | 100 GB | 12+ months away, evaluate self-hosted |