# Roam Extension — Technical Design

**Version:** 2.0 (rebuild)  
**Last updated:** May 2, 2026  
**Scope:** Chrome MV3 + Firefox MV3 (shared codebase, two manifests)

---

## 1. Overview

The Roam browser extension is a popup + background service worker pair. The user clicks the toolbar button, the popup opens, and they press Roam to navigate to a curated page. Everything else — voting, URL submission, collections, preferences — lives in the config panel.

The rebuild has one goal: **retain every feature with the smallest, most maintainable codebase that correctly models MV3 constraints.**

---

## 2. MV3 Constraints (Why the Old Design Broke)

Understanding these constraints is required before any architecture decision.

### 2.1 Service worker lifecycle

Chrome terminates a MV3 service worker after approximately 30 seconds of inactivity. There is no way to prevent this. Key implications:

- **No persistent background loops.** `while (true) { await sleep(5000); }` loops do not survive beyond one or two iterations before the SW is killed. The previous `validationLoop` and `refillLoop` in `queueManager.ts` were silently terminated by the browser.
- **No in-memory state.** Any JavaScript variable in the SW (including module-level `let` and cached objects) is reset on each new activation. Anything that must survive across activations must be persisted to `chrome.storage`.
- **The SW reactivates on events.** Chrome will restart a terminated SW to handle `chrome.runtime.onMessage`, `chrome.runtime.onConnect`, and other registered event listeners. The SW must be fully functional after a cold start every time.

### 2.2 No-cors fetch in extension context

Extension service workers can fetch cross-origin URLs but only in `mode: 'no-cors'`. In no-cors mode:
- The response body is opaque.
- `response.status` is always `0`.
- `response.headers` is empty.
- `response.ok` is always `false`.

The previous `validateUrl()` in `queue.ts` attempted to validate URLs with `mode: 'no-cors'` and checked `response.status !== 0` — which was always false, meaning every URL unconditionally returned `valid = true`. The validation was a no-op.

**Conclusion:** URL validation by fetching in the SW is not possible without a CORS-enabled relay. Since the Supabase `urls` table contains only approved content, validation adds no value. Skip it.

### 2.3 `chrome.storage.session` vs `chrome.storage.local`

| | `session` | `local` |
|---|---|---|
| Cleared on | Browser restart | Never (manual only) |
| Max size | 10 MB | 10 MB |
| SW access | Yes | Yes |
| Popup access | Yes | Yes |
| Use for | Transient prefetch cache | Persistent auth, prefs |

Session storage is the right home for the prefetch cache. If the browser restarts, the prefetched URL is stale anyway.

### 2.4 Firefox differences

