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
5. Note the **Extension ID** (used in redirect URLs)

### 3. Configure Supabase redirect URL

Add your extension's redirect URL to Supabase:

1. Go to **Supabase → Authentication → Redirect URLs**
2. Add: `https://<EXTENSION_ID>.chromiumapp.org/`
3. Save

### 4. Set environment variables

Create `extension/.env.local` (or use the root `.env`):

```
VITE_SUPABASE_URL=https://yrhckctwtdjowulfuaqc.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>
```

---

## DevTools Setup

The extension logs all activity to the background service worker console.

### Open background service worker console

1. Go to `chrome://extensions/`
2. Find **Roam** extension
3. Click **Details**
4. Scroll to **Service Worker** section
5. Click **Inspect** — opens DevTools for the background SW
6. Go to **Console** tab to see logs

### Popup DevTools

Right-click the popup → **Inspect** opens a separate DevTools for popup code.

---

## Testing Flows

### Flow 1: Sign-In (Google OAuth)

**Precondition:** Not signed in (popup shows sign-in button)

**Steps:**

1. Click extension icon → popup opens
2. Click **Sign In with Google**
3. A new tab opens with Google OAuth — select your Google account
4. Callback page processes the redirect
5. Popup should auto-detect session and show main state
6. Check background SW console for logs:
   ```
   [roam-bg] Code exchanged successfully, initializing queue
   [roam-bg] Initializing queue with categories: [...]
   ```

**Verify:**

- ✅ Popup switches from "Sign In" to main state with 4 buttons
- ✅ Background logs show queue initialization started
- ✅ `chrome.storage.local` contains `url_queue` with hot/warming URLs

### Flow 2: Queue Initialization & Prefetch

**Precondition:** Just signed in (Flow 1)

**Steps:**

1. Open background SW console
2. Wait 2-5 seconds for validation loop
3. Observe logs:
   ```
   [roam-queue] Validation loop: checking warming URL...
   [roam-queue] Promoted URL [id] to hot queue
   ```
4. Wait another 5 seconds for refill loop:
   ```
   [roam-queue] Refill loop: hot=3, warming=5, fetching 0 fresh URLs
   ```

**Verify queue state in chrome.storage.local:**

In popup DevTools console, run:
```javascript
chrome.storage.local.get(['url_queue'], (result) => {
  console.log('Queue state:', result.url_queue);
});
```

Expected output:
```javascript
{
  hot: [ 
    { id: '...', url: 'https://example.com', status: 'hot', ... },
    { id: '...', url: 'https://example.com', status: 'hot', ... },
    { id: '...', url: 'https://example.com', status: 'hot', ... }
  ],
  warming: [ /* 5 URLs */ ]
}
```

**Verify:**
- ✅ 3 hot URLs present and ready to use
- ✅ 5 warming URLs being validated in background
- ✅ Logs show validation (2s) and refill (5s) loops running
- ✅ No validation errors (unless URLs are truly broken)

### Flow 3: Roam Button (Uses Prefetch Queue)

**Precondition:** Signed in + queue initialized (Flow 2 complete)

**Steps:**

1. Open extension popup
2. Note the Roam button is enabled
3. Click **Roam**
4. Current tab URL changes to one of the hot queue URLs
5. Popup closes
6. Check background logs:
   ```
   [roam-popup] Roam response: { ok: true, data: { url: '...' } }
   ```

**Verify:**
- ✅ Current tab navigates to a new URL (from hot queue)
- ✅ Popup closes automatically
- ✅ Background logs show roam call succeeded
- ✅ Check `chrome.storage.local` — hot queue now has 2 URLs (refill loop will top it up to 3)

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
6. Check background logs:
   ```
   [roam-queue] Cleaning up on sign-out: sending failed URLs batch...
   [roam-bg] Signed out successfully
   ```

