# Roam Development Context

**Last Updated:** May 30, 2026  
**Purpose:** Comprehensive handoff for AI instance continuation. Read in order.

---

## 1. ORIENTATION

### What is Roam?

Roam is a nostalgia-driven web discovery tool. It solves the problem of finding interesting, novel content without wading through AI slop and rage-bait — a return to how the internet felt before algorithmic hunger took over.

**Core Feature:** Click the Roam button → get a random URL from your curated discovery pool (filtered by your interests).

**Success Metric:** Enough users use it to curate content organically, creating a virtuous cycle where new URLs are constantly added by community submissions.

### MVP Scope

Everything in `ROADMAP.md` Stages 1-5b is MVP. This includes:

- ✅ Web app (`/` landing, `/join` onboarding, `/u/[username]` profile, `/c/[slug]` collections, `/admin` moderation)
- ✅ Browser extension (popup with Roam button, config panel, prefetch queue)
- ✅ Content seeding (~3.1M URLs, 26 seeders complete)
- ✅ Android app (Stages 6a-6e complete; Play Store submission in progress)

**NOT MVP:**
- Advanced analytics
- Advanced moderation UI (auto-flagging, pattern analysis)
- YouTube, Europeana, or other seeders beyond current Tier 1/2

### Current Maturity

All core functionality is implemented. Code compiles, tests pass, all platform builds verified.

- **Stage 1 (Repository):** ✅ Complete (3/3)
- **Stage 2 (Supabase backend):** ✅ Complete (38/38) — 11 tables, 15+ RLS policies, 12 Edge Functions, interest calibration algorithm
- **Stage 3 (Web app):** ✅ Core complete (11/14) — 3 admin enhancement tasks remain
- **Stage 4 (Content seeding):** ✅ Core complete (40/61) — ~3.1M URLs from 26 sources; subcategory_id backfilled on 2.65M records; 22 optional future seeders planned
- **Stage 5 (Extension):** ✅ Complete (26/26) — submitted to Chrome Web Store and Firefox AMO
- **Stage 6 (Android):** ⏳ 26/29 — app feature-complete; 3 Play Store submission tasks remain (6.17–6.19)
- **Stage 7 (Testing & Launch):** ⏳ 0/9 — end-to-end tests not yet run
- **Stage 8 (Infrastructure):** ✅ Complete (5/5) — roamtheweb.app live on Vercel + Cloudflare
- **Stage 9 (Security Audit):** ⏳ 32/37 — all CRITICAL issues resolved; 5 remaining
- **Stage 10 (Web Polish):** ⏳ 6/20 — 14 UX improvements pending
- **Stage 11 (Hardening):** ⏳ 29/34 — 5 LOW polish tasks remaining
- **Stage 14 (Android Rebuild):** ✅ Complete (11/11) — full Material3 polish, swipe gestures, prefetch pipeline, all screens, tests
- **Stage 15 (P0 Reliability):** ✅ Complete (6/6) — Android P0 incidents fixed, ErrorBoundary→Sentry, 16 extension tests, CI Deno check, docs pass

### Known Blockers & Infrastructure Decisions

**✅ RESOLVED: Supabase Pro Upgrade (2026-04-30)**
- Upgraded from free tier (500 MB) to Pro ($25/month, 8 GB quota)
- All remaining seeders can now be run without storage risk

**✅ RESOLVED: Curlie Seeder**
- Completed: ~1,223,391 rows inserted (2,732,344 extracted, ~1.5M discarded as unmapped to Roam categories)

**✅ RESOLVED: PubMed Seeder**
- Completed: 40,154 rows inserted across 24 MeSH terms

**✅ RESOLVED: Reddit API**
- Implemented using unauthenticated public JSON API (`reddit.com/r/<subreddit>/top.json`)
- Result: 1,549 rows from 35 curated subreddits

