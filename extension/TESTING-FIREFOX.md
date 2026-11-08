# Testing the Roam Extension in Firefox

**Last Updated:** 2026-11-08

Firefox-specific manual QA for the Roam extension. The shared UI flows live in
[TESTING.md](TESTING.md); this file covers the Firefox build, the Firefox-only behaviours
that change what "pass" means, and the checks Chrome cannot exercise.

---

## 0. What is different from Chrome — read this first

| Area | Chrome | Firefox | What it means for testing |
|---|---|---|---|
| Background context | `service_worker` (`manifest.json:25-28`) | `background.scripts` + `type: "module"` event page (`manifest.firefox.json:38-41`) | Not a service worker. It is not killed on Chrome's ~30 s timer, and it stays alive while the popup port is open (`popup.ts:325`). "Cold start" tests must reload the add-on, not wait. |
| Keyboard shortcut | `commands.roam` → `Ctrl+Shift+R` (`manifest.json:30-38`) | **No `commands` key.** Guarded in code at `background.ts:314-315` | The shortcut must be *absent* in Firefox, and the extension must still load. Roam is popup-only. |
| Error reporting | real `@sentry/browser` | build-time no-op stub (`build.mjs:109-128`, `sentry-firefox-stub.ts`) | Nothing is sent to Sentry. The console is your only signal — do not expect a Sentry issue to appear for a Firefox-only bug. |
| Google sign-in | Supabase redirects to `chrome-extension://<ID>/callback.html` (`background.ts`, `signInWithOAuth`) | A temporary add-on gets a fresh `moz-extension://` UUID per install, so that callback URL cannot be pre-registered | Google sign-in cannot complete on a temporary Firefox install until the UUID is added to the Supabase redirect allowlist. The flow itself is identical: one new tab, `callback.html`, then `roamtheweb.app/profile`. See X2. |
| Cross-origin `fetch` | needs host permissions | needs host permissions | Only `https://*.supabase.co/*` is granted (`manifest.firefox.json:49-51`). The HEAD reachability gate (`background.ts:182-190,221-229`) therefore drops most candidates, so the prefetch queue can legitimately stay empty. See X3. |
| `storage.session` | present | present | Wiped on browser restart in both. The queue is mirrored to `storage.local` and restored on startup (`background.ts:142-171,306`), so a Roam after a restart can still hit cache. |

Minimum Firefox: **140 desktop**, **142 Android** (`manifest.firefox.json:10,16`).

---

## 1. Prerequisites

- Firefox 140+ (or Firefox Beta / Developer Edition — needed only for permanent unsigned
  installs).
- Node 24.x and pnpm 10.x ([README.md](README.md)).
- Root `.env` — **repo root, not `extension/`**:

  ```
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_ANON_KEY=<anon key>
  ```

  `build.mjs:38-43` exits with `[roam] ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be
  set in the root .env` if either is missing. `SENTRY_DSN` / `SENTRY_AUTH_TOKEN` are
  irrelevant for this build — source-map upload is skipped for Firefox
  (`build.mjs:177-191`).

---

## 2. Build the Firefox artifact

```powershell
pnpm -C extension install
pnpm -C extension build -- --firefox
```

Output: `extension/dist-firefox/` plus `roam-extension-firefox.zip`. The flag must come
after the script name (`-- --firefox` is what CI runs at `ci.yml:392`). Watch mode:
`pnpm -C extension dev -- --firefox` (the Sentry stub plugin is applied there too,
`build.mjs:156`).

**Never hand-edit `dist/` or `dist-firefox/`** — rebuild instead.

### 2.1 Verify the artifact before loading it

```powershell
# 1. Expected file list
Get-ChildItem extension\dist-firefox | Select-Object Name, Length

# 2. The Firefox manifest was swapped in (not the Chrome one)
Get-Content extension\dist-firefox\manifest.json | Select-String 'scripts|commands|gecko|service_worker'

# 3. The Sentry SDK is gone — expect 0 hits for the SDK internals
Select-String -Path extension\dist-firefox\*.js -Pattern 'rrweb|@sentry'

# 4. Supabase baked in (expect hits)
Select-String -Path extension\dist-firefox\*.js -Pattern 'supabase\.co' | Select-Object -First 3
```

Pass criteria: `manifest.json` contains `"scripts": ["background.js"]` and
`browser_specific_settings.gecko.id`, and contains **no** `"commands"` and no
`"service_worker"`. Files expected (verified against a real build):
`background.js` (≈255 KB), `popup.js`, `callback.js`, each with a `.map`,
`popup.html`, `popup.css`, `callback.html`, `icon-16/32/48/128.png`, and
`roam-extension-firefox.zip` (≈490 KB). Source maps stay in the Firefox package by design
([README.md](README.md)).