**Verify:**
- ✅ Popup switches back to "Sign In" button
- ✅ Background logs show cleanup and sign-out succeeded
- ✅ `chrome.storage.local` still has queue data but loops are stopped
- ✅ Popup no longer shows main buttons/config panel

---

## Debugging Tips

### Check current queue state

In popup DevTools console:

```javascript
chrome.storage.local.get(['url_queue'], (result) => {
  const q = result.url_queue;
  console.log('Hot URLs:', q.hot.length);
  console.log('Warming URLs:', q.warming.length);
  console.log('Hot queue:', q.hot.map(u => ({ id: u.id.slice(0,8), url: u.url, retry: u.retry_count })));
});
```

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

### Force queue initialization

If queue didn't initialize, manually trigger from popup DevTools:

```javascript
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
  console.log('State:', res);
});
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

### Monitor validation loop

The validation loop logs every 2 seconds. Filter background SW console to see:

```
[roam-queue] Validation loop:
```

Look for:
- `checking warming URL...` — validation in progress
- `Promoted URL ... to hot queue` — validation passed
- `Schedule retry for URL ...` — validation failed, will retry
- `Evicted URL after 3 retries` — failed too many times

### Monitor refill loop

The refill loop logs every 5 seconds. Filter to see:

```
[roam-queue] Refill loop:
```

Look for:
- `hot=3, warming=5, fetching 0 fresh URLs` — queue is full, no fetch needed
- `hot=2, warming=4, fetching 1 fresh URLs` — queue low, fetching fresh URLs
- `Fetched 5 fresh URLs from roam() RPC` — successful batch fetch

---

## Known Issues & Workarounds

### Issue: "Not signed in" when testing config panel

**Cause:** Session may have expired or not been persisted correctly.

**Fix:** Sign out → Sign in again to reinitialize session.

### Issue: Queue not initializing after sign-in

**Cause:** `user_categories` table may be empty (user hasn't selected categories).

**Fix:** Check Supabase `user_categories` table for the user. If empty, manually insert a row:

```sql
INSERT INTO user_categories (user_id, category_id)
VALUES ('<user_id>', '<category_id>');
```

**Category UUIDs** are:
- `c74d3a87-e9e8-4e1e-b4ac-6b7fa72c3e0a` — Technology
- `e0c4f1b7-ae50-40f9-8d5e-9c8f5c3e7b1a` — Science & Nature
- (Others in Supabase `categories` table)

### Issue: Collections dropdown is empty

**Cause:** User has no collections yet.

**Fix:** Create a collection using the "+ New collection" option in the popup.

### Issue: Roam returns same URL twice

**Cause:** Queue is empty and fallback API call is returning last seen URL.

**Fix:** Wait 5 seconds for refill loop to fetch fresh URLs, then try Roam again.

---

## Testing Checklist

Use this checklist to verify all features work together:

### Authentication
- [ ] Sign in with Google works
- [ ] Session persists after popup closes
- [ ] Sign out clears session
- [ ] Session restores after browser restart (chrome.storage.local)

### Queue & Prefetch
- [ ] Queue initializes on sign-in
- [ ] Validation loop promotes warming → hot (every 2s)
- [ ] Refill loop fetches fresh URLs (every 5s)
- [ ] Hot queue always has 3 URLs ready
- [ ] Warming queue maintains 5 URLs being validated
- [ ] Failed URLs are retried with exponential backoff
- [ ] Failed URLs are logged after 3 retries

### Roam Button
- [ ] Roam button uses hot queue first
- [ ] Hot queue is consumed (3 → 2 → 1)
- [ ] Refill loop tops it back up to 3
- [ ] Roam navigates to a valid URL
- [ ] Popup closes after roam

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

After all tests pass:

1. Load extension in Firefox and repeat tests (manifest.json needs minor adjustments)
2. Test on multiple Google accounts
3. Test with multiple collections and URLs
4. Stress test: rapid Roam clicks (should never get duplicates or errors)
5. Long-running test: leave extension running 30+ minutes, check queue state doesn't degrade