**⏳ PENDING: Play Store Submission**
- Android app is feature-complete; tasks 6.17–6.19 (generate AAB, register account, submit) remain

**⏳ PENDING: End-to-End Testing (Stage 7)**
- 9 manual test flows not yet executed; blocking confident launch

**✅ RESOLVED: Subcategory Backfill**
- Added Anime & Manga and Science Fiction & Fantasy subcategories (migration `20260528000002`)
- 13 seeders updated with `subcategory_id`; `categorize-urls.mjs` extended with source rules + category fallback
- 2,658,795 existing DB records backfilled with subcategory assignments (100% classification rate)

**⏳ IN PROGRESS: Dead URL Cleanup (8.9–8.11)**
- `scripts/check-dead-urls.mjs` running; 1,067,960 / 3,109,146 URLs checked (~34%)
- May 29: committed first batch — 323,606 dead URLs retired (`inactive=TRUE`), 3 language corrections applied
- Checker resumed from checkpoint with `--commit`; ~2.04M URLs remaining
- Results cached in `scripts/.cache/`; commit progress tracked in `dead-links-commit-progress.json` (only new results committed per run)

**✅ RESOLVED: Admin Dashboard Stat Zeros**
- Root cause: Supabase statement timeout (~8s) killing COUNT(*) queries on 3.1M-row `urls` table
- Fix: new `admin_url_stats(since_date)` SQL RPC — 4 separate subqueries with per-function `statement_timeout = '30s'`; backed by 3 partial/BRIN indexes
- Dashboard now caches via `unstable_cache`; manual Refresh button available
- Migrations: `20260529000001_admin_url_stats_rpc.sql`, `20260529000002_admin_url_stats_indexes.sql`

**⏳ PENDING: OAuth Testing (9.10)**
- Firefox extension OAuth fixed; web session restoration and Android deep link testing still need manual execution

**✅ RESOLVED: Android System Back Button Navigation**
- Added `BackHandler` to `MainScreen.kt`: Settings → Roam, Profile → Settings, Saved → Settings
- Back arrows added to `SettingsScreen`, `ProfileScreen`, and `SavedScreen` top-bars
- Committed `2fce34b`

**✅ RESOLVED: serve_count Tracking**
- Added `serve_count INTEGER NOT NULL DEFAULT 0` to `urls` table; incremented in `roam()` v13 on every serve
- Migration `20260530234000_add_serve_count.sql` — deployed via MCP
- Committed `8bd6b2e`

**✅ RESOLVED: Admin System Dashboard Expanded (12 cards)**
- `/admin/dashboard` now shows 12 stat cards in 3 rows: Content (Total URLs, Active URLs, Dead links, Added this week), Engagement (Total serves, Total ratings, Avg Wilson score, Total collections), Users (Total users, New users this week, Active users 7d, Pending review)
- `admin_url_stats()` RPC extended to v2 with `total_serves`, `avg_wilson_score`, `active_users_week`
- Migration `20260530234100_admin_url_stats_v2.sql` — deployed via MCP
- Committed `51f39a1`

**✅ RESOLVED: Admin Queue Empty (FK regression)**
- Root cause: `moderation_queue.submitted_by` FK was retargeted to `auth.users` (to fix a Sentry FK violation); this broke the PostgREST join `profile:profiles!submitted_by` in `getAdminQueue`, returning an error and an empty list
- Fix: removed the PostgREST FK join; now fetches profiles in a separate `.from("profiles").select(...).in("id", userIds)` query and merges server-side
- No migration needed — the query change alone is sufficient
- Committed `f6ffd54`

---

## 2. PRINCIPLES & WORKFLOW

### How to Work

**Never:**
- Remove functionality or change how features work without analysis + approval
- Create stubs (the user forgets about them)
- Go down rabbit holes without checking docs first
- Vamp/pretend to work (burn tokens on nothing)
- Be afraid to ask when unsure

