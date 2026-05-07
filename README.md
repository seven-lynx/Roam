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
| Browser extension (Chrome + Firefox) | ✅ Live |
| Android app | 🔨 In development |

---

## How the algorithm works

The discovery function runs directly in PostgreSQL. When you press the button, it balances four signals to pick a page you'll likely enjoy:

- **Community quality** — statistically-correct ranking that handles small vote counts fairly
- **Editorial signal** — source reputation (HN score, citation count, Reddit karma, etc.)
- **Your taste** — topics you upvote more often surface more; topics you downvote dial back
- **Freshness** — recently published pages get a mild boost; very old ones fade gradually

There's also a small bonus for pages nobody has rated yet, to keep fresh content circulating rather than the same well-worn URLs.


---

## Features

**Discovery**
- One button, filtered to your interests
- 30-minute domain cooldown prevents seeing the same site twice in a row
- 12% chance of an adjacent topic in discovery mode — intentional serendipity
- Deep dive mode narrows to your top-3 subcategories by calibrated weight
- Collection mode stays within a saved list

**Personalisation**
- Topic affinity: upvoting a topic more often increases how frequently it appears (up to 2× weight; floor 0.4×). Downvoting doesn't hide a topic — it just dials the weight back slightly.
- Domain muting: two downvotes from the same domain triggers a 30-day auto-mute
- Language filter, paywall opt-out, NSFW filter

**Community**
- URL submission with moderation queue and duplicate detection
- Wilson score ranking — statistically correct; a page with 10/10 upvotes ranks accurately against one with 800/1000
- Thumbs up/down with automatic score recalculation on every vote

**Collections & social**
- Public or private collections, saved with one tap
- Follow users, browse their activity
- Profile pages with stats (pages rated, submitted, followers)

---

## Platforms

### Browser extension

Deliberately non-intrusive. Click, roam, rate, close — nothing is injected into pages you visit.

- Hot queue of 3 pre-fetched URLs for instant clicks; a background warming queue keeps it full
- Detects and rates the page you're currently viewing
- Chrome (MV3) and Firefox (MV3)
- Source maps uploaded to Sentry on each build

### Android app

- Swipe right to like, left to skip, down for details
- In-app browser so you don't have to leave
- Offline reading queue
- Material Design 3 / Jetpack Compose
- Android 8.0+ (SDK 26), target SDK 34

### Web

- Account management, collections, URL submission
- Admin moderation and analytics dashboards
- Next.js 15 / TypeScript / Tailwind CSS, deployed on Vercel

---

## Architecture

### Backend — Supabase (PostgreSQL)

The database does the heavy lifting. Discovery runs as a `plpgsql` RPC (`roam()`) called directly from clients — no extra network hop through a separate compute layer. Row-Level Security enforces all access control at the database level.

Edge Functions (Deno) handle operations that need more than a simple query: `rate`, `submit-url`, `collection`, `follow`, `profile`, `log-failed-urls`.

**Key tables:**

| Table | Purpose |
|---|---|
| `urls` | All discovered pages — URL, title, description, votes, scores, source |
| `ratings` | Per-user votes |
| `seen_urls` | Tracks what each user has already been served |
| `user_interest_scores` | Per-user, per-subcategory calibration weights |
| `user_domain_cooldowns` | Active domain suppression windows |
| `collections` / `collection_items` | User-saved lists |
| `profiles` / `follows` | Social layer |
| `moderation_queue` | Submitted URLs pending review |

### Browser extension

Service worker architecture (MV3). `background.ts` owns all state and logic; `popup.ts` is purely UI; `callback.ts` detects the current tab URL for in-context rating.

### Android

Kotlin + Jetpack Compose + Supabase Kotlin SDK. MVVM pattern with ViewModels and a data repository layer.

---

## Repository structure

```
roam/
├── supabase/
│   ├── migrations/         # 40+ SQL migrations
│   └── functions/          # Deno Edge Functions
│       ├── rate/
│       ├── submit-url/
│       ├── collection/
│       ├── follow/
│       ├── profile/
│       ├── log-failed-urls/
│       └── _shared/        # CORS headers, auth helpers
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
│       ├── callback/       # Content script
│       └── lib/            # Queue, Supabase client
│
├── android/                # Kotlin + Compose app
│   └── app/src/main/kotlin/com/roam/
│       ├── ui/             # Compose screens
│       ├── viewmodel/
│       └── data/
│
├── scripts/                # Seeder scripts (Wikipedia, HN, Guardian, etc.)
└── docs/                   # ALGORITHM.md, ROADMAP.md, etc.
```

