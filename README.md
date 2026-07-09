# Roam — Rediscover the Web

> Press one button. Land somewhere interesting.

Roam is a web discovery platform built around a simple idea: the internet is full of genuinely great content, but the tools we use to find it are broken. Algorithms optimise for engagement. Search requires knowing what you're looking for. Bookmarks pile up unread.

Press the button and land on a real page, curated by real users, matched to what you actually care about. No feeds, no infinite scroll, no recommendation engine trying to maximise your session time.

---

## Status

| Component | Status |
|---|---|
| Supabase backend | ✅ Live |
| Web app | ✅ Live |
| Browser extension (Chrome + Firefox) | ✅ Live — published on Chrome Web Store and Firefox AMO |
| Android app | ✅ Live — published on Google Play Store |

---

## How the algorithm works

The discovery function runs directly in PostgreSQL. When you press the button, it balances five signals to pick a page you'll likely enjoy:

- **Community quality** — statistically-correct ranking (Wilson score) that handles small vote counts fairly
- **Editorial signal** — source reputation (HN score, citation count, Reddit karma, etc.)
- **Your taste** — topics you upvote more often surface more; topics you downvote dial back. Calibrated per subcategory.
- **Freshness** — recently published pages get a mild boost; very old ones fade gradually
- **Exploration bonus** — newly seeded pages receive a small boost to keep fresh content circulating


---

## Features

**Discovery**
- One button, filtered to your interests
- 30-minute domain cooldown prevents seeing the same site twice in a row
- 12% chance of an adjacent topic in discovery mode — intentional serendipity
- Focus mode lets you narrow discovery to specific topics or categories you select
- Collection mode stays within a saved list

**Personalisation**
- Topic affinity: upvoting a topic more often increases how frequently it appears (up to 2× weight; floor 0.4×). Downvoting doesn't hide a topic — it just dials the weight back slightly. Calibrated per subcategory.
- Domain muting: two downvotes from the same domain triggers a 30-day auto-mute
- Language filter, paywall opt-out
- Subcategories: the system tracks your preferences within 72 subcategories across 8 category pillars for granular personalization

**Community**
- URL submission with moderation queue and duplicate detection
- Wilson score ranking — statistically correct; a page with 10/10 upvotes ranks accurately against one with 800/1000
- Thumbs up/down with automatic score recalculation on every vote

**Collections & social**
- Public or private collections, saved with one tap
- Follow users, browse their activity
- Profile pages with stats (pages rated, submitted, followers)
- Activity feed — see what people you follow are discovering and rating
- URL sharing — send a URL directly to another user with push notification
- Pillar vs. topic interest selection — toggle between broad category discovery or specific subcategory focus

**Gamification**
- 70+ badges across 12 categories (discovery, curation, streaks, social, niches, and more)
- Level progression (1–50) with XP earned from rating, submitting, and discovering
- Leaderboard — compete on weekly, monthly, and all-time XP rankings
- Badge gallery with unlock details and progress tracking
- Push/email notifications for badge unlocks and level-ups

---

## Platforms

### Browser extension

Deliberately non-intrusive. Click, roam, rate, close — nothing is injected into pages you visit.

- Prefetch cache (chrome.storage.session) for near-instant navigation
- Detects and rates the page you're currently viewing
- Chrome (MV3) and Firefox (MV3)
- Event-driven service worker architecture — no background loops

### Android app

- In-app browser so you don't have to leave
- Prefetch pipeline for instant card-to-card navigation
- Browsing history screen with search and filtering
- Push notifications for new features, badge unlocks, level-ups, and shared URLs
- Activity feed — see what people you follow are discovering and rating
- Leaderboard — weekly, monthly, and all-time XP rankings
- Badge gallery with 70+ badges and level progression
- Public profiles, follows, and URL sharing
- Material Design 3 / Jetpack Compose
- Android 8.0+ (SDK 26), target SDK 35
- Google OAuth or email/password sign-in
- Offline rating queue with automatic flush on reconnect


### Web

- Account management portal, onboarding, and admin moderation
- Next.js 16 / TypeScript / Tailwind CSS, deployed on Vercel
- 15-card admin analytics dashboard with request-time caching

See [web/README.md](web/README.md) for the current route map and UI spec.

---

## Architecture

### Backend — Supabase (PostgreSQL)

The database does the heavy lifting. Discovery runs as a `plpgsql` RPC (`roam()`) invoked via a Deno Edge Function. Row-Level Security enforces all access control at the database level. Every successful discovery is tracked via `serve_count` for analytics.

Edge Functions (Deno) handle operations that need more than a simple query: `roam`, `rate`, `submit-url`, `save-url`, `collection`, `follow`, `profile`, `feedback`, `report-url`, `log-failed-urls`, `leaderboard`, `share-url`, `delete-user`, `export-user`, `beta-signup`, `send-bulk-email`, `push-notify`.

**Key tables:**

| Table | Purpose |
|---|---|
| `urls` | All discovered pages — URL, title, description, votes, scores, source |
| `ratings` | Per-user votes |
| `seen_urls` | Tracks what each user has already been served |
| `user_interest_scores` | Per-user, per-subcategory calibration weights |
| `user_category_scores` | Per-user, per-category calibration (for unsegmented URLs) |
| `interest_pair_scores` | Adjacent-category pair scoring for serendipity |
| `user_domain_cooldowns` | 30-minute per-session domain cooldown |
| `user_suppressed_domains` | 30-day domain suppression (from repeated downvotes) |
| `collections` / `collection_items` | User-saved lists |
| `profiles` / `follows` | Social layer |
| `moderation_queue` | Submitted URLs pending review |
| `moderation_audit_log` | Immutable log of admin moderation decisions |
| `url_reports` | User reports of broken/dead links |
| `push_tokens` / `notifications` | Push notification infrastructure |
| `beta_signups` / `feedback` | Waitlist signups and in-app feedback |
| `badges` / `user_badges` | Gamification — badge definitions and per-user unlocks |
| `user_activity` | Activity feed — recent actions by followed users |
| `shared_urls` | Peer-to-peer URL sharing between users |
| `seeding_runs` | Seeder execution audit log |
| `email_notifications` | Email notification preferences and tracking |