Check 3 will still find the DSN **string** in `background.js`: `env.ts:12` reads
`__SENTRY_DSN__` during startup validation, so the constant is baked in even though no SDK
code ships. What must be absent is the SDK itself — `rrweb`, `@sentry/*`, and the
`Sentry.init` call site. Behaviourally nothing is transmitted (X5).

---

## 3. Install paths

### 3.1 Temporary add-on — the default dev loop

1. `about:debugging#/runtime/this-firefox`
2. **This Firefox** → **Load Temporary Add-on…**
3. Select `extension/dist-firefox/manifest.json` (any file in the folder, or the zip, works)
4. The card shows the add-on ID `roam@roamtheweb.app` and an **Internal UUID**
   (`moz-extension://<uuid>/`)
5. **Reload** re-parses `manifest.json` and restarts the background scripts — do this after
   every rebuild. Nothing auto-reloads without `web-ext` (§3.4).
6. **Inspect** opens the toolbox for the background event page.

Expected behaviour: temporary installs disappear when Firefox restarts, install-time
permission prompts are not shown, and extension storage survives removal
([Extension Workshop](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)).

### 3.2 Signed AMO build — production parity pass

Install from <https://addons.mozilla.org/firefox/addon/roam-the-web/> and re-run the
checklist in §8 once. This is the only build with a stable identity and signature
enforcement, so it is the one that counts for sign-off.

### 3.3 Permanent unsigned install (Developer Edition / Nightly only)

Release Firefox refuses unsigned XPIs. In Developer Edition or Nightly:
`about:config` → `xpinstall.signatures.required` = `false` → `about:addons` → gear →
**Install Add-on From File…** → `extension/dist-firefox/roam-extension-firefox.zip`.

### 3.4 web-ext (optional: automates install, reload, and AMO lint)

`web-ext` is not a repo dependency; `pnpm dlx` leaves `package.json` untouched.

```powershell
pnpm dlx web-ext lint --source-dir=extension/dist-firefox
pnpm dlx web-ext run --source-dir=extension/dist-firefox --start-url=https://en.wikipedia.org
```

`lint` is the local AMO validator — treat warnings as review debt, since the same rules gate
store review. `run` launches a temp profile and reloads the extension on file change.

---

## 4. Where the consoles are

| Surface | How to open | Use it for |
|---|---|---|
| Background event page | `about:debugging` → **Inspect** | `[roam]` lifecycle and auth logs, storage queue, calls to Supabase |
| Popup | Open the popup → right-click → **Inspect** (undock the toolbox; the popup dies when it closes) | state routing, `sendToBackground` responses, `window.close()` timing |
| Browser console | `Ctrl+Shift+J` | catch-all; shows extension logs even with no toolbox open |
| Storage | Toolbox → **Storage** panel, or the snippets in §5 | `storage.local` vs `storage.session` divergence |
| Network | Background toolbox → **Network**, filter `roam`, `auth`, `HEAD` | Edge Function calls, HEAD reachability failures |

---

## 5. Console snippets

Paste into the **background event page** console. Callback style works on both browsers;
`await` also works on Firefox ≥ 140 (namespace and promise differences are historical —
[MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities)).

```javascript
// Identity of this install — record it, it can change between temporary installs
chrome.runtime.id; chrome.runtime.getURL('callback.html');

// Prefetch queue (session) and its persistent mirror (local)
chrome.storage.session.get(['prefetch_queue'], r => console.log('session', r.prefetch_queue));
chrome.storage.local.get(['prefetch_queue_persist'], r => console.log('local', r.prefetch_queue_persist));

// Sign-in state
chrome.runtime.sendMessage({ type: 'GET_STATE' }, r => console.log(r));

// Pending rating retries
chrome.storage.local.get(['pending_ratings'], r => console.log(r.pending_ratings));

// Full dumps / reset
chrome.storage.local.get(null, r => console.log(r));
chrome.storage.session.get(null, r => console.log(r));
chrome.storage.local.clear(); chrome.storage.session.clear();
```

The old `DEBUG.*` helpers are gone: `src/lib/debug.ts` was deleted as stale (it described the
retired URL queue) and nothing else attaches `window.DEBUG`. Use the snippets above.

---

## 6. Test flows

Run in this order; each assumes the previous passed. Shared UI detail is in
[TESTING.md](TESTING.md) — the notes here are the Firefox expectations.

### F0 — Smoke

Load the add-on, open `about:debugging` → **Inspect**. Expect the toolbar button, no
manifest error on the card, and background startup logs. `validateEnvironment()`
(`background.ts:16`) throws on a missing build-time var, so a silent add-on is almost
always a bad `.env` at build time.