---

## Development setup

### Prerequisites

- Node.js 20+, pnpm 9+
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
pnpm watch   # rebuild on change
```

**Load in Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `dist/`

**Load in Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on → `dist-firefox/manifest.json`

**Debug:**
```
# Service worker console
chrome://extensions → Roam → Inspect views → service worker

# Popup console
Click extension icon → Right click → Inspect popup
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
DATABASE_URL=            # server-side only
```

**Android** (`local.properties`):
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

**Edge Function secrets:**
```bash
supabase secrets set SENTRY_DSN=https://...
supabase secrets list
```

---

## Tests

```bash
cd extension && pnpm test
cd web && pnpm test
cd android && ./gradlew test
cd android && ./gradlew connectedAndroidTest   # requires emulator
```

---

## Monitoring

All platforms report errors to Sentry. The Supabase dashboard covers slow queries, function invocations, and storage usage.

Sentry: https://7-lynx.sentry.io/projects/roam-extension

---

## Troubleshooting

**"Unauthorized" from Supabase** — check your anon key is set correctly and the relevant RLS policies exist.

**Extension not detecting current page** — verify `callback.ts` is loaded (DevTools → Sources → Extensions) and `manifest.json` has the right `content_scripts` entry. Reload with F5.

**Android won't build** — run `./gradlew clean` and re-sync. Check `local.properties` has valid credentials.

**Queue not refilling** — confirm the service worker is alive at `chrome://serviceworkers` and check for errors in the extension's background console.

---

## Contributing

PRs are welcome. Good starting points: open bugs in the Issues list, UI improvements to the web or extension, and new seed sources in `scripts/`.

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

MIT — see [LICENSE](LICENSE). Free to use, modify, and distribute, including commercially.

---

Built with Supabase, Next.js, Jetpack Compose, esbuild, Tailwind CSS, and TypeScript.

