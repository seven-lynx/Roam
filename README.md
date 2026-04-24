# Roam — Rediscover the Web

> One button. Infinite web. Your interests. No algorithms, no feeds, no noise.

Roam is a web discovery platform that replicates and improves on the original StumbleUpon experience. Press one button and land on a genuinely interesting page matched to your interests — voted on by real users, not ranked by engagement metrics.

---

## What Is This?

StumbleUpon shut down in 2018. Mix.com, its official successor, died in 2020. Nothing has replaced the core experience: a single button that takes you somewhere new and interesting on the internet, tailored to what you actually care about.

The partial alternatives that exist today all fall short:
- **wiby.me** — text-only, no personalization, no ratings
- **StumbleUponAwesome** — browser extension for developers only, static curated lists, no social layer
- **discover.wtf** — landing page + basic API, 0 community traction, no Android app, no content moderation

Roam fills that gap with a production-quality platform.

---

## Platform Targets

| Platform | Status |
|---|---|
| Browser Extension (Chrome + Firefox) | In development |
| Android App | In development |
| Web (Next.js) | ✅ Live |
| REST API + Backend | ✅ Live |

---

## Core Feature Set

### Discovery Engine
- **Roam button** — one tap/click delivers a curated page matching your active interest filters
- Interest categories (selectable at signup and adjustable at any time)
- Content is community-voted, not ranked by engagement or recency alone
- "Roam within site" — stay on a domain and browse only pages from it

### Rating System
- **Thumbs up / thumbs down** on each discovered page
- Ratings influence what you see next (preference learning, no black-box models)
- Pages with sustained negative votes are deprioritised

### Content Pool
- Users submit URLs for community review
- Moderator queue for new submissions
- Category tagging on submission
- Duplicate detection

### User Accounts
- Email + password, Google OAuth
- Interest profile (categories, blocked domains)
- Saved collections (public or private)
- Discovery history

### Social Layer
- Follow other users
- See what pages friends have thumbed up
- Share a page to followers

### Browser Extension
- Click-to-open popup — nothing is injected into pages
- Roam button, thumbs up/down, and category/collection controls in the popup
- Supports Chrome (MV3) and Firefox (MV3-compatible)

### Android App
- In-app browser for discovered pages
- Swipe right = like, swipe left = skip
- Offline reading queue (save pages for later)
- Push notifications for activity (followers liked a page you submitted, etc.)

---

## Tech Stack

### Backend — Supabase (free tier, no server to run or pay for)
- **Database**: PostgreSQL via [Supabase](https://supabase.com) free tier (500 MB, enough for years of hobby use)
- **Auth**: Supabase Auth — email/password + Google OAuth built-in, no extra config
- **Server logic**: Supabase Edge Functions (Deno runtime, 500 K invocations/month free)
- **Realtime**: Supabase Realtime for live activity feed (free)
- **Sessions / rate limiting**: handled inside Edge Functions; no Redis needed
- **Hosting**: none — Supabase is the backend

### Browser Extension (`/extension`)
- **Manifest**: V3 (Chrome + Firefox compatible)
- **Language**: TypeScript
- **Build**: esbuild (zero-config, fast)
- **Stores**: Chrome Web Store ($5 one-time), Firefox Add-ons (free)

### Android App (`/android`)
- **Language**: Kotlin
- **UI**: Jetpack Compose
- **Networking**: Supabase Kotlin client (official)
- **Navigation**: Navigation Compose
- **Auth**: Supabase Auth (Google Sign-In included)
- **Min SDK**: 26 (Android 8.0)
- **Target SDK**: 34
- **Store**: Google Play ($25 one-time) — or sideload APK to skip entirely

---

## Repository Structure

```
roam/
├── supabase/                   # Supabase config (DB schema + edge functions)
│   ├── migrations/             # SQL migrations (apply via Supabase CLI)
│   └── functions/              # Edge Functions (Deno TypeScript)
│       ├── rate/               # POST /rate — thumbs up / down
│       ├── submit-url/         # POST /submit-url — submit a URL
│       ├── collection/         # POST /collection — create or update a collection
│       ├── follow/             # POST /follow — follow / unfollow a user
│       └── _shared/            # Shared helpers (auth check, CORS)
│       # Note: roam() is a PostgreSQL RPC function, not an Edge Function
│
├── web/                        # Next.js web layer (hosted on Vercel)
│   └── ...                     # Initialised in Stage 3
│
├── extension/                  # Browser extension (Chrome + Firefox)
│   └── src/                    # TypeScript source — initialised in Stage 5
│
└── android/                    # Android app (Kotlin + Compose)
    └── ...                     # Initialised in Stage 6
```

---

## Getting Started

### Prerequisites
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `npm install -g supabase`
- Node.js 20+ and pnpm 9+ (extension build only)
- Android Studio Ladybug or newer (Android app)

### Backend (Supabase)

```bash
# One-time: create a free project at https://supabase.com
# Copy your project URL and anon key into the files below

supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # applies migrations
supabase functions deploy # deploys all edge functions
```

### Extension

```bash
cd extension
pnpm install
pnpm build               # outputs to dist/
# Chrome: chrome://extensions → Load unpacked → select dist/
# Firefox: about:debugging → Load Temporary Add-on → select dist/manifest.json
```

### Android

Open `/android` in Android Studio. In `local.properties` add:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Run on an emulator or physical device (API 26+).

---

## Environment

The only secrets you need are your Supabase project URL and anon key. Both are safe to put in client apps — Supabase Row Level Security (RLS) enforces access control at the database level.

For Edge Functions, set secrets via:

```bash
supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
```
