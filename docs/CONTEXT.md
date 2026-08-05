# Roam Development Context

**Last Updated:** July 7, 2026  
**Purpose:** Comprehensive handoff for AI instance continuation. Read in order.

---

## HOTFIX — July 1, 2026: Discovery restored (Android "Session Expired")

The Android app showed "Session Expired. Please sign in again." and never loaded a
URL. Root cause was **not** auth. The `roam()` RPC (v25, applied manually via
`20260617000002_roam_v25_apply.sql`) had **two** defects that each returned a 500
the Android client mislabeled as an expired session:

1. It referenced a non-existent column `public.seen_urls.seen_url_id` (correct
   column is `url_id`) — `42703` at runtime. Also present in `evaluate_badges()`.
   Fixed in `20260701220207_fix_seen_urls_column_ref.sql`.
2. It dropped `DEFAULT NULL` from the optional params (`p_collection_id`,
   `p_exclude_domain`, `p_category_id`, `p_subcategory_id`), so PostgREST could not
   resolve `roam(p_user_id)` on an unfiltered discovery call — `42883 function does
   not exist`. This is what kept failing after fix #1, because the function never
   executed on the common path. Fixed in `20260701221229_fix_roam_param_defaults.sql`.

Verified against production through the PostgREST RPC path (the same one the edge
function uses): `roam(p_user_id)` now returns a full URL row.

---

## 1. ORIENTATION

### What is Roam?

Roam is a nostalgia-driven web discovery tool. It solves the problem of finding interesting, novel content without wading through AI slop and rage-bait — a return to how the internet felt before algorithmic hunger took over.

**Core Feature:** Click the Roam button → get a random URL from your curated discovery pool (filtered by your interests).

**Success Metric:** Enough users use it to curate content organically, creating a virtuous cycle where new URLs are constantly added by community submissions.

### MVP Scope

Everything in `ROADMAP.md` Stages 1-15 is MVP or completed hardening. This includes:

- ✅ Web app (`/` landing, `/join` onboarding, `/u/[username]` profile, `/collections/[slug]` collections, `/admin` moderation, `/profile`, `/settings`)
- ✅ Browser extension (published on Chrome Web Store and Firefox AMO; event-driven MV3 architecture with prefetch cache)
- ✅ Content seeding (~2.8M active URLs, 30+ seeders complete)
- ✅ Android app (published on Google Play Store; full Material3 polish with swipe gestures, prefetch pipeline, push notifications)
- ✅ CI/CD, Sentry, GDPR compliance, interest calibration, adjacent-category serendipity
- ✅ Admin dashboard (15 stat cards, dead links tab, moderation with detail view + undo)

**NOT MVP:**
- Advanced analytics
- Advanced moderation UI (auto-flagging, pattern analysis)
- YouTube, Europeana, or other seeders beyond current Tier 1/2

### Current Maturity

All core functionality is implemented. All platforms published. Code compiles, tests pass, all platform builds verified.

- **Stage 1 (Repository):** ✅ Complete (3/3)
- **Stage 2 (Supabase backend):** ✅ Complete (38/38) — 18+ tables, 15+ RLS policies, 15 Edge Functions, interest calibration algorithm
- **Stage 3 (Web app):** ✅ Core complete (11/14) — 3 admin enhancement tasks remain
- **Stage 4 (Content seeding):** ✅ Core complete (40/61) — ~2.8M active URLs from 30+ sources; subcategory_id backfilled; 22 optional future seeders planned
- **Stage 5 (Extension):** ✅ Complete (26/26) — published to Chrome Web Store and Firefox AMO
- **Stage 6 (Android):** ✅ Complete (29/29) — published to Google Play
- **Stage 7 (Testing & Launch):** ⏳ 0/9 — end-to-end tests not yet run
- **Stage 8 (Infrastructure):** ✅ Complete (5/5) — roamtheweb.app live on Vercel + Cloudflare
- **Stage 9 (Security Audit):** ⏳ 32/37 — all CRITICAL issues resolved; 5 remaining
- **Stage 10 (Web Polish):** ⏳ 6/20 — 14 UX improvements pending
- **Stage 11 (Hardening):** ⏳ 29/34 — 5 LOW polish tasks remaining
- **Stage 12 (Web Rebuild):** ✅ Complete (21/22) — one task remaining
- **Stage 13 (Extension Rebuild):** ✅ Complete (9/9) — event-driven, queue-free architecture
- **Stage 14 (Android Rebuild):** ✅ Complete (11/11) — full Material3 polish, prefetch pipeline, push notifications
- **Stage 15 (P0 Reliability):** ✅ Complete (6/6) — Android P0 incidents fixed, ErrorBoundary→Sentry, 16 extension tests, CI Deno check, docs pass