**Always:**
- Ask before shortcuts or breaking changes
- Update ROADMAP.md after every task (summarize, log, commit)
- Log decisions and blockers
- Check existing code/docs before implementing
- Be critical of the user's ideas (not a yes-man)

**Workflow per task:**
1. Complete the work
2. Summarize what was done in 2-3 sentences
3. Add a completion note to ROADMAP.md (2-3 sentences)
4. Commit with a message that doesn't mention AI
5. Deploy/push if applicable
6. Report back to user

### Code Values

- **Elegant > Trendy:** Prefer simple, clean, performant code over whatever's in vogue
- **Complete systems:** Don't half-implement features. If you start something, finish it.
- **Consistency:** Match existing patterns in the codebase (look at similar files)
- **Documentation:** Add comments for non-obvious logic, but prefer readable code over comment-heavy code

### Avoiding Past Pitfalls

**Past problems that happened:**
- Deleted work by mistake (check git before major refactors)
- Dead-end rabbit holes from not reading docs (always search docs first)
- Stubs left behind (never create them without explicit permission)
- Vamping (if you don't know what to do, ask instead of guessing)
- Breaking changes without warning (analyze impact, get approval)

---

## 3. PROJECT LANDSCAPE

### Architecture Overview

```
┌─ Web (Next.js) ─────────────────────┐
│ /                    Landing page    │
│ /join                Onboarding      │
│ /u/[username]        User profile    │
│ /c/[slug]            Collections     │
│ /admin               Moderation      │
│ /privacy, /terms     Legal           │
└─────────────────────────────────────┘
        ↑ (Google OAuth)
        │
┌─ Supabase (PostgreSQL) ──────────────┐
│ Auth (Google OAuth)                   │
│ Tables: urls, collections,            │
│         collection_items, categories, │
│         user_categories, ratings,     │
│         moderation_queue, profiles,   │
│         seen_urls, follows,           │
│         user_settings, saved_urls,    │
│         user_interest_scores,         │
│         interest_pair_scores,         │
│         paywalled_domains, feedback,  │
│         moderation_audit_log,         │
│         url_reports                   │
│ Edge Functions: roam, rate,           │
│                submit-url, profile,   │
│                collection, follow,    │
│                save-url, feedback,    │
│                log-failed-urls,       │
│                report-url, delete-user│
│                export-user            │
│ RLS policies protecting user data     │
└───────────────────────────────────────┘
        ↑
┌─ Extension (Chrome/Firefox) ──────────┐
│ Popup (popup.ts)                      │
│ - Roam button                         │
│ - Thumbs up/down with category picker │
│ - Config panel (collections, prefs)   │
│                                       │
│ Background worker (background.ts)     │
│ - Auth & session management           │
│ - Message dispatcher                  │
│ - URL queue (hot/warming)             │
│ - Validation & refill loops           │
│ - API calls to Supabase               │
│                                       │
│ Queue (queue.ts, queueManager.ts)     │
│ - 3 hot URLs (ready to display)       │
│ - 5 warming URLs (validating)         │
│ - HTTP validation (8s timeout)        │
│ - Exponential backoff retry           │
│ - Failed URL logging                  │
└───────────────────────────────────────┘
        ↑
┌─ Seeders (Node.js scripts) ───────────┐
│ scripts/seed-*.js                     │
│ - Query various APIs & sources        │
│ - Normalize URLs                      │
│ - Fetch OG metadata                   │
│ - Batch upsert to DB                  │
│ - Cache results locally               │
└───────────────────────────────────────┘
```

### File Structure

```
roam/
├── ROADMAP.md                  ← Living task history and audit trail (UPDATE CONSTANTLY)
├── .env                        ← Secrets (Supabase URL, API keys)
├── .env.local                  ← Local overrides (gitignored)
├── README.md                   ← Project overview
│
├── web/                        ← Next.js app
│   ├── src/
│   │   ├── app/               ← Routes (/, /join, /u/[username], etc.)
│   │   ├── components/        ← Reusable UI components
│   │   ├── lib/               ← Utilities (Supabase client, auth, etc.)
│   ├── package.json
│   ├── tsconfig.json
│
├── extension/                  ← Chrome/Firefox extension
│   ├── src/
│   │   ├── background/        ← Service worker (background.ts)
│   │   ├── popup/             ← Popup UI (popup.ts, popup.html, popup.css)
│   │   ├── lib/               ← Shared utilities
│   │   │   ├── queue.ts       ← URL queue primitives
│   │   │   ├── queueManager.ts ← Queue orchestration
│   │   │   ├── supabase.ts    ← Supabase client + storage adapter
│   │   │   ├── messages.ts    ← Message types (discriminated union)
│   │   │   └── debug.ts       ← Debug utilities for testing
│   ├── dist/                  ← Compiled extension (ready to load)
│   ├── manifest.json          ← Extension metadata
│   ├── TESTING.md             ← Complete testing guide
│   ├── package.json
│
├── supabase/                   ← Database & Edge Functions
│   ├── migrations/            ← SQL schema versions
│   ├── functions/             ← Edge Functions (Deno)
│   │   ├── roam/              ← GET /roam (main discovery RPC)
│   │   ├── rate/              ← POST /rate (voting)
│   │   ├── submit-url/        ← POST /submit-url (user submissions)
│   │   ├── log-failed-urls/   ← POST /log-failed-urls (moderation)
│   │   └── ...
│   └── README.md              ← DB schema and RPC docs
│
├── scripts/                    ← Node.js seeders
│   ├── lib/
│   │   └── seed.js            ← Shared seeding utilities
│   ├── seed-wikipedia.js      ← ✅ Done (~2.6K URLs)
│   ├── seed-hackernews.js     ← ✅ Done (~950 URLs)
│   ├── seed-nasa.js           ← ✅ Done (~9.1K URLs)
│   ├── seed-openlibrary.js    ← ✅ Done (~59K URLs)
│   ├── seed-arxiv.js          ← ✅ Done (~6.6K URLs)
│   ├── seed-awesome.js        ← ✅ Done (~9.8K URLs)
│   ├── seed-wiby.js           ← ✅ Done (~1.7K URLs)
│   ├── seed-lobsters.js       ← ✅ Done (~1K URLs)
│   ├── seed-semanticscholar.js ← ✅ Done (~50K URLs)
│   ├── seed-nyt.js            ← ✅ Done (~340 URLs)
│   ├── seed-guardian.js       ← ✅ Done (~18K URLs)
│   ├── seed-propublica.js     ← ✅ Done (~106 URLs)
│   ├── seed-npr.js            ← ✅ Done (~152 URLs)
│   ├── seed-wikivoyage.js     ← ✅ Done (~67.7K URLs)
│   ├── seed-internetarchive.js ← ✅ Done (~51K URLs)
│   ├── seed-curlie.js         ← ✅ Done (~1.22M URLs)
│   ├── seed-pubmed.js         ← ✅ Done (~40K URLs)
│   ├── seed-reddit.js         ← ✅ Done (~1.5K URLs)
│   ├── seed-gutenberg.js      ← ✅ Done (~510 URLs)
│   ├── seed-metmuseum.js      ← ✅ Done (~73K URLs)
│   ├── seed-ted.js            ← ✅ Done (~7.5K URLs)
│   ├── seed-librivox.js       ← ✅ Done (~18.7K URLs)
│   ├── seed-github.js         ← ✅ Done (~5.8K URLs)
│   ├── seed-itchio.js         ← ✅ Done (~13.3K URLs)
│   ├── seed-bandcamp.js       ← ✅ Done (~9.6K URLs)
│   ├── seed-substack.js       ← ✅ Done (~14.8K URLs)
│   └── .cache/                ← Local seeder output (gitignored)
│
└── android/                    ← Kotlin + Jetpack Compose app (Play Store submission pending)
```

### Key Dependencies & Integrations

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Web | Next.js + Supabase JS | Server + client auth, DB queries |
| Extension | Chrome APIs + Supabase JS | Native extension APIs, session storage |
| Extension Queue | AbortController + fetch | HTTP validation, timeout handling |
| Database | PostgreSQL (Supabase) | Single source of truth for URLs, users, ratings |
| Auth | Supabase Auth + Google OAuth | Passwordless, cross-platform session |
| Seeders | Node.js + fetch | Data ingestion from 26 public APIs/sources |
| Deploy | Vercel (web) + Supabase (DB) | Automatic git deploys |
| Observability | Sentry (Android + web) | Error tracking, issue management |
| Logs | Vercel CLI (`vercel logs --follow`) | Runtime log streaming |

---

## 4. IMMEDIATE STATE & BLOCKERS

### What's Working ✅

- All three client surfaces: web app, Chrome/Firefox extension, Android app
- Auth (Google OAuth, session persistence, sign-out) across all platforms
- URL queue system (3 hot + 5 warming, validation loops, exponential backoff)
- Config panel (collections, language prefs, paywall toggle, roaming modes)
- Message dispatch system (type-safe, discriminated unions)
- Queue initialization on sign-in (fetches user categories, starts loops)
- Testing infrastructure (TESTING.md guides + debug.ts utilities)
- 26 seeded content sources (~3.15M URLs)
- Web app: landing, onboarding, profiles, collections, admin moderation (with detail view, undo, filtering)
- Interest calibration algorithm (revealed-preference scoring via `user_interest_scores` + adjacent-category serendipity)
- Explore/exploit discovery mode toggle (`user_settings.discovery_mode`)
- CI/CD pipelines (GitHub Actions for build, test, lint, security scanning, deploy)
- Sentry error tracking across all platforms
- GDPR data export and account deletion
- Domain `roamtheweb.app` live on Vercel + Cloudflare
- Extension submitted to Chrome Web Store and Firefox AMO (under review)
- May 12 hotfix: redeployed `supabase/functions/roam` and patched Android OAuth callback handling to avoid duplicate deep-link reprocessing after activity recreation
- May 23: Fixed Android sign-in — removed bogus `android://oauth` manifest intent filter, added explicit `host=callback`, enabled `ExternalAuthAction.CustomTabs()` in Supabase Auth config, redesigned OnboardingScreen (Google-first, email expands inline, no tabs). Also committed BottomBar NavController→callback refactor, `hasSession()`/`sendFeedback()` additions to RoamRepository, updated app icons.

### Known Issues & Blockers ❌

1. **Play Store submission pending**
   - Status: Android app is feature-complete (6.1–6.16 + 6.20–6.25 done)
   - Action needed: Tasks 6.17–6.19 — generate signed AAB, register Google Play account ($25), submit
   - Priority: HIGH (blocking Android launch)

2. **End-to-end testing not yet run (Stage 7)**
   - Status: 9 test flows defined but not executed
   - Impact: Cannot confidently launch without running them
   - Action needed: Complete 7.1–7.9 (sign-up flow, URL submission, collections, admin moderation, etc.)
   - Priority: HIGH (pre-launch requirement)

3. **OAuth testing partially complete (9.10)**
   - Status: Firefox extension parity verified and fixed; Android OAuth sign-in code fixed (May 23); manual verification still needed
   - Action needed: Add `app.roam.android://callback` to Supabase Dashboard → Auth → URL Configuration → Redirect URLs (required for Google sign-in to complete); then execute `docs/OAuth-Testing-Checklist.md` in full
   - Priority: HIGH

### Decision Points (Need Your Input)

**1. Launch sequencing** — Choose the launch order:
   - A) **Android first** — Complete 6.17–6.19, then do Stage 7 testing, then announce
   - B) **Extension first** — Extension is already submitted; wait for store approval, soft-launch, then submit Android
   - C) **Simultaneous** — Coordinate both store approvals before any announcement