Made by Seito. Questions? [Open an issue](https://github.com/seven-lynx/Roam/issues).

What is Roam?

The internet is vast and wonderful, but discovery has been broken for years. Algorithmic feeds optimize for engagement, not quality. Bookmarking services feel like digital graveyards. Search requires knowing what you're looking for.

Roam brings back the joy of stumbling — the simple act of pressing a button and landing somewhere unexpected that still aligns with what you care about. No feeds. No algorithms optimized to keep you scrolling. No noise. Just real pages, real user votes, and real serendipity.
Why Roam?

The problem with existing discovery tools:

    Algorithmic feeds — optimize for time-on-site, not quality
    Search engines — require you to know what you're looking for
    Static curated lists — curators can't match millions of user interests
    Random links — no personalization, no quality signal
    Social media — feeds designed for engagement, not discovery

Roam solves this with:

    Community voting — real users rate pages, not algorithms
    Transparent personalization — your interests control what you see
    Quality filter — pages with sustained negative votes are deprioritized
    Fresh content — users continuously submit new URLs
    Multi-platform — web, mobile, and browser extension all sync
    Zero ads, zero tracking — Roam doesn't profit from your attention

Platform Status
Component 	Status 	Audience
Supabase Backend 	✅ Live 	All platforms
Web Platform 	✅ Live 	Desktop/tablet browsers
Browser Extension 	✅ Live 	Chrome & Firefox users
Android App 	In development 	Mobile Android users
Core Features
Discovery Engine

The heart of Roam is the discovery algorithm. Unlike recommendation engines that optimize for engagement:

    Roam button — one tap/click delivers a curated page matching your active interest filters
    Interest categories — select categories at signup and adjust at any time (Arts, Science, Tech, News, Gaming, etc.)
    Community-voted ranking — pages are ranked by real user votes, not engagement metrics
    Domain diversity — discovery engine spreads results across different domains to avoid filter bubbles
    Personalized pool — each user gets a candidate pool pre-filtered to their interests, then a single page is randomly selected and served
    Wilson score ranking — community votes use statistical methods to surface genuinely good content, not just popular content
    Contextual discovery — "Roam within site" mode lets you stay on a specific domain and discover more pages from it
    Language filtering — filter results by language preference
    Adult content filter — option to exclude NSFW content

Transparent Personalization

Your recommendations are controlled by just two mechanisms:

    Topic affinity — topics you thumbs-up more often appear slightly more often in your results (up to +30% weight boost). Topics you down-vote are not hidden — just weighted a little less, preserving serendipity.

    Domain muting — if you thumbs-down 2 or more pages from the same website, that site is automatically muted for 30 days. No manual blocklist to manage; the mute expires on its own.

Community-level filtering also applies:

    Pages with sustained negative votes from the whole user base are deprioritized for everyone
    Spam and duplicates are removed by moderators
    Paywalled content can be flagged and deprioritized

Content Management

Users drive the content pool:

    URL submission — any user can submit a new page to Roam
    Category tagging — submitters tag pages with relevant categories
    Moderator queue — submissions are queued for community review
    Duplicate detection — system prevents the same URL from being added twice
    Domain tracking — track which domains contribute most pages and which have lowest user satisfaction
    Organic growth — content pool expands only through user contributions

User Accounts & Profiles

    Authentication — email + password or Google OAuth
    Interest profile — select categories that match your interests
    Discovery history — track what pages you've already rated
    Personal blocklist — manually mute domains for 30 days
    Saved collections — create public or private collections to save pages
    User profile — see your stats: pages rated, collections created, followers
    Account settings — manage auth, privacy, notifications

Social Layer

    Follow other users — see their activity and recommendation history
    Shared collections — create public collections to share with followers
    User profiles — browse what pages other users have rated highly
    Activity notifications — get notified when users you follow like a page you submitted
    Reputation — track how many followers you have and pages you've contributed

Browser Extension

Purpose-built for the discovery workflow:

    Non-intrusive design — click popup, roam, rate, close. Nothing is injected into pages.
    Roam button — get a new page instantly
    Thumbs up / down — rate pages while browsing
    Category/collection controls — save pages to collections or filter by category
    Browser-tab integration — detects and rates the URL you're currently viewing
    Queue prefetching — fetches next 3 pages in background for instant loading
    Offline support — works even if you lose network momentarily
    Chrome (MV3) + Firefox (MV3) — compatible with modern browser extension standards
    Automatic updates — stays in sync with web platform (ratings, follows, collections)

Android App

Optimized for mobile discovery:

    In-app browser — read pages directly in the app without leaving
    Swipe gestures — swipe right to like, swipe left to skip, swipe down for details
    Quick-add to collections — save pages with one tap
    Offline reading queue — save pages for later without network
    Push notifications — get notified of activity (followers, collections, submissions)
    Dark mode — eye-friendly nighttime reading
    Android 8.0+ support — works on older devices
    Material Design 3 — native Android look and feel using Jetpack Compose

Web Platform

Full-featured discovery and account management:

    Discovery interface — web version of roam, with advanced filters
    Account management — edit profile, interests, collections, followers
    URL submission — submit new pages directly
    Moderation dashboard — (admin) review and approve submissions
    Analytics dashboard — view platform stats and trends
    Responsive design — works on desktop and tablet

Architecture & Tech Stack
Backend Architecture — Supabase (PostgreSQL + Edge Functions)

Built entirely on Supabase's free tier for cost-effective, serverless operation:

Database Layer

    PostgreSQL — Supabase free tier (500 MB storage, sufficient for millions of discovery records)
    Row-Level Security (RLS) — all access control enforced at the database level; no application-layer auth needed
    Key tables:
        urls — discovered pages (url, title, description, category, community votes, wilson_score)
        collections — user-created collections (name, description, visibility, owner)
        collection_items — pages saved to collections
        profiles — user profiles (email, interests, settings, follower count)
        follows — follow relationships between users
        ratings — user votes (url_id, user_id, vote direction, timestamp)
        moderation_queue — submitted URLs pending approval
        seen_urls — track which pages a user has already rated (prevents duplicates)

Authentication

    Supabase Auth — email/password + Google OAuth out-of-box
    Session persistence — browser-based session storage with auto-refresh
    Admin role — users with is_admin=true can moderate submissions

Server-Side Logic — Edge Functions (Deno)

    roam(category_filter?, exclude_domain?) — core algorithm RPC function:
        Filters candidate pool by user's categories and muted domains
        Applies personalization weights (topic affinity + domain muting)
        Samples from remaining candidates using Wilson score ranking
        Returns single URL with metadata (title, description, category, OG image)
        Falls back gracefully when pool is exhausted

    rate(url_id, vote) — record user votes:
        Validates URL ownership and user permissions
        Updates vote count and recalculates Wilson score
        Records in ratings table for personalization
        Triggers domain-mute logic if threshold reached

    submit-url(url, category) — submit new pages:
        Normalizes URL (removes tracking params, www prefix, fragments)
        Checks for duplicates
        Adds to moderation queue
        Notifies moderators

    collection(action, ...) — manage saved pages:
        Create collections
        Add/remove URLs from collections
        List collections with item counts
        Share collections publicly

    follow(action, user_id) — manage follows:
        Follow/unfollow users
        List followers and following
        Calculate follower counts for profiles

    log-failed-urls(failed_urls) — batch error logging:
        Records URLs that failed validation (for moderation)
        Implements retry logic with exponential backoff
        Captures to Sentry for monitoring

API Gateway & CORS

    All Edge Functions use shared CORS headers (_shared/cors.ts)
    Authentication via Supabase bearer token in Authorization header
    All endpoints are POST or POST+OPTIONS (for CORS preflight)

Browser Extension (/extension)

Architecture

    Manifest V3 — modern extension standard, works on Chrome and Firefox
    Service Worker — background.ts handles all logic:
        Persistent storage of auth state and queue
        Message routing from popup and content scripts
        Background sync (queue refilling, failed URL retries)
    Popup UI — popup.ts handles user interface
    Content Script — callback.ts detects current page and enables rating

Build & Distribution

    Build tool — esbuild with TypeScript
    Source maps — uploaded to Sentry with @sentry/esbuild-plugin
    Chrome — Chrome Web Store ($5 one-time)
    Firefox — Firefox Add-ons (free)
    Sentry integration — monitors crashes and errors from all users

Queue Management

    Hot queue — 3 pre-fetched URLs ready to display instantly
    Warming queue — 5 additional URLs being fetched in background
    Prefetch loop — continuously maintains queue above threshold
    Persistent storage — chrome.storage.local survives restarts
    Retry logic — failed fetches retry with exponential backoff

Key Modules

    background.ts — service worker, message dispatcher, auth handler
    popup.ts — UI logic, roam button, rating buttons, category filter
    callback.ts — detects current page, enables rating of known URLs
    lib/queue.ts — queue state management and batch retry
    lib/queueManager.ts — background loops for validation and refill
    lib/supabase.ts — Supabase client factory with auth state

Android App (/android)

Language & UI

    Kotlin — type-safe, concise Android development
    Jetpack Compose — modern declarative UI framework
    Material Design 3 — latest Android design system with theming
    Navigation Compose — type-safe navigation between screens

Networking & Authentication

    Supabase Kotlin client — official SDK for database and auth
    Google Sign-In — integrated into Supabase Auth
    Session persistence — auto-refresh tokens via Supabase

Key Features

    In-app WebView — render discovered pages within the app
    Swipe gestures — intuitive right (like) / left (skip) / down (details) interactions
    Offline queue — save pages with content snapshot for offline reading
    Push notifications — Firebase Cloud Messaging for activity alerts
    Min SDK 26 (Android 8.0) — supports older devices
    Target SDK 34 (Android 14) — modern API features

Key Screens

    Roam screen — display current URL, swipe controls, metadata
    Collections screen — create and manage saved page collections
    Profile screen — view account, interests, followers, statistics
    Following screen — discover and follow other users
    Settings screen — auth, notifications, content filtering

Web Platform (/web)

Framework & Build

    Next.js 15 — React framework with server-side rendering
    TypeScript — type-safe full-stack code
    Tailwind CSS — utility-first styling
    Vercel deployment — free tier hosting with auto-deployment on git push

Key Pages

    Home — roam interface with discovery
    Profile — view user account and statistics
    Collections — browse public collections
    Submit URL — contribute new pages
    Moderation (admin) — review and approve submissions
    Analytics (admin) — view platform statistics

Authentication & State

    Supabase Auth — user sessions and permissions
    Server-side sessions — secure auth via Supabase SSR library
    Client-side persistence — React Query for state management

Database Design Highlights

Efficient Discovery

    urls table indexed on category_id and approved for fast filtering
    ratings table indexed on url_id for vote aggregation
    seen_urls tracks viewed pages to prevent repeats
    Wilson score algorithm ranks pages statistically correctly (no bias toward new or old)

Scalability

    Normalized schema prevents data duplication
    RLS policies prevent data leakage between users
    Foreign keys enforce referential integrity
    Materialized queries cache expensive aggregations (follower counts, collection sizes)

Repository Structure

roam/
├── supabase/                   # Backend database & serverless functions
│   ├── config.toml            # Supabase local dev config
│   ├── migrations/            # SQL migrations (initialize schema)
│   │   ├── 20260423000000_initial.sql              # Core tables: users, urls, collections
│   │   ├── 20260424000000_schema_improvements.sql  # Indexes and constraints
│   │   ├── 20260426000000_fix_roam_null_subcategories.sql  # Category handling
│   │   └── ... (40+ migrations)                    # Performance tuning, RPC functions
│   └── functions/              # Deno Edge Functions (TypeScript)
│       ├── roam/              # GET /functions/v1/roam — core discovery algorithm
│       ├── rate/              # POST /functions/v1/rate — record votes
│       ├── submit-url/        # POST /functions/v1/submit-url — contribute URLs
│       ├── collection/        # POST /functions/v1/collection — manage collections
│       ├── follow/            # POST /functions/v1/follow — manage follows
│       ├── profile/           # GET /functions/v1/profile — user profile data
│       ├── log-failed-urls/   # POST /functions/v1/log-failed-urls — error tracking
│       └── _shared/           # Shared utilities
│           ├── cors.ts        # CORS headers for all endpoints
│           └── auth.ts        # Auth helper functions
│
├── web/                        # Next.js web application (Vercel)
│   ├── src/
│   │   ├── app/              # Next.js app directory
│   │   │   ├── page.tsx      # Home page (roam interface)
│   │   │   ├── profile/      # User profile pages
│   │   │   ├── collections/  # Collection browsing
│   │   │   └── submit/       # URL submission form
│   │   ├── components/        # React components
│   │   ├── lib/              # Utility functions
│   │   └── middleware.ts      # Auth middleware
│   ├── package.json          # Dependencies and build scripts
│   ├── next.config.ts        # Next.js configuration
│   ├── tsconfig.json         # TypeScript config
│   └── .env.local            # Supabase credentials
│
├── extension/                  # Browser extension (Chrome + Firefox)
│   ├── src/
│   │   ├── background/       # Service worker (background.ts)
│   │   ├── popup/            # Popup UI (popup.ts, popup.css, popup.html)
│   │   ├── callback/         # Content script (callback.ts)
│   │   ├── lib/              # Shared utilities
│   │   │   ├── queue.ts      # Queue state and batch retry
│   │   │   ├── queueManager.ts  # Background loops
│   │   │   └── supabase.ts   # Supabase client factory
│   │   └── types/            # TypeScript type definitions
│   ├── icons/                # Extension icons (16x16, 32x32, 48x48, 128x128)
│   ├── dist/                 # Compiled output (ignored in git)
│   ├── dist-firefox/         # Firefox-specific bundle
│   ├── manifest.json         # Extension manifest (Chrome)
│   ├── manifest.firefox.json # Extension manifest (Firefox)
│   ├── build.mjs             # esbuild configuration
│   ├── package.json          # Dependencies
│   └── tsconfig.json         # TypeScript config
│
├── android/                    # Android app (Kotlin + Compose)
│   ├── app/src/main/kotlin/com/roam
│   │   ├── MainActivity.kt    # Entry point
│   │   ├── ui/               # Jetpack Compose screens
│   │   ├── viewmodel/        # MVVM ViewModels
│   │   └── data/             # Repository and Supabase client
│   ├── build.gradle.kts      # Kotlin DSL build config
│   ├── gradle.properties     # Gradle settings
│   ├── local.properties      # Local secrets (not in git)
│   └── settings.gradle.kts   # Gradle subproject config
│
├── scripts/                    # One-off utility scripts
│   ├── seed-*.js             # Import URLs from public sources (Wikipedia, Hacker News, etc.)
│   ├── _test-*.mjs           # Quick tests of seed scripts
│   └── resize-icons.ps1      # Icon resizing script
│
├── PLANNING.md               # Long-term roadmap
├── ROADMAP.md                # Public build tasks & progress tracking
├── LICENSE                   # MIT license
└── README.md                # This file

Development Setup
Prerequisites

    Node.js 20+ — for extension build and web platform
    pnpm 9+ — fast, space-efficient package manager (or npm/yarn if preferred)
    Supabase CLI — npm install -g supabase or brew install supabase
    Android Studio — Ladybug version or newer (for Android development)
    Git — version control

Quick Start (5 minutes)

# 1. Clone repository
git clone https://github.com/seito/roam.git
cd roam

# 2. Create free Supabase project at https://supabase.com
# Copy your project URL and anon key

# 3. Backend setup
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # Applies all SQL migrations
supabase functions deploy # Deploys Edge Functions

# 4. Extension setup
cd extension
pnpm install
pnpm build               # Outputs to dist/
# Load unpacked in Chrome: chrome://extensions → Developer mode → Load unpacked → select dist/

Backend (Supabase)

One-time setup:

    Create a free account at supabase.com
    Create a new project (any region)
    Get your project URL and anon key from Settings → API Keys

Local development:

cd supabase

# Authenticate with Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply all database migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy roam
supabase functions deploy rate
supabase functions deploy submit-url
supabase functions deploy collection
supabase functions deploy follow
supabase functions deploy profile
supabase functions deploy log-failed-urls

# Run local dev server (optional)
supabase start  # Starts local PostgreSQL, auth server, and functions
supabase stop

Verifying the backend:

# List deployed functions
supabase functions list

# Check Edge Function logs
supabase functions download roam
supabase edge-functions --help

Browser Extension

Development:

cd extension

# Install dependencies
pnpm install

# Build and watch for changes
pnpm watch

# Or build once
pnpm build

# Output: dist/ (Chrome) and dist-firefox/ (Firefox)

Loading in Chrome:

    Open chrome://extensions
    Enable "Developer mode" (top right)
    Click "Load unpacked"
    Select the dist/ folder
    Extension appears in your toolbar

Loading in Firefox:

    Open about:debugging
    Click "This Firefox"
    Click "Load Temporary Add-on"
    Select dist-firefox/manifest.json

Debugging:

# Open extension console
chrome://extensions → Roam → Inspect views → service worker

# View popup console
Click extension icon → Right click → Inspect popup

# Check persistent background state
chrome://extensions → Roam → Background Page → Console

API Reference

All Edge Functions accept POST requests with JSON bodies. Authentication uses Supabase bearer token in the Authorization header.
Discovery (roam)

POST https://project.supabase.co/functions/v1/roam
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "category_filter": ["science", "tech"],      // optional, user's selected categories
  "exclude_domain": "reddit.com"                 // optional, skip this domain
}