### Known Blockers & Infrastructure Decisions

**✅ RESOLVED: Supabase Pro Upgrade (2026-04-30)**
- Upgraded from free tier (500 MB) to Pro ($25/month, 8 GB quota)

**✅ RESOLVED: Curlie Seeder**
- Completed: ~1,223,391 rows inserted

**✅ RESOLVED: PubMed Seeder**
- Completed: 40,154 rows inserted across 24 MeSH terms

**✅ RESOLVED: Reddit API**
- Implemented using unauthenticated public JSON API — 1,549 rows from 35 curated subreddits

**✅ RESOLVED: Play Store Submission**
- Android app published on Google Play Store

**⏳ PENDING: End-to-End Testing (Stage 7)**
- 9 manual test flows not yet executed; blocking confident launch

**✅ RESOLVED: Subcategory Backfill**
- 2,658,795 existing DB records backfilled with subcategory assignments

**⏳ IN PROGRESS: Dead URL Cleanup**
- `scripts/check-dead-urls.mjs` running; 1,067,960 / 3,109,146 URLs checked (~34%)
- Results cached in `scripts/.cache/`; commit progress tracked in `dead-links-commit-progress.json`

**✅ RESOLVED: Admin Dashboard Stat Zeros**
- Fixed with `admin_url_stats()` RPC, 3 partial/BRIN indexes, per-function statement_timeout

**⏳ PENDING: OAuth Testing (9.10)**
- Firefox extension OAuth fixed; web session restoration and Android deep link testing still need manual execution

**✅ RESOLVED: Extension Rebuild (Stage 13)**
- Queue system removed; replaced with event-driven prefetch cache in chrome.storage.session
- No long-running background loops (MV3-compatible)

**✅ RESOLVED: Android Rebuild (Stage 14)**
- Full Material3 polish, prefetch pipeline, push notifications, all screens
- Push notifications: FCM token registration, Supabase Edge Function for sending, admin email UI

**✅ RESOLVED: Pillar vs. Topic Interest Selection (8.25)**
- Users can toggle between broad category discovery and specific subcategory focus across all platforms

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
│ /collections/[slug]  Collection view │
│ /collections         Browse all      │
│ /leaderboard         XP rankings     │
│ /badges              Badge gallery   │
│ /admin               Moderation      │
│ /profile             Profile hub     │
│ /settings            Account settings│
│ /privacy, /terms     Legal           │
│ /how-it-works        Product tour    │
│ /android-beta        Beta sign-up    │
└─────────────────────────────────────┘
        ↑ (Google/GitHub OAuth)
        │
┌─ Supabase (PostgreSQL) ──────────────┐
│ Auth (Google/GitHub OAuth, email)     │
│ Tables: urls, collections,            │
│         collection_items, categories, │
│         user_categories, ratings,     │
│         moderation_queue, profiles,   │
│         seen_urls, follows,           │
│         user_settings, saved_urls,    │
│         user_interest_scores,         │
│         user_category_scores,         │
│         interest_pair_scores,         │
│         paywalled_domains, feedback,  │
│         moderation_audit_log,         │
│         url_reports, push_tokens,     │
│         notifications, beta_signups,  │
│         badges, user_badges,          │
│         user_activity, shared_urls,   │
│         email_notifications,          │
│         seeding_runs                  │
│ Edge Functions: roam, rate,           │
│                submit-url, profile,   │
│                collection, follow,    │
│                save-url, share-url,   │
│                leaderboard, feedback, │
│                log-failed-urls,       │
│                report-url, delete-user│
│                export-user,           │
│                beta-signup,           │
│                send-bulk-email,       │
│                push-notify            │
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
│ - Prefetch cache (chrome.storage)     │
│ - API calls to Supabase               │
│                                       │
│ Event-driven architecture (MV3)       │
│ - No long-running background loops    │
│ - Prefetch on popup connect           │
│ - Cache-first Roam with 5-min TTL     │
└───────────────────────────────────────┘
        ↑
┌─ Android (Kotlin + Compose) ──────────┐
│ MainScreen (NavHost with 4 tabs)      │
│ - Discover: WebView + button controls │
│ - Activity: Feed from followed users  │
│ - Badges: Gallery + level progress    │
│ - Leaderboard: XP rankings            │
│ - Saved: Saved URLs + collections     │
│ - Profile: Public profiles + edit     │
│ - Settings: Preferences + account     │
│ - Notifications: Push + in-app        │
│                                       │
│ MainViewModel                         │
│ - Discovery state + prefetch pipeline │
│ - Rating queue (offline-tolerant)     │
│ - Push notification handling          │
│                                       │
│ RoamRepository (all Supabase calls)   │
└───────────────────────────────────────┘
        ↑
