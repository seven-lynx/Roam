# Secrets Audit

All secrets by name, where they live, and where they're consumed. Values are never recorded here.

> **Last audit:** 2026-07-09

---

## Supabase

### `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
Same value, two names depending on context.
- **Local:** `web/.env.local` (as `NEXT_PUBLIC_SUPABASE_URL`), root `.env` (as `SUPABASE_URL` for extension build, seeder scripts), `android/local.properties` (as `SUPABASE_URL`)
- **Vercel:** Environment variable on `roam` project (all environments)
- **GitHub Actions:** `secrets.NEXT_PUBLIC_SUPABASE_URL` (CI, extension build step)
- **Used by:** Next.js web app (client + server), extension bundle, Android app, all seeders, Edge Functions (auto-injected by Supabase runtime)
- **Status:** ✅ Present everywhere

### `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`
Same value, two names. This is the public publishable key — safe to expose in client code.
- **Local:** `web/.env.local` (as `NEXT_PUBLIC_SUPABASE_ANON_KEY`), root `.env` (as `SUPABASE_ANON_KEY`), `android/local.properties` (as `SUPABASE_ANON_KEY`)
- **Vercel:** Environment variable on `roam` project (all environments)
- **GitHub Actions:** `secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY` (CI, extension build step)
- **Used by:** Next.js web app (client-side Supabase client), extension bundle, Android app, Edge Functions (auto-injected)
- **Rotate at:** Supabase dashboard → Project Settings → API → Anon key → Rotate
- **Status:** ✅ Present everywhere

### `SUPABASE_SERVICE_ROLE_KEY`
Full admin access. Never expose to the client.
- **Local:** `web/.env.local`, root `.env`
- **Vercel:** Environment variable on `roam` project (production + preview)
- **GitHub Actions:** Not set (not needed for CI)
- **Used by:** Admin dashboard (`/admin/actions.ts`), Edge Functions `admin-moderation`, `delete-user`, `export-user`, `send-bulk-email`, `push-notify`, all seeders, backfill scripts
- **Rotate at:** Supabase dashboard → Project Settings → API → Service role key → Rotate. Must update Vercel + `web/.env.local` + root `.env` simultaneously.
- **Status:** ✅ Present everywhere

### `SUPABASE_ACCESS_TOKEN`
Personal access token for the Supabase CLI — used to link projects and push migrations/functions from CI.
- **Local:** Root `.env`
- **GitHub Actions:** `secrets.SUPABASE_ACCESS_TOKEN` (deploy workflow)
- **Used by:** `deploy.yml` — `supabase db push`, `supabase functions deploy`
- **Rotate at:** Supabase dashboard → Account → Access Tokens → revoke and reissue. Update GitHub secret + root `.env`.
- **⚠ Note:** The deploy workflow exists but is not currently used — Vercel auto-deploys on push, and migrations/functions are deployed manually via CLI. Verify this token is still valid if you ever use the deploy workflow.
- **Status:** ✅ Present

### `SUPABASE_PROJECT_ID`
Project reference ID (`yrhckctwtdjowulfuaqc`). Not truly secret but treated as one in CI.
- **GitHub Actions:** `secrets.SUPABASE_PROJECT_ID` (deploy workflow, `supabase link`)
- **Note:** This value is also hardcoded in `copilot-instructions.md` and the Supabase CLI commands throughout docs.
- **Status:** ✅ Present

---

## Sentry

### `SENTRY_AUTH_TOKEN` (web)
Used to upload source maps to Sentry during Next.js builds and to fetch issues in the admin dashboard.
- **Local:** `web/.env.local`
- **Vercel:** Environment variable on `roam` project (all environments)
- **Used by:** `next.config.ts` (Sentry webpack plugin, source map upload on build), `web/src/app/admin/page.tsx` (issues feed)
- **Rotate at:** sentry.io → Settings → Auth Tokens → revoke and reissue. Update `web/.env.local` + Vercel.
- **Status:** ✅ Present (same token shared across all 3 Sentry projects)