Response:
{
  "id": "uuid",
  "url": "https://...",
  "title": "Page Title",
  "description": "...",
  "category_id": "science",
  "og_image_url": "https://...",
  "wilson_score": 4.5
}

Rating (rate)

POST https://project.supabase.co/functions/v1/rate
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "url_id": "uuid",
  "vote": 1                  // 1 for thumbs up, -1 for thumbs down
}

Response:
{
  "ok": true,
  "vote_recorded": true,
  "domain_muted": false      // true if this was the 2nd downvote on this domain
}

Submission (submit-url)

POST https://project.supabase.co/functions/v1/submit-url
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "url": "https://...",
  "category_id": "science"
}

Response:
{
  "ok": true,
  "id": "uuid",              // moderation queue entry ID
  "status": "pending_review"
}

Collections (collection)

POST https://project.supabase.co/functions/v1/collection
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "action": "create" | "add_item" | "list" | "delete",
  "name": "My Collection",   // for create
  "collection_id": "uuid",   // for add_item / delete
  "url_id": "uuid"           // for add_item
}

Response (list):
{
  "ok": true,
  "collections": [
    {"id": "uuid", "name": "...", "item_count": 5, "public": true}
  ]
}

User Profile (profile)

GET https://project.supabase.co/functions/v1/profile
Authorization: Bearer YOUR_ACCESS_TOKEN