┌─ Seeders (Node.js scripts) ───────────┐
│ scripts/seed-*.js/mjs                 │
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
├── CLAUDE.md                   ← AI instance instructions and project conventions
├── .env                        ← Secrets (Supabase URL, API keys)
├── README.md                   ← Project overview
│
├── web/                        ← Next.js app
│   ├── src/
│   │   ├── app/               ← Routes
│   │   ├── components/        ← Reusable UI components
│   │   ├── lib/               ← Utilities (Supabase client, auth, logger, etc.)
│   ├── package.json
│   ├── tsconfig.json
│
├── extension/                  ← Chrome/Firefox extension
│   ├── src/
│   │   ├── background/        ← Service worker (background.ts)
│   │   ├── popup/             ← Popup UI (popup.ts, popup.html, popup.css)
│   │   ├── callback/          ← OAuth PKCE callback page
│   │   ├── lib/               ← Shared utilities
│   │   │   ├── supabase.ts    ← Supabase client + storage adapter
│   │   │   ├── messages.ts    ← Message types (discriminated union)
│   │   │   └── constants.ts   ← Shared constants
│   │   └── __tests__/         ← Unit tests (Vitest)
│   ├── dist/                  ← Compiled extension (Chrome)
│   ├── dist-firefox/          ← Compiled extension (Firefox)
│   ├── manifest.json          ← Chrome extension metadata
│   ├── manifest.firefox.json  ← Firefox extension metadata
│   ├── TESTING.md             ← Complete testing guide
│   ├── DESIGN.md              ← Architecture spec
│   ├── package.json
│
├── supabase/                   ← Database & Edge Functions
│   ├── migrations/            ← SQL schema versions (50+ files)
│   ├── functions/             ← Edge Functions (Deno) — 17 total
│   │   ├── roam/              ← GET /roam (main discovery RPC)
│   │   ├── rate/              ← POST /rate (voting)
│   │   ├── submit-url/        ← POST /submit-url (user submissions)
│   │   ├── push-notify/       ← POST /push-notify (push notifications)
│   │   └── ...
│   └── README.md              ← Backend overview
│
├── scripts/                    ← Node.js seeders
│   ├── lib/
│   │   └── seed.js            ← Shared seeding utilities
│   ├── seed-*.mjs/js          ← 30+ source-specific seeders
│   ├── backfill-og-metadata.mjs
│   └── .cache/                ← Local seeder output (gitignored)
│
├── docs/                       ← Documentation
│   ├── CONTEXT.md              ← This file
│   ├── ROADMAP.md              ← Task history
│   ├── API.md                  ← Edge Function contracts
│   ├── COSTS.md                ← Infrastructure costs
│   └── *.md                    ← Audit reports, plans, etc.
│
└── android/                    ← Kotlin + Jetpack Compose app
```

### Key Dependencies & Integrations

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Web | Next.js 16 + Supabase JS | Server + client auth, DB queries |
| Extension | Chrome APIs + Supabase JS | Native extension APIs, session storage |
| Database | PostgreSQL (Supabase) | Single source of truth for URLs, users, ratings |
| Auth | Supabase Auth + Google/GitHub OAuth | Passwordless, cross-platform session |
| Seeders | Node.js + fetch | Data ingestion from 30+ public APIs/sources |
| Deploy | Vercel (web) + Supabase (DB) | Automatic git deploys |
| Observability | Sentry (all platforms) | Error tracking, issue management |
| Push | Firebase Cloud Messaging + Supabase | Android push notifications |
| Logs | Vercel CLI / Supabase dashboard | Runtime log streaming and query analysis |

---

## 4. IMMEDIATE STATE & BLOCKERS

### What's Working ✅

- All four client surfaces deployed: web app (Vercel), Chrome/Firefox extension (published), Android app (published)
- Auth (Google/GitHub OAuth, email/password, session persistence) across all platforms
- Event-driven prefetch cache in extension (chrome.storage.session, no background loops)
- Prefetch pipeline in Android (instant card-to-card navigation)
- Config panels (collections, language prefs, paywall toggle, discovery mode)
- Message dispatch system (type-safe, discriminated unions)
- 30+ seeded content sources (~2.8M active URLs)
- Web app: landing, onboarding, profiles, collections, leaderboard, badge gallery, admin moderation (detail view, undo, filtering, 15-card dashboard)
- Gamification: 70+ badges, leveling system (1-50), XP tracking, weekly/monthly/all-time leaderboards
- Social features: activity feed, URL sharing with push notifications, follows, public profiles
- Interest calibration algorithm (revealed-preference scoring + adjacent-category serendipity + pillar/topic modes)
- CI/CD pipelines (GitHub Actions for build, test, lint, security scanning, deploy)
- Sentry error tracking across all platforms
- GDPR data export and account deletion
- Domain `roamtheweb.app` live on Vercel + Cloudflare
- Push notifications infrastructure (FCM tokens, Edge Function, admin email UI)

### Known Issues & Blockers ❌

1. **End-to-end testing not yet run (Stage 7)**
   - Status: 9 test flows defined but not executed
   - Impact: Cannot confidently launch without running them
   - Priority: HIGH (pre-launch requirement)

2. **OAuth testing partially complete (9.10)**
   - Status: Firefox extension OAuth verified and fixed; Android OAuth sign-in code fixed; manual verification still needed
   - Priority: HIGH

3. **Dead URL cleanup ongoing**
   - Status: ~2.04M URLs remaining to check; checker running at concurrency=50
   - Priority: MEDIUM (pool quality improvement)

### Decision Points (Need Your Input)

**1. End-to-end testing timing** — Run Stage 7 tests before or after additional feature work?
   - A) **Before** — Run E2E tests now as the launch-readiness gating step
   - B) **After** — Continue feature work (web polish, seeder improvements), test later

**2. Web UX gaps** — Stage 10 has 14 open tasks; which are required?
   - Remaining: 10.8 (better empty states), 10.12-10.21 (various polish items)

**3. Future seeders** — Which optional sources to add?
   - High value: Smithsonian, IGDB, Podcast Index, Aeon, Longreads
   - Pool quality sweep: Dead-link cleanup will improve existing entries

### Current Data Status

- **Total URLs in DB:** ~3.1M seeded; ~323K retired as dead; ~2.8M active
- **Coverage:** Strong across all 8 pillars
- **Dead-link cleanup:** In progress — checker running at concurrency=50
- **Paywall domains:** 23 known paywalled domains tracked
- **Language tagging:** All rows tagged

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
```

