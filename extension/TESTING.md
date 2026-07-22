# Roam Extension Testing Guide

Complete guide for testing the Roam browser extension during development. Covers setup, manual testing flows, and debugging.

---

## Setup

### 1. Build the extension

```bash
cd extension
npm install
npm run build
```

This creates `extension/dist/` with the compiled popup and background service worker.

### 2. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select the `extension/dist/` folder
5. Note the **Extension ID** — visible under the extension name (e.g. `abcdefghijklmnopqrstuvwxyzabcdef`)

### 3. Load in Firefox

> **Build Firefox dist first:** `cd extension && node build.mjs --firefox`
> This creates `extension/dist-firefox/` with the Firefox manifest.

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `extension/dist-firefox/manifest.json`
4. Note the **Internal UUID** — shown in the extension's details under "Internal UUID"
   (looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

> **Note:** When loaded temporarily, Firefox assigns a random UUID each session.
> For a stable UUID (needed for a registered Supabase redirect URL), use a **signed** extension via Firefox AMO. After signing, the UUID stabilises and can be pre-registered.

### 4. Configure Supabase redirect URLs

Add both redirect URLs to Supabase:

1. Go to **Supabase → Authentication → URL Configuration → Redirect URLs**
2. Add the **Chrome** redirect URL:
   ```
   chrome-extension://<EXTENSION_ID>/callback.html
   ```
   Replace `<EXTENSION_ID>` with the ID from step 2 (e.g. `chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/callback.html`)
3. Add the **Firefox** redirect URL:
   ```
   moz-extension://<FIREFOX_INTERNAL_UUID>/callback.html
   ```
   Replace `<FIREFOX_INTERNAL_UUID>` with the UUID from step 3
4. Save both entries

> **Tip:** If the callback page shows "No authorization code found", it will display the exact URL it expects — copy that URL and add it to Supabase.

### 5. Set environment variables

Create a `.env` file at the **repo root** (not inside `extension/`):

```
SUPABASE_URL=https://yrhckctwtdjowulfuaqc.supabase.co
SUPABASE_ANON_KEY=<your_anon_key>
```

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

> **Firefox note:** Ensure `moz-extension://<UUID>/callback.html` is added to Supabase Redirect URLs (see Setup → Step 4). The UUID shown in `about:debugging` is per-session for temporary add-ons; use a signed AMO build for a stable UUID.

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

After all Chrome tests pass, repeat in Firefox:

1. Build Firefox dist: `node build.mjs --firefox`
2. Load `dist-firefox/manifest.json` as a Temporary Add-on in `about:debugging`
3. Note the Internal UUID and add `moz-extension://<UUID>/callback.html` to Supabase Redirect URLs
4. Repeat all flows above — behavior is identical to Chrome
5. Test on multiple Google/GitHub accounts
6. Test with multiple collections and URLs
7. Stress test: rapid Roam clicks (should navigate to different URLs each time)
8. Long-running test: leave extension running 30+ minutes, open popup and verify prefetch still works