Response:
{
  "user_id": "uuid",
  "email": "user@example.com",
  "categories": ["science", "tech"],
  "follower_count": 42,
  "following_count": 18,
  "urls_submitted": 5,
  "urls_rated": 120
}

Performance Considerations
Discovery Algorithm Efficiency

The roam() function uses several optimization techniques:

    Pre-filtered candidate pool — only candidates matching user's categories are considered
    Domain muting optimization — muted domains are excluded at query time
    Statistical ranking (Wilson score) — prevents new/popular bias; pages with 5 thumbs-up and 100 votes rank correctly
    Efficient sampling — uses PostgreSQL TABLESAMPLE BERNOULLI for large tables
    Connection pooling — Supabase manages connection reuse automatically

Expected latency:

    p50: ~100ms
    p95: ~500ms
    p99: ~2s (when database is under high load)

Extension Performance

    Queue prefetch — fetches next 3 URLs in background, instant response to user clicks
    Lazy script loading — content scripts load only on tabs with matching domain patterns
    Storage optimization — queue stored compressed in chrome.storage.local
    Minimal permissions — extension only accesses storage and makes network requests

Expected memory usage:

    Idle: ~5 MB
    Active: ~15 MB

Database Scalability

PostgreSQL free tier supports:

    Millions of URLs (500 MB limit)
    Thousands of concurrent users
    Queries returning 1000+ results easily

