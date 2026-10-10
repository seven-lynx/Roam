# RULES.md — Extension (MV3)

Read `../RULES.md` first. This file adds extension-platform rules.

## Stack
- Manifest V3
- TypeScript 5
- esbuild (custom build in `build.mjs`)
- Supabase JS client (`@supabase/supabase-js`)
- Sentry browser SDK

## Hard rules (extension-specific)

### E.1 Build-time env vars only
The extension has **no runtime env loader**. All env vars are injected at build time by esbuild's `define` option, read from the root `.env`. If you need a new var:
1. Add it to root `.env` and `.env.example`.
2. Reference it in `extension/build.mjs`'s `define` map.
3. Declare it in `extension/src/lib/env.ts`.
4. Validate it with `validateEnvironment()` at SW startup.

Missing any of these four steps → the extension will silently work with an empty value.

### E.2 No background loops
MV3 service workers are terminated aggressively. Loops, timers, and `setInterval` will be killed mid-execution. Use **event-driven** patterns:
- `chrome.runtime.onMessage`
- `chrome.runtime.onInstalled`, `chrome.runtime.onStartup`
- `chrome.runtime.onConnect` (popup open)
- `chrome.alarms` for periodic work (declared in `manifest.json`)

### E.3 Split the SW file if it exceeds ~400 lines
`background.ts` is currently 1,226 lines. Split per-message handlers into `handlers/` submodules. Keep `background.ts` as a thin dispatcher. Each PR that adds >100 lines to `background.ts` should also split at least one handler out.

### E.4 Permission audit
Every `permissions` entry in `manifest.json` must be exercised by code in `src/`. If you add a permission, add a test that uses it and document why in this file's "Permissions table" below.

### E.5 OAuth uses `chrome.identity` (not optional)
The OAuth flow at `background.ts:455` uses `chrome.identity.launchWebAuthFlow`. Firefox supports this API. **Do not remove `identity` from `manifest.json`** — it is in active use.

### E.6 Storage layers
- `chrome.storage.session` — ephemeral (lost on browser close). Use for prefetch cache, current URL.
- `chrome.storage.local` — persistent. Use for auth tokens, user preferences, persistent queues.
- Do **not** mix semantics (see historical `prefetch_queue` vs `prefetch_queue_persist` confusion).

### E.7 URL normalization must match the canonical implementations
The `normalizeUrl()` function in `src/background/background.ts` must stay in sync with:
- `supabase/functions/_shared/normalise.ts`
- `scripts/lib/seed.js`

When you add a tracking param, update all three. Add a unit test in `supabase/functions/_tests/normalise.test.ts`.

## Permissions table

| Permission | Used by | Justification |
|---|---|---|
| `tabs` | `background.ts` | Read active tab URL to exclude current site from roam |
| `storage` | `background.ts`, `popup.ts` | Supabase session + prefetch cache + user prefs |
| `identity` | `background.ts:455` | OAuth `launchWebAuthFlow` for sign-in |
| `host_permissions: https://*.supabase.co/*` | `background.ts` | Talk to Supabase API |

No permission is granted that isn't in this table.

## Forbidden patterns (extension-specific)

- `setInterval` / `setTimeout` for repeated work (use `chrome.alarms`)
- Persisting secrets in `chrome.storage.local`
- Building with `SUPABASE_SERVICE_ROLE_KEY` anywhere in the bundle
- Manifest V2 patterns (background pages, `browser_action`)
- `eval`, `new Function`, or any CSP-violating dynamic code
- Raw `console.log` in `src/lib/` (use Sentry or `console.warn`)