**2. Web UX gaps** — Stage 10 has 15 open tasks; which are required before launch?
   - 10.9 (sign-in tabs on join page) ✅ done, 10.10 (T&C checkbox) ✅ done
   - Nice-to-have: 10.7 (skip button), 10.8 (better empty state), 10.11 (URL submission from dashboard)

**3. Future seeders** — Which optional sources to add post-launch?
   - High value: Smithsonian (4.33), IGDB (4.36/4.50), Podcast Index (4.37), Aeon (4.51), Longreads (4.52)
   - Pool quality sweep: Dead-link cleanup scripts (8.9–8.11) will improve existing 1.69M entries

### Current Data Status

- **Total URLs in DB:** ~3.15M seeded; ~323K retired as dead (May 29 batch); ~2.83M active
- **Coverage:** Strong across all 8 pillars; Mind & Body filled by PubMed + Reddit; Weird & Wonderful covered by Wiby, Itch.io, Bandcamp
- **Dead-link cleanup:** In progress — 1.07M / 3.1M checked; ~2.04M remaining; checker running at concurrency=50
- **Paywall domains:** 23 known paywalled domains tracked in `paywalled_domains` table; filtered by user preference
- **Language tagging:** All rows tagged; Curlie non-English dumps correctly tagged (de/fr/it/ja)