At 100K active monthly users:

    ~5 MB/month database growth (conservative estimate)
    Database will reach 500 MB in ~8-10 years
    No index or query optimization needed until ~1M URLs

Monitoring & Observability
Sentry Error Tracking

All platforms send errors to Sentry for monitoring:

# Extension
@sentry/esbuild-plugin uploads source maps on build
All uncaught exceptions captured automatically

# Web
API errors logged to Sentry with context
User authentication errors tracked separately

# Android
Kotlin crashes sent to Sentry
ANR (Application Not Responding) events tracked

Sentry Dashboard: https://7-lynx.sentry.io/projects/roam-extension
Database Monitoring

Supabase provides free monitoring:

    Query performance — slow query dashboard in Supabase console
    Storage usage — monitor database size growth
    Function invocations — track Edge Function usage
    Realtime connections — see active connections

Dashboard: https://app.supabase.com/project/[YOUR_PROJECT]/analytics
Analytics

Track user engagement and platform health:

    URL submission rate — how many URLs are submitted per day
    Active users — daily and monthly active user count
    Category popularity — which interest categories are most popular
    Vote sentiment — thumbs-up vs thumbs-down ratio per category

Contributing

Contributions are welcome! Areas needing help:

    Bug fixes — check Issues for known bugs
    Performance — profile and optimize slow functions
    UI/UX — improve extension and web interfaces
    Documentation — expand API docs, add tutorials
    Testing — add unit and integration tests
    Moderation — help review and approve URL submissions