### F1 — Sign in with Google

1. Popup → **Sign in / Sign up** → **Continue with Google**. The buttons disable and
   "Opening sign-in…" appears (`popup.ts:358-369`).
2. Record the console sequence:

   ```
   [roam] signInWithOAuth: starting flow for google
   [roam] signInWithOAuth: using redirectTo = https://roamtheweb.app/auth/callback
   [roam] signInWithOAuth: trying launchWebAuthFlow
   [roam] signInWithOAuth: launchWebAuthFlow error, falling back to tab   ← expected today
   [roam] signInWithOAuth: falling back to tab + callback
   ```

3. The popup polls `GET_STATE` every 500 ms for up to 5 minutes
   (`popup.ts:371-378`).

Pass: the popup reaches `#state-main` within a few seconds.
Fail: stuck on "Opening sign-in…" for 5 minutes → record the console lines and follow X2.

### F2 — Prefetch after popup open

Open the popup, then read the session queue (§5). Either a non-empty `prefetch_queue`
**or** an empty queue with failing HEAD requests in Network is a valid Firefox result —
see X3. Confirm the 30 s prefetch floor (`background.ts:34,700-702`) by opening the popup
twice in quick succession: the second open must not fire a new batch.

### F3 — Roam, cache hit

With a warm queue, click **Roam**. Expect near-instant navigation, the entry popped
(`background.ts:717-725`), the badge count dropping (`:103-114`), and a new batch starting.

### F4 — Roam, cold path

`chrome.storage.session.clear()`, then click **Roam**. Expect the live Edge Function call
(`background.ts:744`) and a normal navigation.

### F5 — Roam within a category or topic

Config (⚙️) → **Roam within this category** (`#btn-roam-category`). Expect the filtered
live call (`background.ts:766-776`). `focusContext` is set so prefetch pauses (`:199`);
clear the focus afterwards and confirm prefetch resumes.

### F6 — Roam a collection

`#btn-roam-collection` → pick a collection. Expect `ROAM_COLLECTION` in the console and a
navigation (`background.ts:756-764`).

### F7 — Add to collection / Save for later

`#btn-add-collection` (existing collection, then **+ New collection**) and
`#btn-save-later`. Verify with `GET_COLLECTIONS` / `GET_SAVED_URLS` via
`chrome.runtime.sendMessage`, then in Supabase (`collections`, `collection_items`).

### F8 — Rate up / down

👍 then 👎. On success the session queue is invalidated (`background.ts:788`). Then force
the offline path (Network panel → offline), vote, and confirm the vote lands in
`pending_ratings` and drains on the next popup open (`background.ts:252-278,311`).

### F9 — History

`#btn-history` lists entries from `extension_url_history` (`background.ts:28,1257-1266`);
**Clear history** empties it.

### F10 — Sign out, then session persistence

Sign out (`#btn-signout`) → the popup returns to `#state-signedout`. Sign in again, restart
Firefox, reopen the popup: the session must be restored from `storage.local` (the Supabase
storage adapter in `supabase.ts`) with no new OAuth round-trip.

### F11 — Reload the add-on

Click **Reload** in `about:debugging` with the popup closed, then open the popup. Expect a
clean boot, `restorePersistentPrefetch()` to run (`background.ts:306`), and no duplicated
listeners — one popup open must produce exactly one prefetch batch.

---

## 7. Firefox-only checks

### X1 — Event page lifecycle

Leave the browser idle 60+ minutes, then click **Roam**. Firefox event pages are not Chrome
service workers, so the failure mode differs: look for a missing badge and a queue read that
returns stale entries. Reload the add-on and repeat — behaviour should be identical, only
the timing differs.

### X2 — Which OAuth path actually ran

Treat Path 2 as the expected result for the current code (§0). Record:

- the `[roam] signInWithOAuth:` lines,
- whether a tab opened to Google and where it landed,
- whether the popup ended up signed in.

If Path 1 ever resolves (session set directly via `setSession`, `background.ts:479-490`),
say so in the test notes — it changes the risk profile. If neither path signs the popup in,
that is a real Firefox blocker, not a test-setup failure.

### X3 — HEAD reachability and host permissions

In the background **Network** panel, look for `HEAD` requests to candidate URLs after the
`roam` Edge Function response. Without host permission they fail, `fillPrefetch()` then
drops every candidate (`background.ts:221-229`), and the queue stays empty. Record whether
the queue ever fills on your profile — that single observation decides whether "prefetch
works" is testable on Firefox today.

### X4 — No keyboard shortcut