---

## 5. OPERATIONAL REFERENCE

### Codebase Patterns

**Message Dispatch (Extension)**

All communication between popup and background uses a type-safe discriminated union:

```typescript
// In src/lib/messages.ts
export type Request = 
  | { type: 'GET_STATE' }
  | { type: 'ROAM' }
  | { type: 'ROAM_COLLECTION'; collectionId: string }
  | { type: 'GET_COLLECTIONS' }
  // ... more types

export async function sendToBackground<T>(req: Request): Promise<Response<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(req, resolve);
  });
}

// In background.ts
async function dispatch(req: Request): Promise<Response<unknown>> {
  switch (req.type) {
    case 'GET_STATE':        return getState();
    case 'ROAM':             return roam();
    case 'ROAM_COLLECTION':  return roamCollection(req.collectionId);
    // ... more cases
  }
}
```

**Follow this pattern:** Every new message type gets a discriminated union entry + a handler function.

**Seeder Pattern**

All seeders follow this structure:

```typescript
// 1. Fetch from external API with rate limiting
async function fetchData() { ... }

// 2. Parse/transform to URL rows
function transformToRows(data) {
  return data.map(item => ({
    url: normalizeUrl(item.url),
    title: item.title,
    description: item.description,
    source: 'seeder-name',
    categoryId: CATEGORY.TECHNOLOGY,
  }));
}

// 3. Cache locally (JSON file)
writeFileSync(CACHE_FILE, JSON.stringify(rows));

// 4. Upsert using shared utility
await upsertUrls(rows, { fetchOg: true/false });
```