**Follow this pattern:** Every new message type gets a discriminated union entry + a handler function.

**Seeder Pattern**

```typescript
// 1. Fetch from external API with rate limiting
async function fetchData() { ... }

// 2. Parse/transform to URL rows
function transformToRows(data) { ... }

// 3. Cache locally (JSON file)
writeFileSync(CACHE_FILE, JSON.stringify(rows));

// 4. Upsert using shared utility
await upsertUrls(rows, { fetchOg: true/false });
```

**Follow this pattern:** Use `upsertUrls()` from `lib/seed.js` for all seeders.

**Extension Prefetch Pattern**

The extension uses event-driven prefetch, not background loops:

```typescript
// On popup connect: fire a prefetch
chrome.runtime.onConnect.addListener(() => {
  prefetchNext(); // fire-and-forget, writes to chrome.storage.session
});

// Roam handler: cache-first
async function roam() {
  const cached = await getPrefetchEntry();
  if (cached && !isStale(cached)) {
    prefetchNext(); // re-fill cache
    return cached;
  }
  return await callRoamApi(); // live call on cache miss
}
```

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
| docs/ROADMAP.md | Living task history and audit trail | After every task |
| extension/src/lib/messages.ts | Message type definitions | Adding new popup ↔ background messages |
| extension/src/background/background.ts | Message dispatcher & API handlers | New feature implementations |
| scripts/lib/seed.js | Shared seeding utilities | Changing how seeders upsert data |
| supabase/functions/roam/index.ts | Main discovery RPC | Changing how URLs are selected |
| supabase/migrations/ | Database schema | Adding tables or columns |
| docs/API.md | Edge Function RPC contracts | Updating API docs |
| docs/OAuth-Testing-Checklist.md | Pre-launch OAuth validation checklist | Pre-release testing |

### Common Commands

```bash
# Web development
cd web && pnpm dev            # Start Next.js dev server
cd web && pnpm test:ci        # Run tests (Jest)

# Extension development
cd extension && pnpm build    # Build extension (Chrome)
cd extension && pnpm build -- --firefox  # Firefox build
cd extension && pnpm dev      # Build in watch mode (auto-rebuild)
# Then load dist/ in Chrome or dist-firefox/ in Firefox

# Seeders (all complete; re-run with --no-cache to refresh)
node scripts/seed-guardian.js --no-cache

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
2. **Prefetch** — Cache loads on popup connect, first Roam is near-instant
3. **Roam button** — Consumes prefetch, fires next prefetch, navigates tab
4. **Config panel** — Collections CRUD, roaming modes, preferences
5. **Error states** — Handle API failures gracefully

---

## Final Notes

- **This document is a living reference.** If you find gaps or things that are wrong, update it for the next person.
- **ROADMAP.md is your audit trail.** Always check it before starting something; it'll tell you what's been tried and what failed.
- **Ask early, ask often.** Questions cost way less than fixes.
- **The user cares about complete, elegant systems, not speed.** Thorough wins every time.

Good luck. You've got a great project to work on.