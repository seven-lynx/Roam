# Roam Extension Testing Guide

Complete guide for testing the Roam browser extension during development. Covers setup, manual testing flows, and debugging. For the Firefox build, the Firefox-only behaviours, and the checks Chrome cannot cover, use [TESTING-FIREFOX.md](TESTING-FIREFOX.md).

**Last Updated:** 2026-11-08

---

## Setup

### 1. Build the extension

```bash
cd extension
pnpm install
pnpm build              # Chrome  → extension/dist/
pnpm build -- --firefox # Firefox → extension/dist-firefox/
```

This creates the dist folder with the compiled popup, background bundle, and callback page. The build reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the **repo-root** `.env` and fails fast if either is missing.

### 2. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select the `extension/dist/` folder
5. Note the **Extension ID** — visible under the extension name (e.g. `abcdefghijklmnopqrstuvwxyzabcdef`)

### 3. Load in Firefox

> **Build Firefox dist first:** `pnpm build -- --firefox` (from `extension/`).
> This creates `extension/dist-firefox/` with the Firefox manifest.
> Full Firefox procedure: [TESTING-FIREFOX.md](TESTING-FIREFOX.md).

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `extension/dist-firefox/manifest.json`
4. Note the **Internal UUID** — shown in the extension's details under "Internal UUID"
   (looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

> **Note:** Temporary add-ons are removed when Firefox restarts; click **Reload** after each rebuild.
> The add-on ID is fixed (`roam@roamtheweb.app`, `manifest.firefox.json:9`), so the identity used by
> `chrome.runtime.getURL()` is stable across reloads in the same profile.

### 4. Configure Supabase redirect URLs

The OAuth flow finishes **inside the extension**. `signInWithOAuth()` passes
`redirectTo: chrome.runtime.getURL('callback.html')` (`background.ts`), the authorize URL
opens in one new tab, and Supabase redirects back to that extension page. `callback.ts`
hands the PKCE code to the service worker, then lands the tab on
`https://roamtheweb.app/profile`.

That extension URL must be trusted by Supabase. If it is not, Supabase falls back to the
site URL, the code never reaches the extension, and sign-in silently does nothing:

1. Go to **Supabase > Authentication > URL Configuration > Redirect URLs**
2. Add the build's own callback URL:
   Chrome `chrome-extension://<EXTENSION_ID>/callback.html` (ID from step 2),
   Firefox `moz-extension://<FIREFOX_INTERNAL_UUID>/callback.html`
   (UUID from step 3 - per-install for temporary add-ons)
3. Keep `https://roamtheweb.app/auth/callback` - the web app and the email-verification
   link (`signUpWithEmail`) still use it

> **Tip:** If the callback page shows "No authorization code found", it displays the exact
> URL it expects - copy that URL into Supabase.
>
> **Extension ID:** an unpacked Chrome build derives its ID from the folder path, so moving
> the folder invalidates the allowlist entry. Re-read the ID from `chrome://extensions`.

### 5. Set environment variables

Create a `.env` file at the **repo root** (not inside `extension/`):

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your_anon_key>
```

`SENTRY_DSN` is optional; Firefox builds stub Sentry out entirely, so no Sentry token is needed.


---

## DevTools Setup

The extension logs all activity to the background service worker console.

### Chrome: Open background service worker console

1. Go to `chrome://extensions/`
2. Find **Roam** extension
3. Click **Details**
4. Scroll to **Service Worker** section
5. Click **Inspect** — opens DevTools for the background SW
6. Go to **Console** tab to see logs

### Firefox: Open background service worker console

1. Go to `about:debugging#/runtime/this-firefox`
2. Find **Roam** under Temporary Extensions
3. Click **Inspect** — opens DevTools for the background SW
4. Go to **Console** tab to see logs

### Popup DevTools

Right-click the popup → **Inspect** opens a separate DevTools for popup code.

---

## Testing Flows

### Flow 1: Sign-In (Google OAuth)

**Precondition:** Not signed in (popup shows sign-in button)

> **Firefox note:** the flow redirects to `https://roamtheweb.app/auth/callback` (see Setup → Step 4) and, on Firefox, normally completes through the tab fallback rather than `launchWebAuthFlow`. Check [TESTING-FIREFOX.md](TESTING-FIREFOX.md) §6 F1 and §7 X2 for the console sequence to expect.

**Steps:**

1. Click extension icon → popup opens
2. Click **Sign In with Google**
3. A new tab opens with Google OAuth — select your Google account
4. Callback page processes the redirect and closes automatically
5. Popup detects the session and switches to main state
6. Check background SW console for logs:
   ```
   [roam] background service worker started
   ```

**Verify:**

- ✅ Popup switches from "Sign In" to main state with 4 buttons
- ✅ No errors shown in popup or background SW console

### Flow 2: Prefetch on Popup Open

**Precondition:** Signed in

**Steps:**

1. Open the background SW console (DevTools)
2. Click the extension icon to open the popup
3. Observe the background SW console — within ~2 seconds you should see a `roam` Edge Function call complete
4. Close the popup
5. In the background SW console run:
   ```javascript
   chrome.storage.session.get(['prefetch'], (r) => console.log(r.prefetch));
   ```

**Verify:**
- ✅ `prefetch` key is present in `chrome.storage.session` with a `data` object and `cachedAt` timestamp
- ✅ No errors in the background SW console
- ✅ The prefetch happens silently — popup opens instantly regardless

### Flow 3: Roam Button (Prefetch Cache Hit)

**Precondition:** Signed in, popup opened at least once (Flow 2 complete)

**Steps:**

1. Open extension popup
2. Note the Roam button is enabled
3. Click **Roam**
4. Current tab URL changes to a discovered URL
5. Popup closes
6. Check background logs for the roam Edge Function response

**Verify:**
- ✅ Current tab navigates to a new URL
- ✅ Popup closes automatically
- ✅ **Prefetch cache hit (fast path):** open DevTools *before* clicking Roam and check that `chrome.storage.session` had a `prefetch` entry — navigation should feel near-instant
- ✅ After Roam, verify `chrome.storage.session` prefetch entry was consumed and a new one starts filling immediately

### Flow 4: Add to Collection

**Precondition:** Signed in, viewing a web page

**Steps:**

1. Click extension icon → popup opens
2. Click **⚙️** (config toggle)
3. Scroll to "Current page" section
4. Click **Add to collection…**
5. Dropdown menu appears with your collections (if any) + "**+ New collection**" option

**Test A: Add to existing collection**

1. Click an existing collection name
2. Popup closes
3. Check background logs:
   ```
   [roam-bg] ADD_URL_TO_COLLECTION: normalizing URL...
   [roam-bg] Inserted into collection_items
   ```

**Test B: Create new collection**

1. Click **+ New collection**
2. Browser prompts for collection name
3. Enter name (e.g., "Design Tools")
4. Collection is created and URL is added
5. Popup closes

**Verify:**
- ✅ Collection dropdown populates with user's collections
- ✅ "+ New collection" option works and shows prompt
- ✅ Background logs show `ADD_URL_TO_COLLECTION` succeeded
- ✅ Check Supabase `collections` and `collection_items` tables to confirm data

### Flow 5: Save for Later

**Precondition:** Signed in, viewing a web page

**Steps:**

1. Click extension icon → popup opens
2. Click **⚙️** (config toggle)
3. Click **Save for later**
4. Popup closes
5. Check background logs:
   ```
   [roam-bg] Saved URL to chrome.storage.local
   ```

**Verify:**
- ✅ Popup closes without error
- ✅ Background logs show success
- ✅ In popup DevTools console, verify:
   ```javascript
   chrome.storage.local.get(['saved_urls'], (result) => {
     console.log('Saved URLs:', result.saved_urls);
   });
   ```
   Should show an array with the current page URL

### Flow 6: Roam Within Category

**Precondition:** Signed in, viewing a page with a known category (e.g., a Wikipedia article)

**Steps:**

1. Click extension icon → popup opens
2. Click **⚙️** (config toggle)
3. Scroll to "Roam mode" section
4. Click **Roam within this category**
5. Background fetches URLs filtered to the page's category
6. Current tab URL changes
7. Popup closes

**Verify:**
- ✅ Current tab navigates to a URL in the same category
- ✅ Background logs show `ROAM_CATEGORY` call with category_id
- ✅ Popup closes without error

### Flow 7: Roam a Collection

**Precondition:** Signed in, have at least 1 collection with URLs

**Steps:**

1. Click extension icon → popup opens
2. Click **⚙️** (config toggle)
3. Scroll to "Roam mode" section
4. Click **Roam a collection…**
5. Dropdown menu appears listing your collections
6. Click a collection
7. Background fetches a URL from that collection
8. Current tab URL changes
9. Popup closes

**Verify:**
- ✅ Collection dropdown appears with all your collections
- ✅ Current tab navigates to a URL from the selected collection
- ✅ Background logs show `ROAM_COLLECTION` call with collection_id
- ✅ Popup closes without error

### Flow 8: Paywall Toggle

**Precondition:** Signed in

**Steps:**

1. Click extension icon → popup opens
2. Click **⚙️** (config toggle)
3. Scroll to "Account" section
4. Toggle **Skip paywalled sites** switch
5. Toggle off and on again

**Verify:**
- ✅ Toggle switch responds to clicks
- ✅ In popup DevTools console:
   ```javascript
   chrome.storage.local.get(['skip_paywalled'], (result) => {
     console.log('Paywall pref:', result.skip_paywalled);
   });
   ```
   Should show `true` when toggled on, `false` when off

### Flow 9: Sign Out

**Precondition:** Signed in

**Steps:**

1. Click extension icon → popup opens
2. Click **⚙️** (config toggle)
3. Scroll to bottom
4. Click **Sign out**
5. Popup should return to sign-in state
6. Check background logs — should show only `[roam] Signed out successfully` (no queue cleanup)

**Verify:**
- ✅ Popup switches back to "Sign In" button
- ✅ Background logs show sign-out succeeded
- ✅ Popup no longer shows main buttons/config panel

---

### Flow 10: Appearance (ROAM-OS theme + CRT layers)

**Precondition:** Reload the unpacked extension so the new `theme.css` and fonts are picked up

**Steps:**

1. Click extension icon → popup opens on the **DISCOVER** screen
2. Confirm the top bar reads `● ROAM-OS │ DISCOVER` and the ✕ key closes the popup
3. Confirm the body text uses Space Grotesk and the labels/kickers use IBM Plex Mono (not the OS default sans)
4. Click **⚙️** → scroll to **Display**
5. Toggle **ROAM-OS theme** off → the popup switches to the classic blue/pink palette and the status bar stays readable
6. Toggle it back on → ROAM-OS returns
7. Toggle **CRT effects** off → scanlines, grain and vignette disappear, and **CRT static** / **CRT flicker** dim and become unclickable
8. Toggle **CRT effects** on, then **CRT static** on → faint animated snow over the popup
9. Close the popup, reopen it → the theme and all three effect switches are exactly as you left them
10. Complete a Google sign-in and check the OAuth tab

**Verify:**
- ✅ The theme, master effect and both animated layers survive a popup close
- ✅ Static/flicker are off on a fresh profile and disabled while the master is off
- ✅ No effects appear in the OAuth callback tab, and no effects appear on any browsed page
- ✅ `chrome.storage.local` holds `app_theme_variant`, `crt_effects`, `crt_static`, `crt_flicker`
- ✅ Restart the browser and reopen: the stored choices still apply (the popup never flashes the old palette first)

---

## Debugging Tips

### Check prefetch cache state

In background SW DevTools console:

```javascript
chrome.storage.session.get(['prefetch'], (r) => console.log(r.prefetch));
```

Expected when warm:
```javascript
{ data: { id: '...', url: 'https://...', title: '...' }, cachedAt: 1714600000000 }
```

`null` or `undefined` means cache miss — the next Roam click will do a live Edge Function call.

### Monitor message dispatch

In popup DevTools console, add a listener to see all messages:

```javascript
const originalSend = window.sendToBackground;
window.sendToBackground = async (req) => {
  console.log('[MSG OUT]', req.type, req);
  const res = await originalSend(req);
  console.log('[MSG BACK]', req.type, res);
  return res;
};
```

### Check authentication state

```javascript
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
  if (res.ok && res.data.signedIn) {
    console.log('Signed in as:', res.data.email);
  } else {
    console.log('Not signed in');
  }
});
```

---

## Known Issues & Workarounds

### Issue: "Not signed in" when testing config panel

**Cause:** Session may have expired or not been persisted correctly.

**Fix:** Sign out → Sign in again to reinitialize session.

### Issue: Collections dropdown is empty

**Cause:** User has no collections yet.

**Fix:** Create a collection using the "+ New collection" option in the popup.

### Issue: Roam returns same URL twice

**Cause:** `lastRoamDomain` in `chrome.storage.local` is excluding the previous domain but the pool is small.

**Fix:** Rate consecutive Roam clicks and the domain exclusion hint will shift.

---

## Testing Checklist

Use this checklist to verify all features work together:

### Authentication
- [ ] Sign in with Google works
- [ ] Session persists after popup closes
- [ ] Sign out clears session
- [ ] Session restores after browser restart (chrome.storage.local)

### Prefetch
- [ ] Opening the popup triggers a background prefetch
- [ ] `chrome.storage.session` contains a `prefetch` entry after popup open
- [ ] Roam button uses prefetch cache (near-instant navigation)
- [ ] After Roam, prefetch entry is consumed and a new one is fetched
- [ ] Roam with cold cache (no prefetch) still works via live Edge Function call

### Config Panel
- [ ] Config toggle shows/hides panel
- [ ] Add to collection → existing collection works
- [ ] Add to collection → new collection works
- [ ] Save for later persists URL to storage
- [ ] Roam within category filters correctly
- [ ] Roam a collection works
- [ ] Share copies URL to clipboard
- [ ] Paywall toggle toggles correctly
- [ ] Sign out returns to sign-in state

### Error Handling
- [ ] Invalid URLs are rejected and retried
- [ ] Network errors trigger retry logic
- [ ] Safe Browsing rejections are handled gracefully
- [ ] API errors show error message to user

---

## Next Steps

Once the Chrome flows pass, run the Firefox suite: [TESTING-FIREFOX.md](TESTING-FIREFOX.md).
It covers the Firefox build and install paths, the Firefox-only behaviours (event page
lifecycle, OAuth path selection, HEAD reachability, no keyboard command, stubbed Sentry),
the flow-by-flow expectations, and the sign-off checklist.

Additional cross-browser stress passes worth doing on both builds:

1. Test on multiple Google accounts (including one that has never used Roam)
2. Test with multiple collections and URLs
3. Stress test: rapid Roam clicks (each click should navigate somewhere new)
4. Long-running test: leave the extension idle 30+ minutes, then open the popup and verify
   Roam still resolves