**Follow this pattern:** Use `upsertUrls()` from `lib/seed.js` for all seeders. It handles deduplication, OG fetching, and batch insertion.

**Queue System Pattern**

The queue operates in the background with two loops:

```typescript
// Validation loop (every 2s): warming → hot
while (running) {
  const nextWarmingUrl = getNextWarmingUrl();
  if (nextWarmingUrl) {
    const valid = await validateUrl(nextWarmingUrl.url);
    if (valid) {
      promoteToHot(nextWarmingUrl.id);
    } else {
      scheduleRetry(nextWarmingUrl.id);
    }
  }
  await sleep(2000);
}

// Refill loop (every 5s): keep queue at 3+5
while (running) {
  const queueSize = hotCount + warmingCount;
  if (queueSize < REFILL_THRESHOLD) {
    const fresh = await fetchFreshUrls(needed);
    addUrlsToQueue(fresh);
  }
  await sleep(5000);
}
```

**Follow this pattern:** Long-running loops in the background should be stoppable (store loop IDs, check running flag before each iteration).

### Workflow Checklist

After completing any task:

- [ ] Code works and tested
- [ ] ROADMAP.md updated with completion note (2-3 lines)
- [ ] Any new files added to .gitignore if needed
- [ ] `git add`, `git commit` with clean message (no AI mention)
- [ ] `git push origin main`
- [ ] If code deploys: verify Vercel/Supabase deployment successful
- [ ] Report back: "Done. Summary: [what was built]. Status: [works/ready for testing/blocked on X]."