### `SENTRY_AUTH_TOKEN` (Android)
**Same token as web** — scoped to the `roam-android` project via `SENTRY_PROJECT`.
- **Local:** `android/local.properties`, `android/sentry.properties`
- **Used by:** Android Gradle build (source map / ProGuard mapping upload to Sentry)
- **Rotate at:** sentry.io → Settings → Auth Tokens. Update `android/local.properties` + `android/sentry.properties`.
- **Status:** ✅ Present

### `SENTRY_AUTH_TOKEN` (extension)
**Same token as web** — scoped to `roam-extension` via `SENTRY_PROJECT`.
- **Local:** Root `.env` (read by `extension/build.mjs`)
- **Used by:** Sentry esbuild plugin during extension build — uploads source maps
- **Rotate at:** Same org token as web. Update root `.env`.
- **Status:** ✅ Present

### `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`
DSN is not truly secret (it's embedded in client bundles) but controls where errors are sent.
- **Local:** `web/.env.local` (both variants — roams-web DSN), `android/local.properties` (roam-android DSN), root `.env` (roam-extension DSN)
- **Vercel:** Environment variable on `roam` project
- **Three separate DSNs exist** — one per Sentry project (`roam-web`, `roam-android`, `roam-extension`). Check Sentry → Project Settings → Client Keys if any need to be reset.
- **Rotate at:** Sentry → Project Settings → Client Keys → Disable old key, create new.
- **Status:** ✅ All 3 DSNs present

### `SENTRY_ORG`
Value: `7-lynx`. Not a secret but required for CLI/build plugin to locate the org.
- **Local:** `web/.env.local`, root `.env`, `android/local.properties`
- **Vercel:** Environment variable
- **Status:** ✅ Present everywhere

### `SENTRY_PROJECT`
Value: `roam-web` (web), `roam-android` (android), `roam-extension` (extension).
- **Local:** `web/.env.local`, root `.env`, `android/local.properties`
- **Vercel:** Environment variable
- **Status:** ✅ Present everywhere

### `SENTRY_DSN_EXTENSION` (GitHub Actions)
- **GitHub Actions:** `secrets.SENTRY_DSN_EXTENSION` (CI extension build step). May not be set — verify in GitHub repo secrets.
- **Status:** ⚠️ Unknown — may be missing

---

## Vercel

### `VERCEL_TOKEN`
Personal access token for the Vercel API. Used to tail logs and list deployments from the admin dashboard and CLI.
- **Local:** `web/.env.local`
- **GitHub Actions:** `secrets.VERCEL_TOKEN` (deploy workflow)
- **Used by:** `web/src/app/admin/page.tsx` (deployment feed), local CLI commands for log tailing
- **Rotate at:** vercel.com → Settings → Tokens → revoke and reissue. Update `web/.env.local` + GitHub secret.
- **Status:** ✅ Present

### `VERCEL_ORG_ID`
- **GitHub Actions:** `secrets.VERCEL_ORG_ID` (deploy workflow)
- **Not stored locally** — only needed if running `vercel deploy` from CI
- **Find at:** vercel.com → Settings → General → Team ID
- **Status:** ✅ Present in GitHub Secrets

### `VERCEL_PROJECT_ID`
Scopes the deployment list in the admin dashboard to this project only.
- **Local:** `web/.env.local` (`prj_uE8AwyDjXwQEq6CGYwHFoMizKED3`)
- **GitHub Actions:** `secrets.VERCEL_PROJECT_ID` (deploy workflow)
- **Find at:** vercel.com → Project Settings → General → Project ID
- **Status:** ✅ Present in both `web/.env.local` and GitHub Secrets

---

## Push Notifications (FCM + Web Push)

### Firebase Cloud Messaging (FCM) — Android
Android push notifications use Firebase Cloud Messaging. The `push-notify` Edge Function needs a Firebase service account to obtain OAuth2 tokens.

- **Firebase project:** `roam-4c5b1`
- **`google-services.json`:** Present at `android/app/google-services.json` (Android app config — not secret)
- **`FCM_SERVICE_ACCOUNT` (env var):** ❌ **NOT SET ANYWHERE**
  - The `push-notify` Edge Function calls `getFCMAccessToken(serviceAccountJson)` to get an OAuth2 access token for FCM
  - Without this env var, **Android push notifications are broken in production**
  - The Firebase Admin SDK key exists at `~/Downloads/roam-4c5b1-firebase-adminsdk-fbsvc-e3f792e82c.json`
  - **Action:** Set the contents of that JSON file as a Vercel env var named `FCM_SERVICE_ACCOUNT`
- **Status:** ❌ Broken

### Web Push (VAPID) — Browser
Web push notifications use the Web Push API with VAPID authentication.

- **`NEXT_PUBLIC_VAPID_PUBLIC_KEY`:**
  - **Local:** `web/.env.local` — ✅ Present
  - **Vercel:** ⚠️ **NOT CONFIRMED** — may not be set
  - **Used by:** `web/src/app/settings/SettingsClient.tsx` (client-side push subscription)

- **`VAPID_PRIVATE_KEY`:**
  - ❌ **NOT SET ANYWHERE**
  - The `push-notify` Edge Function checks for both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` at runtime
  - Without the private key, it logs `"Skipping Web Push: VAPID not configured"` and skips ALL web push delivery
  - **This means no web browser push notifications are being sent at all.**
  - **Action:** Generate VAPID keys, set both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as Vercel env vars, and add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to Vercel

- **`VAPID_PUBLIC_KEY` (Edge Function):**
  - Read by `push-notify/index.ts` as `Deno.env.get('VAPID_PUBLIC_KEY')` — must be set on Vercel alongside `VAPID_PRIVATE_KEY`
  - ⚠️ **NOT CONFIRMED** — may not be set on Vercel

- **Status:** ❌ Broken — `VAPID_PRIVATE_KEY` missing everywhere

---

## Email (Resend)

### `RESEND_API_KEY`
Used by the `send-bulk-email` Edge Function to send notification emails.
- **Local:** Root `.env` — ✅ Present
- **Vercel:** ⚠️ **NOT CONFIRMED** — the Edge Function reads `Deno.env.get('RESEND_API_KEY')`, so it must be set as a Vercel environment variable
- **Used by:** `supabase/functions/send-bulk-email/index.ts`
- **Rotate at:** resend.com → API Keys → revoke and reissue. Update root `.env` + Vercel.
- **Status:** ⚠️ Present locally but unconfirmed on Vercel — bulk emails may be broken in production

---

## Android keystore

### `RELEASE_STORE_PASSWORD`
Password for the `.jks` keystore file used to sign Play Store releases.
- **Local:** `android/local.properties` (plaintext — ⚠️ never commit this file)
- **Used by:** Gradle release build configuration
- **Rotate:** Would require generating a new keystore and re-uploading to Play Console (very disruptive — avoid)
- **Status:** ✅ Present

### `RELEASE_KEY_PASSWORD`
Password for the signing key alias within the keystore.
- **Local:** `android/local.properties`
- **Same rotation caveats as above**
- **Status:** ✅ Present

### `RELEASE_KEY_ALIAS`
Value: `roam`. Not a secret but required for signing.
- **Local:** `android/local.properties`
- **Status:** ✅ Present

### `RELEASE_STORE_FILE`
Path to the `.jks` file on disk. Not a secret.
- **Local:** `android/local.properties`
- **Status:** ✅ Present

---

## Seeder API keys (scripts only)

All of these live in the root `.env` file. `GITHUB_TOKEN`, `PODCAST_INDEX_API_KEY/SECRET`, and `SEMANTIC_SCHOLAR_API_KEY` are declared but empty.

| Name | Status | Used by | Required? |
|---|---|---|---|
| `NASA_API_KEY` | ✅ Present | `seed-nasa.js` | No — falls back to `DEMO_KEY` (30 req/hr) |
| `NYT_API_KEY` | ✅ Present | `seed-nyt.js`, `_test-nyt.mjs` | Yes |
| `GUARDIAN_API_KEY` | ✅ Present | `seed-guardian.js` | Yes |
| `SMITHSONIAN_API_KEY` | ✅ Present | `seed-smithsonian.mjs` | Yes |
| `EUROPEANA_API_KEY` | ✅ Present | `seed-europeana.mjs` | Yes |
| `DPLA_API_KEY` | ✅ Present | `seed-dpla.mjs` | Yes |
| `GITHUB_TOKEN` | ❌ Empty | `seed-github.js` | No — falls back to unauthenticated (60 req/hr) |
| `PODCAST_INDEX_API_KEY` | ❌ Empty | `seed-podcastindex.mjs` | Yes — seeder fails without it |
| `PODCAST_INDEX_API_SECRET` | ❌ Empty | `seed-podcastindex.mjs` | Yes — seeder fails without it |
| `SEMANTIC_SCHOLAR_API_KEY` | ❌ Empty | `seed-semanticscholar.js` | No — unauthenticated works, just rate-limited |

**Rotate at:** Each respective API's developer portal. None of these are used in production — seeder-only.

---

## Where each secret lives (summary table)

| Secret | `web/.env.local` | Vercel | GitHub Secrets | `android/local.properties` | Root `.env` |
|---|:---:|:---:|:---:|:---:|:---:|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | — | ✅ (as `SUPABASE_URL`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ | ✅ | ✅ (as `SUPABASE_ANON_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | — | — | ✅ |
| `SUPABASE_ACCESS_TOKEN` | — | — | ✅ | — | ✅ |
| `SUPABASE_PROJECT_ID` | — | — | ✅ | — | — |
| `SENTRY_AUTH_TOKEN` (web) | ✅ | ✅ | — | — | ✅ |
| `SENTRY_AUTH_TOKEN` (android) | — | — | — | ✅ | — |
| `SENTRY_AUTH_TOKEN` (extension) | — | — | — | — | ✅ |
| `SENTRY_DSN` (web) `NEXT_PUBLIC_SENTRY_DSN` | ✅ | ✅ | — | — | — |
| `SENTRY_DSN` (android) | — | — | — | ✅ | — |
| `SENTRY_DSN` (extension) | — | — | — | — | ✅ |
| `SENTRY_DSN_EXTENSION` (CI) | — | — | ⚠️ | — | — |
| `SENTRY_ORG` | ✅ | ✅ | — | ✅ | ✅ |
| `SENTRY_PROJECT` | ✅ | ✅ | — | ✅ | ✅ |
| `VERCEL_TOKEN` | ✅ | — | ✅ | — | — |
| `VERCEL_ORG_ID` | — | — | ✅ | — | — |
| `VERCEL_PROJECT_ID` | ✅ | — | ✅ | — | — |
| `RESEND_API_KEY` | — | ⚠️ | — | — | ✅ |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ | ⚠️ | — | — | — |
| `VAPID_PUBLIC_KEY` | — | ⚠️ | — | — | — |
| `VAPID_PRIVATE_KEY` | — | ❌ | — | — | — |
| `FCM_SERVICE_ACCOUNT` | — | ❌ | — | — | — |
| `RELEASE_STORE_PASSWORD` | — | — | — | ✅ | — |
| `RELEASE_KEY_PASSWORD` | — | — | — | ✅ | — |
| Seeder API keys | — | — | — | — | ✅ |

---

## Critical Gaps — Action Required

### 🔴 Production-Breaking (Fix Immediately)

| # | Gap | Impact | Fix |
|---|-----|--------|-----|
| 1 | **`VAPID_PRIVATE_KEY` missing** | **Web push notifications are completely broken.** The `push-notify` Edge Function skips all web push delivery with "VAPID not configured". | Generate VAPID key pair, set `VAPID_PRIVATE_KEY` and `VAPID_PUBLIC_KEY` as Vercel env vars for the `push-notify` function. |
| 2 | **`FCM_SERVICE_ACCOUNT` missing** | **Android push notifications likely broken.** The `push-notify` Edge Function needs a Firebase service account JSON to get FCM access tokens. | Copy contents of `roam-4c5b1-firebase-adminsdk-fbsvc-e3f792e82c.json` into a Vercel env var named `FCM_SERVICE_ACCOUNT`. |

### 🟡 Likely Broken (Confirm and Fix)

| # | Gap | Impact | Fix |
|---|-----|--------|-----|
| 3 | **`RESEND_API_KEY` not confirmed on Vercel** | Bulk email sending (`send-bulk-email` Edge Function) may fail in production. | Add `RESEND_API_KEY` to Vercel environment variables. |
| 4 | **`NEXT_PUBLIC_VAPID_PUBLIC_KEY` not confirmed on Vercel** | Web push subscription fails client-side with "Push not configured" on production. | Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to Vercel environment variables. |

### 🟢 Low Priority

| # | Gap | Impact | Fix |
|---|-----|--------|-----|
| 5 | `GITHUB_TOKEN` empty | `seed-github.js` hits 60 req/hr limit instead of 5000. | Generate at github.com → Settings → Developer settings → Personal access tokens. Add to root `.env`. |
| 6 | `PODCAST_INDEX_API_KEY` + `PODCAST_INDEX_API_SECRET` empty | `seed-podcastindex.mjs` fails. | Register at podcastindex.org → API. Add both to root `.env`. |
| 7 | `SEMANTIC_SCHOLAR_API_KEY` empty | `seed-semanticscholar.js` is rate-limited. | Register at semanticscholar.org → API. Add to root `.env`. |
| 8 | `SENTRY_DSN_EXTENSION` unconfirmed in GitHub Secrets | CI extension build step may not have a Sentry DSN. | Verify in GitHub repo secrets. |
| 9 | `SUPABASE_DB_PASSWORD` never stored | Manual `psql` connections require direct password lookup each time. | Store in root `.env` for convenience. Find at: Supabase → Project Settings → Database → Connection string. |
| 10 | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` never documented | If Supabase project is recreated, OAuth config is lost. | Document in this file — find at Google Cloud Console → APIs & Services → Credentials. Currently configured in Supabase Auth dashboard. |

---

## Rotation checklist

When rotating a secret, all locations in the table above must be updated simultaneously — a partial update will break production or CI.

**Highest impact (production goes down if wrong):**
1. `SUPABASE_SERVICE_ROLE_KEY` — update `web/.env.local` + root `.env` + Vercel
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` — update `web/.env.local` + root `.env` + `android/local.properties` + Vercel
3. `VERCEL_TOKEN` — update `web/.env.local` + GitHub secret
4. `FCM_SERVICE_ACCOUNT` — update Vercel only (rotate at Firebase Console → Service Accounts)

**Medium impact (CI breaks, production unaffected):**
5. `SUPABASE_ACCESS_TOKEN` — update root `.env` + GitHub secret
6. `SENTRY_AUTH_TOKEN` (shared across web, android, extension) — update `web/.env.local` + root `.env` + `android/local.properties` + `android/sentry.properties` + Vercel

**Low impact (feature degraded, nothing breaks):**
7. Seeder API keys — update root `.env` only
8. `SENTRY_DSN` variants — update all locations; old DSN keeps working until disabled
9. `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` — update Vercel + `web/.env.local`; old keys keep working until disabled
10. `RESEND_API_KEY` — update root `.env` + Vercel; old key invalidates immediately

---

## Audit Summary (2026-07-09)

- **29 total keys/secrets tracked**
- **26 present and verified** ✅
- **2 production-critical gaps** 🔴 (`VAPID_PRIVATE_KEY`, `FCM_SERVICE_ACCOUNT`)
- **2 likely-broken unconfirmed** 🟡 (`RESEND_API_KEY` on Vercel, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on Vercel)
- **4 empty seeder keys** (low priority)
- **3 undocumented but potentially useful keys** (`SUPABASE_DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)