`about:addons` → gear → **Manage Extension Shortcuts**. Roam must not appear there,
`Ctrl+Shift+R` must do nothing, and the extension must load with no error (the
`if (chrome.commands)` guard at `background.ts:315` is what keeps it loadable).

### X5 — Sentry is really off

Network panel: no requests to `*.ingest.sentry.io`. Deliberately break something (e.g. vote
with the panel set to offline) and confirm the only output is console noise — nothing is
reported anywhere.

### X6 — `session` vs `local` precedence

Roam once (populates both stores), restart Firefox, reload the add-on, Roam again. The first
Roam after restart should hit the queue restored from `local`
(`background.ts:154-171`) and the badge should reappear.

### X7 — Popup close and callback messaging

`callback.ts:91-97` posts `ROAM_OAUTH_DONE` to `window.opener` and calls `window.close()`
after 1 s. In Firefox the opener is often `null`, so the popup's 500 ms poll is the real
mechanism. Confirm the popup switches state within ~2 s and that no orphaned callback tab is
left behind. If the tab stays open, click **Close**.

### X8 — AMO validator parity

`pnpm dlx web-ext lint --source-dir=extension/dist-firefox` must produce no errors. Compare
against the packaged `dist-firefox/roam-extension-firefox.zip` — same contents, no hand
edits.

---

## 8. Checklist

**Build & install**

- [ ] `pnpm -C extension build -- --firefox` exits 0 and writes `dist-firefox/`
- [ ] Artifact checks in §2.1 pass (Firefox manifest, Sentry SDK absent, no `commands`)
- [ ] Loads as a temporary add-on with no manifest error
- [ ] Add-on ID shows `roam@roamtheweb.app`
- [ ] **Reload** picks up a rebuild

**Auth**

- [ ] Google sign-in completes and the main state renders
- [ ] The path that ran is recorded (X2)
- [ ] Email sign-in and sign-up work
- [ ] Session survives popup close and a full browser restart
- [ ] Sign out clears the session

**Discovery**

- [ ] Prefetch behaviour recorded (X3)
- [ ] Roam navigates — cache hit and cold path
- [ ] Category / topic focus roam works and clears afterwards
- [ ] Collection roam works
- [ ] Badge shows the queue count

**Library & gamification**

- [ ] Add to collection (existing + new)
- [ ] Save for later, and the Saved pages list
- [ ] Rate up / down, offline queue drains
- [ ] History lists and clears
- [ ] Notifications / Challenges / Badges screens load

**Firefox-specific**

- [ ] X1 … X8 all recorded, not just "looked fine"

**Production parity**

- [ ] Re-ran the checklist against the AMO-signed build (§3.2)

---

## 9. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Add-on loads but nothing logs | Build-time env missing → `validateEnvironment()` threw (`background.ts:16`) | Check the root `.env`, rebuild, re-run §2.1 check 4 |
| `about:debugging` shows a manifest error | Wrong manifest in the folder (a Chrome build landed in `dist-firefox/`) | Rebuild with `-- --firefox`; confirm `background.scripts` in `dist-firefox/manifest.json` |
| Badge never shows a number | Queue empty — HEAD checks failing (X3), or the 30 s prefetch floor | Record it; Roam still works via the live path |
| Sign-in hangs on "Opening sign-in…" | Path 1 timed out (120 s, `background.ts:461-471`) and Path 2 never set a session in the extension | Record the console lines per X2; this is a code issue, not test setup |
| Callback page: "No authorization code found" | Supabase redirect allowlist missing the URL the flow used | Add `https://roamtheweb.app/auth/callback`; the page prints the URL it expected (`callback.ts:86`) |
| A rebuild is not visible | Temporary add-ons do not hot-reload | Click **Reload**, or use `web-ext run` |
| Add-on vanished after restart | Temporary installs are session-scoped | Expected — reload it, or test the AMO build |
| Storage looks dirty between runs | Temp-install storage survives removal | Run the clear snippet in §5 before removing |

---

## 10. Teardown

1. Clear both storage areas (§5) while the add-on is still loaded.
2. `about:debugging` → **Remove** the temporary add-on.
3. If you installed the AMO build for parity testing, remove it from `about:addons` and
   clear its data when Firefox prompts.

---

## Related docs

- [TESTING.md](TESTING.md) — shared manual QA flows (Chrome-first).
- [DESIGN.md](DESIGN.md) — MV3 constraints and the Chrome/Firefox manifest split (§2.4).
- [README.md](README.md) — reproducible build instructions for AMO reviewers.
- [docs/STORE_SUBMISSION_GUIDE.md](../docs/STORE_SUBMISSION_GUIDE.md) — AMO listing and
  submission steps.