### Key Files to Know

| File | Purpose | When to edit |
|------|---------|--------------|
| ROADMAP.md | Living task history and audit trail | After every task |
| extension/src/lib/messages.ts | Message type definitions | Adding new popup ↔ background messages |
| extension/src/background/background.ts | Message dispatcher & API handlers | New feature implementations |
| extension/src/lib/queue.ts | Queue primitives | Changing queue behavior |
| extension/src/lib/queueManager.ts | Queue orchestration loops | Changing validation/refill timing |
| scripts/lib/seed.js | Shared seeding utilities | Changing how seeders upsert data |
| supabase/functions/roam/index.ts | Main discovery RPC | Changing how URLs are selected |
| supabase/migrations/ | Database schema | Adding tables or columns |
| supabase/API.md | Edge Function RPC contracts | Updating API docs |
| docs/OAuth-Testing-Checklist.md | Pre-launch OAuth validation checklist | Pre-release testing |

### Common Commands

```bash
# Web development
cd web && pnpm dev            # Start Next.js dev server
cd web && pnpm test:ci        # Run tests (Jest)

# Extension development
cd extension && pnpm build    # Build extension
cd extension && pnpm dev      # Build in watch mode (auto-rebuild)
# Then load dist/ in Chrome or dist-firefox/ in Firefox

# Seeders (all complete; re-run with --no-cache to refresh)
node scripts/seed-guardian.js --no-cache    # Example re-run
node scripts/seed-curlie-fetch-og.js        # Backfill OG images for Curlie

# Dead URL checker
powershell -ExecutionPolicy Bypass -File scripts/run-dead-link-checker.ps1 --concurrency 50 --commit

# Vercel logs (runtime log streaming)
$env:VERCEL_TOKEN = (Get-Content web\.env.local | Select-String 'VERCEL_TOKEN=(.+)').Matches[0].Groups[1].Value
& "C:\Users\Seito\AppData\Roaming\npm\vercel.cmd" logs --token $env:VERCEL_TOKEN --follow roamtheweb.app

# Git
git status                     # Check uncommitted changes
git log --oneline -10          # Last 10 commits
git diff filename              # See changes before committing
```

### Testing

Use `extension/TESTING.md` as your guide. Key flows:

1. **Sign-in flow** — OAuth redirect, session persistence
2. **Queue initialization** — Categories fetched, loops start, queue populates
3. **Roam button** — Hot URL consumed, tab navigates, refill loop tops up
4. **Config panel** — Collections CRUD, roaming modes, preferences
5. **Error states** — Handle API failures gracefully

Use `extension/src/lib/debug.ts` utilities in DevTools console:

```javascript
DEBUG.getQueueState()          // See hot/warming counts
DEBUG.testRoam()               // Test Roam button
DEBUG.getAuthState()           // Check sign-in status
```

---

## Final Notes

- **This document is a living reference.** If you find gaps or things that are wrong, update it for the next person.
- **ROADMAP.md is your audit trail.** Always check it before starting something; it'll tell you what's been tried and what failed.
- **Ask early, ask often.** Questions cost way less than fixes.
- **The user cares about complete, elegant systems, not speed.** Thorough wins every time.

Good luck. You've got a great project to work on.
