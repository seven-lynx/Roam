# Roam â€” Rediscover the Web

> Press one button. Land somewhere interesting.

Roam is a web discovery platform built around a simple idea: the internet is full of genuinely great content, but the tools we use to find it are broken. Algorithms optimise for engagement. Search requires knowing what you're looking for. Bookmarks pile up unread.

Press the button and land on a real page, curated by real users, matched to what you actually care about. No feeds, no infinite scroll, no recommendation engine trying to maximise your session time.

---

## Status

| Component | Status |
|---|---|
| Supabase backend | âœ… Live |
| Web app | âœ… Live |
| Browser extension (Chrome + Firefox) | âœ… Live |
| Android app | ðŸ”¨ In development |

---

## How the algorithm works

The discovery function runs directly in PostgreSQL. When you press the button, it balances four signals to pick a page you'll likely enjoy:

- **Community quality** â€” statistically-correct ranking that handles small vote counts fairly
- **Editorial signal** â€” source reputation (HN score, citation count, Reddit karma, etc.)
- **Your taste** â€” topics you upvote more often surface more; topics you downvote dial back
- **Freshness** â€” recently published pages get a mild boost; very old ones fade gradually

There's also a small bonus for pages nobody has rated yet, to keep fresh content circulating rather than the same well-worn URLs.


---

## Features

**Discovery**
- One button, filtered to your interests
- 30-minute domain cooldown prevents seeing the same site twice in a row
- 12% chance of an adjacent topic in discovery mode â€” intentional serendipity
- Deep dive mode narrows to your top-3 subcategories by calibrated weight
- Collection mode stays within a saved list

**Personalisation**
- Topic affinity: upvoting a topic more often increases how frequently it appears (up to 2Ã— weight; floor 0.4Ã—). Downvoting doesn't hide a topic â€” it just dials the weight back slightly.
- Domain muting: two downvotes from the same domain triggers a 30-day auto-mute
- Language filter, paywall opt-out

**Community**
- URL submission with moderation queue and duplicate detection
- Wilson score ranking â€” statistically correct; a page with 10/10 upvotes ranks accurately against one with 800/1000
- Thumbs up/down with automatic score recalculation on every vote

**Collections & social**
- Public or private collections, saved with one tap
- Follow users, browse their activity
- Profile pages with stats (pages rated, submitted, followers)

---

## Platforms

### Browser extension

Deliberately non-intrusive. Click, roam, rate, close â€” nothing is injected into pages you visit.

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

### Backend â€” Supabase (PostgreSQL)

The database does the heavy lifting. Discovery runs as a `plpgsql` RPC (`roam()`) called directly from clients â€” no extra network hop through a separate compute layer. Row-Level Security enforces all access control at the database level.

Edge Functions (Deno) handle operations that need more than a simple query: `rate`, `submit-url`, `collection`, `follow`, `profile`, `log-failed-urls`, `feedback`, `report-url`, `save-url`, `delete-user`, `export-user`.

**Key tables:**

| Table | Purpose |
|---|---|
| `urls` | All discovered pages â€” URL, title, description, votes, scores, source |
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
â”œâ”€â”€ supabase/
â”‚   â”œâ”€â”€ migrations/         # 40+ SQL migrations
â”‚   â””â”€â”€ functions/          # Deno Edge Functions
â”‚       â””â”€â”€ _shared/        # CORS headers, auth helpers
â”‚
â”œâ”€â”€ web/                    # Next.js app (Vercel)
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ app/            # App router pages
â”‚       â”œâ”€â”€ components/
â”‚       â””â”€â”€ lib/
â”‚
â”œâ”€â”€ extension/              # Chrome + Firefox extension
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ background/     # Service worker
â”‚       â”œâ”€â”€ popup/          # UI
â”‚       â”œâ”€â”€ callback/       # Content script
â”‚       â””â”€â”€ lib/            # Queue, Supabase client
â”‚
â”œâ”€â”€ android/                # Kotlin + Compose app
â”‚   â””â”€â”€ app/src/main/kotlin/com/roam/
â”‚       â”œâ”€â”€ ui/             # Compose screens
â”‚       â”œâ”€â”€ viewmodel/
â”‚       â””â”€â”€ data/
â”‚
â”œâ”€â”€ scripts/                # Seeder scripts (Wikipedia, HN, Guardian, etc.)
â””â”€â”€ docs/                   # ALGORITHM.md, audit docs, etc.
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

**Load in Chrome:** `chrome://extensions` â†’ Developer mode â†’ Load unpacked â†’ `dist/`

**Load in Firefox:** `about:debugging` â†’ This Firefox â†’ Load Temporary Add-on â†’ `dist-firefox/manifest.json`

**Debug:**
```
# Service worker console
chrome://extensions â†’ Roam â†’ Inspect views â†’ service worker

# Popup console
Click extension icon â†’ Right click â†’ Inspect popup
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

**"Unauthorized" from Supabase** â€” check your anon key is set correctly and the relevant RLS policies exist.

**Extension not detecting current page** â€” verify `callback.ts` is loaded (DevTools â†’ Sources â†’ Extensions) and `manifest.json` has the right `content_scripts` entry. Reload with F5.

**Android won't build** â€” run `./gradlew clean` and re-sync. Check `local.properties` has valid credentials.

**Queue not refilling** â€” confirm the service worker is alive at `chrome://serviceworkers` and check for errors in the extension's background console.

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

MIT â€” see [LICENSE](LICENSE). Free to use, modify, and distribute, including commercially.

---

Built with Supabase, Next.js, Jetpack Compose, esbuild, Tailwind CSS, and TypeScript.

Made by Seito. Questions? [Open an issue](https://github.com/seven-lynx/Roam/issues).