Getting started:

# Fork the repo
git clone https://github.com/your-username/roam.git
cd roam

# Create a feature branch
git checkout -b feature/my-improvement

# Make changes and test
# ...

# Commit with descriptive message
git commit -m "feat: add new discovery filter"

# Push and open pull request
git push origin feature/my-improvement

Code style:

    Use TypeScript for type safety
    Format code with Prettier (pnpm format)
    Run linter: pnpm lint
    Write tests for new features

License

MIT License — see LICENSE file for details.

You're free to use, modify, and distribute Roam. Commercial use is allowed.
Acknowledgments

Built with:

    Supabase — PostgreSQL + auth + Edge Functions
    Next.js — React framework
    Jetpack Compose — Android UI
    esbuild — JavaScript bundler
    Tailwind CSS — utility-first styling
    TypeScript — type-safe JavaScript
    Sentry — error tracking

Made with ❤️ by Seito

Questions? Open an issue on GitHub or reach out on Twitter @seito_codes

Track user engagement and platform health:

    URL submission rate — how many URLs are submitted per day
    Active users — daily and monthly active user count
    Category popularity — which interest categories are most popular
    Vote sentiment — thumbs-up vs thumbs-down ratio per category

Contributing

Contributions are welcome! Areas needing help:

    Bug fixes — check Issues for known bugs
    Performance — profile and optimize slow functions
    UI/UX — improve extension and web interfaces
    Documentation — expand API docs, add tutorials
    Testing — add unit and integration tests
    Moderation — help review and approve URL submissions

