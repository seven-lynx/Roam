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
| Android app | ⏳ Play Store submission pending |

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
- Subcategories: the system tracks your preferences within 20+ subcategories (e.g., Science, Art, Gaming) for more granular personalization

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

- In-app browser so you don't have to leave
- Offline reading queue
- Material Design 3 / Jetpack Compose
- Android 8.0+ (SDK 26), target SDK 35
- Google OAuth or email/password sign-in


### Web

- Account management portal, onboarding, and admin moderation
- Next.js 16 / TypeScript / Tailwind CSS, deployed on Vercel

See [web/README.md](web/README.md) for the authoritative route map and UI spec.

---

## Architecture

### Backend — Supabase (PostgreSQL)

The database does the heavy lifting. Discovery runs as a `plpgsql` RPC (`roam()`) invoked via a Deno Edge Function. Row-Level Security enforces all access control at the database level. Every successful discovery is tracked via `serve_count` for analytics.

Edge Functions (Deno) handle operations that need more than a simple query: `roam`, `rate`, `submit-url`, `save-url`, `collection`, `follow`, `profile`, `feedback`, `report-url`, `log-failed-urls`, `delete-user`, `export-user`.

**Key tables:**

| Table | Purpose |
|---|---|
| `urls` | All discovered pages — URL, title, description, votes, scores, source |
| `ratings` | Per-user votes |
| `seen_urls` | Tracks what each user has already been served |
| `user_interest_scores` | Per-user, per-subcategory calibration weights |
| `user_domain_cooldowns` | 30-minute per-session domain cooldown |
| `user_suppressed_domains` | 30-day domain suppression (from repeated downvotes) |
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
└── docs/                   # ALGORITHM.md, audit docs, etc.
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