Firefox implements MV3 with some gaps:
- `chrome.storage.session` is supported from Firefox 115.
- `background.scripts` array in the manifest is required in addition to `service_worker` for Firefox compatibility; the build handles this.
- `identity` permission (used for Chrome's `chrome.identity` API) is not available in Firefox. The extension uses Supabase OAuth redirects instead of `chrome.identity`, so this is not a blocker — but `identity` must be absent from `manifest.firefox.json`.
- The `browser_specific_settings.gecko` block in `manifest.firefox.json` specifies `strict_min_version: "140.0"` and the extension ID `roam@roamtheweb.app`.

---

## 3. File Structure

```
extension/
├── build.mjs                  ← esbuild pipeline (Chrome + Firefox, watch mode)
├── manifest.json              ← Chrome MV3 manifest
├── manifest.firefox.json      ← Firefox MV3 manifest (adds gecko block, removes identity)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── DESIGN.md                  ← this file
├── TESTING.md                 ← manual QA flows
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── src/
│   ├── background/
│   │   └── background.ts      ← SW entry point. Message router + all handlers.
│   ├── popup/
│   │   ├── popup.html         ← Static HTML. All states present, toggled with hidden attr.
│   │   ├── popup.css          ← All popup styles.
│   │   └── popup.ts           ← Popup entry point. UI state machine + event handlers.
│   ├── callback/
│   │   ├── callback.html      ← Minimal page shown during OAuth redirect.
│   │   └── callback.ts        ← Extracts tokens from URL, sends SAVE_SESSION to SW.
│   └── lib/
│       ├── constants.ts       ← FALLBACK_CATEGORIES (8 hardcoded UUIDs).
│       ├── env.ts             ← Build-time env validation. Called once at SW startup.
│       ├── messages.ts        ← Discriminated union Request/Response types + sendToBackground().
│       ├── sentry.ts          ← Sentry init. Must be the first import in both entry points.
│       └── supabase.ts        ← Supabase client factory. chromeStorageAdapter for session.
└── dist/                      ← Chrome build output (gitignored)
└── dist-firefox/              ← Firefox build output (gitignored)
```

**Deleted vs. original:**

| File | Status | Reason |
|------|--------|--------|
| `src/lib/queue.ts` | **Deleted** | Pre-fetch queue whose loops were killed by the SW lifecycle. The prefetch is now 30 lines in background.ts. |
| `src/lib/queueManager.ts` | **Deleted** | Orchestrated the now-deleted loops. Zero callers remain. |
| `src/lib/logger.ts` | **Deleted** | A structured logger that was never imported anywhere in the actual hot path. console.warn + Sentry covers needs. |

---

## 4. Background Service Worker (`background.ts`)

### 4.1 Responsibilities

- Validate build-time environment variables at startup (`validateEnvironment()`).
- Register the `onMessage` listener — the single entry point for all popup requests.
- Register the `onConnect` listener — used to keep the SW alive while the popup is open, and to trigger URL prefetching when the popup opens.
- Handle all 22 message types (auth, roam, rate, collections, preferences, etc.).
- Prefetch the next URL whenever the popup connects.

### 4.2 Startup sequence

Every SW activation (cold start or wake) runs module-level code once:

```
1. validateEnvironment()          — throws and crashes SW with clear message if vars missing
2. self.addEventListener(...)     — register unhandledrejection + error → Sentry
3. chrome.runtime.onMessage       — register message router
4. chrome.runtime.onConnect       — register keepalive + prefetch trigger
```

The `getSupabase()` call is lazy (first call creates the client). The Supabase client rehydrates its session from `chrome.storage.local` automatically via `chromeStorageAdapter`.

### 4.3 Message dispatch

```
chrome.runtime.onMessage
  → dispatch(req)          — wraps _dispatch; sends failed non-expected types to Sentry
    → _dispatch(req)       — switch on req.type, returns Response<T>
```

All handlers return `{ ok: true, data: T }` or `{ ok: false, error: string }`. The `error` string is always user-facing (no stack traces, no internal IDs).

Expected failure types that are NOT sent to Sentry: `SIGN_IN_EMAIL`, `SIGN_UP_EMAIL`, `GET_PROFILE` — these fail in normal operation (wrong password, no profile yet).

### 4.4 Prefetch design

**Problem:** Clicking Roam triggers an Edge Function call (~300–800ms). This delay is noticeable.

**Solution:** When the popup opens, the SW immediately fires a background `roam()` call and stores the result in `chrome.storage.session`. When the user clicks Roam, the handler reads from this cache first. If the cache has a valid entry (not older than 5 minutes), it returns instantly and fires the next prefetch without awaiting it. If the cache is empty or stale, it falls through to a live call.

```
chrome.runtime.onConnect
  └─ prefetchNext()                  ← fires immediately, does not block popup render

roam() handler:
  1. read chrome.storage.session['prefetch']
  2. if present AND age < 5min:
       a. delete from session storage
       b. call prefetchNext() (no await — fire and forget)
       c. return cached URL
  3. else: live Edge Function call
```

**prefetchNext() is safe to call concurrently.** If two `onConnect` events fire in quick succession (e.g. popup closed and reopened), both prefetches race to write the same key. The last write wins — both URLs come from the same pool, so there is no correctness problem.

**Why session storage, not local storage?** A prefetched URL from two days ago is useless (the page might be gone, the user's categories may have changed). Session storage is cleared on browser restart, which is the right TTL.

**Why only 1 URL, not 3?** The old design tried to maintain 3 hot + 5 warming because it assumed validation would reject many URLs. Since we've established that validation is a no-op in this context, 1 URL is correct. Approved DB content is reliable. A cache depth of 1 eliminates the most noticeable latency case (first click after opening the popup) without the complexity of managing a queue.

**The prefetch covers roaming modes too.** The standard `ROAM` call uses `prefetchNext()`. The `ROAM_COLLECTION` and `ROAM_CATEGORY` calls do NOT use the cache — those are context-specific and the cached URL was fetched without a collection/category constraint. They go live every time, and that is acceptable.

### 4.5 Domain diversity (lastRoamDomain)

To avoid serving two pages from the same domain in a row, the last-served domain is stored in `chrome.storage.local` under `lastRoamDomain`. The `roam()` Edge Function accepts an optional `exclude_domain` parameter. The prefetch call passes this value so the pre-fetched URL already respects the diversity constraint.

When `ROAM_COLLECTION` or `ROAM_CATEGORY` is called, the same `lastRoamDomain` exclusion applies.

### 4.6 Handler catalogue

| Message type | Handler | Notes |
|---|---|---|
| `GET_STATE` | `getState()` | Returns `{ signedIn, email, userId }` from current session |
| `SIGN_IN_GOOGLE` | `signInWithOAuth('google')` | Opens callback.html tab; returns `signedIn: false` immediately |
| `SIGN_IN_GITHUB` | `signInWithOAuth('github')` | Same pattern |
| `SIGN_IN_EMAIL` | `signInWithEmail()` | Direct password auth |
| `SIGN_UP_EMAIL` | `signUpWithEmail()` | Returns `needsVerification: bool` |
| `EXCHANGE_CODE` | `exchangeCode()` | PKCE code → session (called from callback.ts) |
| `SAVE_SESSION` | `saveSession()` | Implicit grant tokens → session (called from callback.ts) |
| `SIGN_OUT` | `signOut()` | Calls `clearAuthStorage()` to wipe all session keys |
| `GET_CATEGORIES` | `getCategories()` | 20-minute in-memory TTL cache; falls back to FALLBACK_CATEGORIES |
| `GET_USER_CATEGORIES` | `getUserCategories()` | Reads `user_categories` table |
| `SET_USER_CATEGORIES` | `setUserCategories()` | Delete-then-insert into `user_categories` |
| `ROAM` | `roam()` | Cache-first. Calls `prefetchNext()` on cache hit. |
| `ROAM_COLLECTION` | `roamCollection()` | Live call with `collection_id`. No prefetch. |
| `ROAM_CATEGORY` | `roamCategory()` | Live call with `category_id`. No prefetch. |
| `RATE` | `rate()` | POST to `rate` Edge Function |
| `CHECK_URL` | `checkUrl()` | Normalise → exact match → trailing-slash match in `urls` table |
| `SUBMIT_URL` | `submitUrl()` | UUID validation → POST to `submit-url` Edge Function |
| `SAVE_LATER` | `saveLater()` | Appends to `saved_urls` array in `chrome.storage.local` |
| `SET_PAYWALL_PREF` | `setPaywallPref()` | Writes to `chrome.storage.local` AND `user_settings` table |
| `SET_LANGUAGE_PREF` | `setLanguagePref()` | Same dual-write pattern |
| `GET_COLLECTIONS` | `getCollections()` | Reads `collections` + count join |
| `CREATE_COLLECTION` | `createCollection()` | Inserts into `collections`; auto-generates slug |
| `ADD_URL_TO_COLLECTION` | `addUrlToCollection()` | Normalise → lookup or create url row → insert collection_item |
| `GET_PROFILE` | `getProfile()` | Reads `profiles` by user ID |
| `SEND_FEEDBACK` | `sendFeedback()` | POST to `feedback` Edge Function |
| `REPORT_URL` | `reportUrl()` | POST to `report-url` Edge Function |

### 4.7 What is NOT in background.ts

- **No background loops.** No `setInterval`, no `while (true)`. The SW must be stateless between activations.
- **No URL validation.** Approved DB content doesn't need HTTP validation; no-cors makes it impossible anyway.
- **No complex retry orchestration.** Sentry captures failures. Retry is the user's responsibility (clicking Roam again).

---

## 5. Supabase Client (`supabase.ts`)

A singleton `SupabaseClient` instantiated once per SW activation via the lazy `getSupabase()` factory.

**Session persistence:** The client uses a custom `chromeStorageAdapter` backed by `chrome.storage.local`. Supabase v2 uses `getItem`/`setItem`/`removeItem`, all async — the adapter wraps them in Promises. This means the session (access token + refresh token) survives SW termination and is restored on the next activation automatically by the Supabase client's `autoRefreshToken` logic.

**Auth config:**
```typescript
{
  auth: {
    storage: chromeStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // no URL in a service worker
    flowType: 'pkce',          // required for public clients
  }
}
```

**Why not one client per request?** `createClient` is expensive (allocates timers for token refresh). One client per SW activation is the correct model.

---

## 6. OAuth Flow

OAuth is the most complex flow because it spans three contexts: the SW, the popup, and a callback tab.

### 6.1 Google / GitHub OAuth sequence

```
Popup                        SW (background.ts)          callback.html tab
  │                               │                             │
  │──SIGN_IN_GOOGLE───────────────▶                             │
  │                               │ signInWithOAuth('google')   │
  │                               │ supabase.auth.signInWithOAuth(...)
  │                               │ → returns {url: 'https://accounts.google.com/...'}
  │                               │ chrome.tabs.create({ url })──────────────────▶
  │◀──{ ok:true, signedIn:false }──│                             │
  │                               │                    [user completes OAuth]
  │ [polling GET_STATE every 500ms]                             │
  │                               │                    callback.html loads with:
  │                               │                    #access_token=...&refresh_token=...
  │                               │                    OR ?code=...
  │                               │                             │
  │                               │◀──SAVE_SESSION / EXCHANGE_CODE
  │                               │ session stored to chrome.storage.local
  │                               │──{ ok:true, signedIn:true }──▶
  │                               │                    tab.close()
  │ [GET_STATE returns signedIn:true]
  │ checkAndRouteAfterSignIn()
```

### 6.2 callback.ts

`callback.ts` runs in the popup context of `callback.html`. It:
1. Reads `location.hash` for `access_token` + `refresh_token` (implicit grant; Supabase default for extensions).
2. Reads `location.search` for `code` (PKCE flow fallback).
3. Sends `SAVE_SESSION` or `EXCHANGE_CODE` to the SW via `chrome.runtime.sendMessage`.
4. On success, closes itself with `window.close()` after a 1-second delay.
5. On error, shows the error message inline (the tab remains open so the user can read it).

The 10-second timeout on the `sendMessage` call guards against the SW not responding (e.g. first-ever activation where Chrome needs extra time to start it).

### 6.3 Popup polling

After initiating OAuth, the popup polls `GET_STATE` every 500ms for up to 5 minutes. When `signedIn` becomes true, it stops polling and calls `checkAndRouteAfterSignIn()`. This is intentionally simple — no `chrome.storage.onChanged` listener, no event bus.

---

## 7. Popup State Machine (`popup.ts`)

### 7.1 States

The popup has 7 mutually exclusive top-level states, each corresponding to a `<div id="state-*">` element in the HTML. Exactly one is visible at a time.

```
signedout ──[btn-signin]────────────────────────────▶ auth
                                                        │
                               [btn-auth-email] ───────▶ email-auth
                               [btn-auth-google/github]  │
                                      │                  │
                                      ▼                  ▼
                               [OAuth callback]    [form submit]
                                      │                  │
                                      └────────┬─────────┘
                                               ▼
                                         categories ◀──[btn-category-prefs from main]
                                               │
                                         [save]│
                                               ▼
                                            main ◀──────── boot (if signedIn && hasCats)
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
                       error              noresults             feedback
```

### 7.2 Boot sequence

On `DOMContentLoaded`:
1. `chrome.runtime.connect({ name: 'popup-keepalive' })` — keeps SW alive for the duration of the popup session.
2. `boot()` — sends `GET_STATE` to SW.
   - `signedIn: false` → show `state-signedout`.
   - `signedIn: true` → `checkAndRouteAfterSignIn()`:
     - Parallel fetch: `GET_USER_CATEGORIES` + `GET_CATEGORIES`.
     - `selectedIds.length > 0` → populate chips + show `state-main`.
     - `selectedIds.length === 0` → populate chips + show `state-categories` (first-time onboarding).

### 7.3 Panels

Within `state-main`, two optional panels overlap the primary controls:

- `panel-submit` — shown when 👍 is pressed on an unknown URL. Displays category chips and a submit button.
- `panel-config` — shown when ⚙️ is pressed. Contains current-page actions, roam modes, and account settings.

Panels are mutually exclusive. `showPanel(null)` hides both.

### 7.4 Dropdown helper

Two config panel actions (`Add to collection` and `Roam a collection`) both need a dismissable floating dropdown menu built from a list of collections. Rather than duplicating the imperative DOM code, a single helper handles both:

```typescript
function showDropdown(
  anchor: HTMLElement,
  items: { label: string; value: string }[],
  onPick: (value: string) => void,
  extra?: { label: string; onPick: () => void }  // optional "+ New collection" footer row
): void
```

Positions the menu below the anchor button using `getBoundingClientRect()`. Dismisses on any outside click using a one-time `document` listener. Items call `onPick(value)` and the menu removes itself.

### 7.5 Thumbs-up flow

```
user on a KNOWN url:        check → rate +1 → close
user on an UNKNOWN url:     check → show panel-submit → user picks category → submitUrl → close
user on a non-http url:     check returns !known, show panel-submit, submit may fail gracefully
```

Both the flash animation and the rate call are awaited in parallel for known URLs (`Promise.all`), so the popup closes only after both are done.

### 7.6 Thumbs-down flow

Optimistic: Roam fires immediately in parallel with the check+rate so the user doesn't wait for the rate call to complete before navigating.

```
fire ROAM (parallel)
fire CHECK_URL (parallel)
  → if known: RATE -1
await ROAM result
navigate tab → close popup
```

---

## 8. Message Protocol (`messages.ts`)

### 8.1 Types

```typescript
export type Request = 
  | { type: 'GET_STATE' }
  | { type: 'SIGN_IN_GOOGLE' }
  | { type: 'SIGN_IN_GITHUB' }
  | { type: 'SIGN_IN_EMAIL'; email: string; password: string }
  | { type: 'SIGN_UP_EMAIL'; email: string; password: string }
  | { type: 'EXCHANGE_CODE'; code: string }
  | { type: 'SAVE_SESSION'; accessToken: string; refreshToken: string }
  | { type: 'SIGN_OUT' }
  | { type: 'GET_CATEGORIES' }
  | { type: 'GET_USER_CATEGORIES' }
  | { type: 'SET_USER_CATEGORIES'; categoryIds: string[] }
  | { type: 'ROAM'; collectionId?: string }
  | { type: 'ROAM_COLLECTION'; collectionId: string }
  | { type: 'ROAM_CATEGORY'; categoryId: string }
  | { type: 'RATE'; url_id: string; vote: 1 | -1 }
  | { type: 'CHECK_URL'; url: string }
  | { type: 'SUBMIT_URL'; url: string; categoryId: string }
  | { type: 'SAVE_LATER'; url: string }
  | { type: 'SET_PAYWALL_PREF'; skip: boolean }
  | { type: 'SET_LANGUAGE_PREF'; languages: string[] }
  | { type: 'GET_COLLECTIONS' }
  | { type: 'CREATE_COLLECTION'; name: string }
  | { type: 'ADD_URL_TO_COLLECTION'; url: string; collectionId: string }
  | { type: 'GET_PROFILE' }
  | { type: 'SEND_FEEDBACK'; message: string; email?: string; platform: string }
  | { type: 'REPORT_URL'; url_id: string };

export type Response<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

### 8.2 Adding a new message type

1. Add the discriminated union member to `Request` in `messages.ts`.
2. Add the corresponding `case` to `_dispatch()` in `background.ts`.
3. Add the handler function below the switch.
4. Call from the popup with `sendToBackground<ReturnType>({ type: '...' })`.

### 8.3 sendToBackground

Retries once with a 300ms pause between attempts. This handles the common case where Chrome has terminated the SW and needs a moment to restart it before the second attempt lands. Both failures are captured to Sentry. The returned error on double failure is user-facing and safe to display.

---

## 9. Environment & Build

### 9.1 Build-time injection

Three variables are injected by esbuild's `define` at build time:

| Variable | Source | Required |
|---|---|---|
| `__SUPABASE_URL__` | `../.env → SUPABASE_URL` | Yes (build fails) |
| `__SUPABASE_ANON_KEY__` | `../.env → SUPABASE_ANON_KEY` | Yes (build fails) |
| `__SENTRY_DSN__` | `../.env → SENTRY_DSN` | No (warn only) |

`validateEnvironment()` in `env.ts` is called at SW startup and throws if `SUPABASE_URL` or `SUPABASE_ANON_KEY` are absent or malformed, immediately crashing the SW with a descriptive message. Sentry DSN absence is a warning only.

### 9.2 Build commands

```bash
cd extension

# Development (Chrome, watch mode — rebuilds on save)
pnpm dev            # → node build.mjs --watch

# Production (Chrome)
pnpm build          # → node build.mjs

# Production (Firefox)
pnpm build:firefox  # → node build.mjs --firefox
```

### 9.3 Entry points

esbuild compiles three independent bundles, each as IIFE (required for extension contexts):

| Entry | Output | Context |
|---|---|---|
| `src/background/background.ts` | `dist/background.js` | Service worker |
| `src/popup/popup.ts` | `dist/popup.js` | Popup window |
| `src/callback/callback.ts` | `dist/callback.js` | OAuth callback tab |

Static files (HTML, CSS, icons, manifest) are copied as-is by `copyStatics()`.

### 9.4 Source maps & Sentry

Production Chrome builds upload source maps to Sentry via `@sentry/esbuild-plugin` and then delete the `.map` files from `dist/` so they are not included in the store submission zip. Firefox builds skip the upload (Sentry source maps are Chrome-specific in this project's configuration).

---

## 10. Error Handling

### 10.1 Layers

| Layer | Mechanism |
|---|---|
| SW unhandled rejections | `self.addEventListener('unhandledrejection', ...)` → Sentry |
| SW runtime errors | `self.addEventListener('error', ...)` → Sentry |
| Per-message failures | `dispatch()` wrapper logs non-expected failures to Sentry |
| Popup unhandled rejections | `window.addEventListener('unhandledrejection', ...)` → Sentry |
| sendToBackground failure | Returns `{ ok: false, error: '...' }` after 2 attempts; captured to Sentry |

### 10.2 What goes to Sentry vs. what is shown to the user

- **Sentry:** unexpected errors, failed API calls, SW crashes, double-send failures.
- **User:** human-readable error string from the `{ ok: false, error }` response. Never internal IDs, stack traces, or raw Supabase error codes.
- **Expected failures (not to Sentry):** wrong password (`SIGN_IN_EMAIL`), unverified email (`SIGN_UP_EMAIL`), no profile yet (`GET_PROFILE`).

---

## 11. Storage Layout

All persistent state lives in `chrome.storage.local` unless noted.

| Key | Type | Contents | Cleared by |
|---|---|---|---|
| `sb-*-auth-token` | string | Supabase session (access + refresh tokens) | `clearAuthStorage()` on sign-out |
| `lastRoamDomain` | string | Domain of last-served URL (domain diversity) | Never (fine to persist; just a hint) |
| `saved_urls` | string[] | URLs saved for later (local-only feature) | Never |
| `skip_paywalled` | boolean | User's paywall preference | On sign-out (optional cleanup) |
| `preferred_languages` | string[] | User's language preferences | On sign-out (optional cleanup) |
| `prefetch` | `{data, cachedAt}` | **session storage** — prefetched RoamData | Browser restart; or on consumption |

---

## 12. Categories Cache

Categories change rarely (never in practice post-launch). The SW caches the `GET /categories` result in a module-level variable with a 20-minute TTL. Because the module is re-executed on each SW activation, the cache is effectively cleared every time the SW restarts anyway.

If the DB fetch fails for any reason, `FALLBACK_CATEGORIES` from `constants.ts` is returned. These are the 8 hardcoded category rows with their real UUIDs from the migration — the popup will always have something to show.

---

## 13. URL Normalisation

The normaliser runs in `background.ts` (local helper, not a shared file). It is called by `checkUrl()`, `submitUrl()`, and `addUrlToCollection()`.

Rules applied in order:
1. Parse with `new URL()` — reject anything that throws.
2. Reject non-HTTP/HTTPS protocols.
3. Force `https:`.
4. Lowercase hostname.
5. Strip `www.` prefix.
6. Remove known tracking parameters: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`, `ref`.
7. Remove hash fragment.
8. Remove trailing slash from path (except root `/`).

This matches the normaliser in `supabase/functions/_shared/normalise.ts` (canonical Deno version) and `scripts/lib/seed.js` (Node seeder version). If tracking params are added to one, add to all three.

---

## 14. Testing

See `TESTING.md` for the full manual QA checklist. Key flows:

1. **Cold start** — close browser, reopen, click extension icon. SW should restart cleanly, popup shows correct state.
2. **OAuth sign-in** — click Google, complete flow in the new tab, popup should update to categories or main state.
3. **Email sign-in** — enter credentials, expect immediate main state.
4. **Roam (cache hit)** — open popup, wait 1 second, click Roam. Should be near-instant.
5. **Roam (cache miss)** — open popup, click Roam immediately. Should still work (live call).
6. **Thumbs up (known URL)** — on a Roam-served page, click 👍, popup closes.
7. **Thumbs up (unknown URL)** — on an arbitrary page, click 👍, category picker appears.
8. **Thumbs down** — click 👎 on any page, navigate immediately to new URL.
9. **Submit URL** — pick category, submit, popup closes.
10. **Collections** — add to collection, create new, roam from collection.
11. **Report link** — click report, confirm text shows, navigates to next URL.
12. **Feedback** — open form, submit, see success message, auto-return to main.
13. **Sign out** — click sign out, see signed-out state, reopen shows same.
14. **Firefox parity** — load `dist-firefox/` in Firefox, repeat flows 1–5.