Getting started:

# Fork the repo
git clone https://github.com/your-username/roam.git
cd roam

# Create a feature branch
git checkout -b feature/my-improvement

# Make changes and test
# ...

# Commit with descriptive message
git commit -m "feat: add new discovery filter"

# Push and open pull request
git push origin feature/my-improvement

Code style:

    Use TypeScript for type safety
    Format code with Prettier (pnpm format)
    Run linter: pnpm lint
    Write tests for new features

License

MIT License — see LICENSE file for details.

You're free to use, modify, and distribute Roam. Commercial use is allowed.
Acknowledgments

Built with:

    Supabase — PostgreSQL + auth + Edge Functions
    Next.js — React framework
    Jetpack Compose — Android UI
    esbuild — JavaScript bundler
    Tailwind CSS — utility-first styling
    TypeScript — type-safe JavaScript
    Sentry — error tracking

Made with ❤️ by Seito

Questions? Open an issue on GitHub or reach out on Twitter @seito_codes
View popup console

Click extension icon → Right click → Inspect popup


### Web Platform

**Development:**

```bash
cd web

# Install dependencies
pnpm install

# Set environment variables
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF

# Run dev server
pnpm dev

# Build for production
pnpm build
pnpm start

# Run type checking
pnpm type-check

# Run linter
pnpm lint

Deployment to Vercel:

# Push to GitHub
git push origin main

# Vercel auto-deploys on push (if connected)
# Or manually: vercel deploy

Android App

Prerequisites:

    Android Studio Ladybug or newer
    Android SDK 26+ (API level)
    Physical device or emulator

Setup:

    Open Android Studio
    Open project folder: File → Open → select roam/android
    Create local.properties in android/ folder:

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

    Sync Gradle: File → Sync Now
    Run on emulator: Run → Run 'app'
    Select target device (emulator or physical device)

Building for distribution:

# From Android Studio
Build → Generate Signed Bundle / APK

# Or from command line
./gradlew assembleRelease  # Creates APK
./gradlew bundleRelease    # Creates AAB for Play Store

Environment Variables

Extension — stored in chrome.storage.local at runtime

    Auth token (obtained via Supabase OAuth flow)
    Queue state (prefetched URLs)

Web — .env.local (never commit this)

NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
DATABASE_URL=postgres://... (server-side only)

Android — local.properties (never commit this)

SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJ...

Supabase Secrets — used by Edge Functions

supabase secrets set SENTRY_DSN=https://...
supabase secrets set STRIPE_API_KEY=sk_...

View secrets:

supabase secrets list

Running Tests

# Extension unit tests (if configured)
cd extension && pnpm test

# Web unit tests
cd web && pnpm test

# Android unit tests
cd android && ./gradlew test

# Android instrumented tests (emulator)
cd android && ./gradlew connectedAndroidTest

Troubleshooting

"Unauthorized" from Supabase

    Check anon key is set in .env.local / extension config
    Verify Row-Level Security policies in Supabase dashboard

Extension not detecting current page

    Check content script callback.ts is loaded: DevTools → Sources → Extensions
    Verify manifest.json includes correct content_scripts entry
    Reload extension with F5

Android app won't build

    Run ./gradlew clean to clear cache
    Check SDK levels: Build → Sync Native Modules
    Verify local.properties has correct Supabase credentials

Queue not refilling

    Check background service worker is running: chrome://serviceworkers
    Look for errors in DevTools console (Roam → Inspect views → service worker)
    Verify network connectivity (queue fetch requires Supabase access)