### Browser extension

Event-driven service worker architecture (MV3). `background.ts` owns all state and logic; `popup.ts` is purely UI; `callback.ts` handles OAuth PKCE callback. Prefetch cache in `chrome.storage.session` delivers near-instant navigation.

### Android

Kotlin + Jetpack Compose + Supabase Kotlin SDK. Single-activity MVVM with `MainViewModel` owning all discovery, profile, settings, and collection state. `RoamRepository` handles all Supabase calls. Prefetch pipeline keeps the next URL cached for instant card-to-card swiping.

---

## Repository structure

```
roam/
├── supabase/
│   ├── migrations/         # 50+ SQL migrations
│   └── functions/          # 17 Deno Edge Functions
│       └── _shared/        # CORS, auth helpers, rate limiting, Sentry
│
├── web/                    # Next.js app (Vercel)
│   └── src/
│       ├── app/            # App router pages
│       ├── components/
│       └── lib/
│
├── extension/              # Chrome + Firefox extension
│   └── src/
│       ├── background/     # Service worker
│       ├── popup/          # UI
│       ├── callback/       # OAuth callback page
│       └── lib/            # Supabase client, messages
│
├── android/                # Kotlin + Compose app
│   └── app/src/main/java/app/roam/android/
│       ├── ui/             # Compose screens & components
│       ├── viewmodel/
│       ├── data/
│       └── model/
│
├── scripts/                # Content seeders & utilities
│   └── lib/                # Shared seeding library
│
└── docs/                   # Audit docs, reports, roadmap, API reference
```

---

## Development setup

### Prerequisites

- Node.js 20+, pnpm 10+
- Supabase CLI (`npm install -g supabase`)
- Android Studio Ladybug+ (Android only)

### Backend

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # applies all migrations
supabase functions deploy # deploys all edge functions
```

### Browser extension

```bash
cd extension
pnpm install
pnpm build   # outputs to dist/ (Chrome) and dist-firefox/
pnpm dev     # watch mode

# Load in Chrome: chrome://extensions → Developer mode → Load unpacked → dist/
# Load in Firefox: about:debugging → This Firefox → Load Temporary Add-on → dist-firefox/manifest.json
```

### Web

```bash
cd web
pnpm install

# .env.local (never commit)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

pnpm dev    # localhost:3000
pnpm build
pnpm lint
```

Vercel auto-deploys on push to `main` if connected.

### Android

Create `android/local.properties` (never commit):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Open in Android Studio and run, or from the command line:

```bash
./gradlew assembleRelease   # APK
./gradlew bundleRelease     # AAB for Play Store
```

---

## Environment variables

**Web** (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=         # server-side only, for source maps
```

**Android** (`local.properties`):
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SENTRY_DSN=
```

**Edge Function secrets:**
```bash
supabase secrets set SENTRY_DSN=https://...
supabase secrets set SAFE_BROWSING_API_KEY=...
supabase secrets list
```

---

## Tests

```bash
cd extension && pnpm test       # Vitest (16 tests)
cd web && pnpm test             # Jest (19 tests)
cd web && pnpm test:ci          # Jest CI (coverage + no-watch)
cd android && ./gradlew test    # JUnit (6 tests)
cd android && ./gradlew connectedAndroidTest   # requires emulator
```

---

## Monitoring

All platforms report errors to Sentry. The Supabase dashboard covers slow queries, function invocations, and storage usage.

Sentry: https://7-lynx.sentry.io/projects/

---

## Troubleshooting

**"Unauthorized" from Supabase** — check your anon key is set correctly and the relevant RLS policies exist.

**Extension not detecting current page** — verify `callback.ts` is loaded (DevTools → Sources → Extensions) and `manifest.json` has the right `content_scripts` entry. Reload with F5.

**Android won't build** — run `./gradlew clean` and re-sync. Check `local.properties` has valid credentials.

**Pop-up appears blank after install** — the service worker may not have started yet. Open the popup once, wait 2 seconds, and try again.

---

## Contributing

PRs are welcome. Good starting points: open bugs in the Issues list and UI improvements to the web or extension.

```bash
git checkout -b feature/my-thing
# make changes
git commit -m "feat: describe the change"
git push origin feature/my-thing
# open a pull request
```

Run `pnpm lint` before pushing. Use TypeScript throughout.

---

## License

**Dual Licensed:**

- **Open Source:** MIT License ([LICENSE](LICENSE)) — Free to use, modify, and distribute for personal, research, and open-source projects.
- **Commercial:** For commercial deployments, white-label services, or closed-source modifications, see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).

**In short:**
- Contribute back to open source? Use MIT, no cost.
- Run as a commercial service or resell? Commercial license required.
- Fork and open-source? Use MIT, no cost.
- Use for personal/internal projects? Use MIT, no cost.

---

Built with Supabase, Next.js, Jetpack Compose, esbuild, Tailwind CSS, and TypeScript.

Made by 7 Lynx. Questions? [Open an issue](https://github.com/seven-lynx/Roam/issues).