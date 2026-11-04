# Architecture

Roam is a multi-platform discovery product built around a PostgreSQL database that does the heavy lifting. Three clients — a browser extension, an Android app, and a web portal — talk to Supabase either directly over the PostgREST/Auth APIs or through Deno Edge Functions.

## System overview

```
┌───────────────┐   ┌──────────────┐   ┌─────────────────┐
│   Extension    │   │   Android     │   │      Web         │
│  (Chrome/Fire) │   │ (Kotlin+Compose)│  │  (Next.js/Vercel)│
└───────┬────────┘   └──────┬───────┘   └────────┬────────┘
        │   Supabase Auth / PostgREST / Realtime  │
        └───────────────────┬─────────────────────┘
                            │
                ┌───────────▼────────────┐
                │   Deno Edge Functions   │
                │ (roam, rate, submit-url)│
                └───────────┬────────────┘
                            │ SQL / RPC (plpgsql)
                ┌───────────▼────────────┐
                │    PostgreSQL (RLS)     │
                │ urls, ratings, profiles │
                └────────────────────────┘
```

## Core flow — discovery

1. A client requests the next page via the `roam` edge function.
2. `roam` invokes the `roam()` RPC (plpgsql), which scores candidate URLs and returns the best match for the current user.
3. The client presents the page inline (Android in-app browser) or in the host browser (extension), and the user rates it up or down.
4. Ratings flow back through the `rate` function and calibrate per-user weights (`user_interest_scores`, `user_category_scores`), making future picks more personalised.

The discovery model is documented in [ALGORITHM.md](ALGORITHM.md). Its inputs — Wilson score, editorial signal, taste calibration, freshness, and exploration bonus — are combined inside the RPC. Every successful discovery is tracked via `serve_count` for analytics.

## Backend — Supabase

- **PostgreSQL** stores all state. See [supabase/SCHEMA.md](../supabase/SCHEMA.md) for the core tables.
- **Row-Level Security** enforces access control at the database level, so unprivileged clients can only touch their own rows.
- **Deno Edge Functions** implement operations that need more than a single query. See [API.md](API.md) for the contract of each.
- **Realtime** powers live features such as the activity feed and notifications.
- **Cron-scheduled functions** run periodic jobs: `challenges`, `cron-daily-challenges`, `cron-secret-badges`, `cron-streak-cleanup`, `cron-notification-cleanup`, `roam-health-check`, and `evaluate-badges`.

Schema changes are stored as numbered migrations in `supabase/migrations/` (179 at time of writing) and applied with `supabase db push`.

## Clients

### Browser extension (Chrome + Firefox, MV3)

Event-driven service worker architecture — no background loops.

- `background.ts` owns all state and logic.
- `popup.ts` is purely UI.
- `callback.ts` handles the OAuth PKCE callback.
- Prefetch cache in `chrome.storage.session` delivers near-instant navigation.
- Deliberately non-intrusive: nothing is injected into the page you visit.

### Android (Kotlin + Compose)

Single-activity MVVM.

- `MainViewModel` owns discovery, profile, settings, and collection state.
- `RoamRepository` handles all Supabase calls.
- Prefetch pipeline keeps the next URL cached for instant card-to-card swiping.
- In-app browser, offline rating queue with automatic flush on reconnect, push notifications.

### Web (Next.js 16 + TypeScript + Tailwind, Vercel)

- Account management portal, onboarding, and admin moderation.
- 15-card admin analytics dashboard with request-time caching.
- Route map and UI spec in [web/README.md](../web/README.md).

## Seeding

Content is loaded by seeder scripts that fetch candidate URLs from hundreds of sources, normalise them, and write them into the `urls` table (pending moderation where required).

## See also

- [ALGORITHM.md](ALGORITHM.md) — scoring model.
- [API.md](API.md) — Edge Function + RPC contracts.
- [BADGE_SYSTEM_ARCHITECTURE.md](BADGE_SYSTEM_ARCHITECTURE.md) — XP economy and badge evaluation.
- [supabase/SCHEMA.md](../supabase/SCHEMA.md) — core tables.
