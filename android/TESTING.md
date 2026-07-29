# Android Testing Guide

## Overview

This guide documents testing procedures for the Roam Android app. Run the automated
unit suite before every commit, and walk the manual checklist before each release on
at least one physical device and one emulator.

**Application ID:** `app.roam.android`
**Min API Level:** 26 (Android 8.0)
**Target / Compile API Level:** 35 (Android 15)
**Stack:** Kotlin + Jetpack Compose (Material 3), Supabase Kotlin SDK, OkHttp/Ktor, WebView
**Auth:** Google OAuth (PKCE) via Chrome Custom Tabs or email/password from the inline onboarding form; redirect `app.roam.android://callback`
**Last Updated:** May 2026

> Replace `app.roam.android` in `adb` commands below if you build a variant with a
> different application ID.

---

## 1. Automated Unit Tests

The unit suite is the first line of defense and must pass before any commit.

```powershell
# Set JAVA_HOME to Android Studio's bundled JBR
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
cd android

# Run the full unit suite (Robolectric + MockK + coroutines-test)
.\gradlew.bat testDebugUnitTest
```

HTML report: `app/build/reports/tests/testDebugUnitTest/index.html`

| Suite | Tests | Covers |
|---|---|---|
| `MainViewModelTest` | 26 | Initial state, sheet toggles, collection filter, language prefs, paywall pref, roam transitions (Loaded/Exhausted/Error/offline), prefetch cache, thumbsUp/thumbsDown, saveForLater/removeSavedUrl |
| `RoamRepositoryTest` | 11 | `rate()` input validation, `UserSettings` defaults, `RoamUrl` JSON deserialization (full/minimal/unknown-keys) |
| `SwipeDirectionTest` | 15 | Threshold boundaries, dominant-axis resolution, diagonal/upward/zero drags, custom thresholds |

All three must be green before proceeding to manual testing.

---

## 2. Build & Install

```powershell
# Debug build + install on a connected device
.\gradlew.bat installDebug

# Or build the APK and install manually
.\gradlew.bat assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Release build (requires signing keys in local.properties:
#   RELEASE_STORE_FILE / RELEASE_STORE_PASSWORD / RELEASE_KEY_ALIAS / RELEASE_KEY_PASSWORD)
.\gradlew.bat assembleRelease
```

**Pre-test checklist:**
- [ ] `local.properties` has `SUPABASE_URL` and `SUPABASE_ANON_KEY` (`SENTRY_DSN` optional)
- [ ] Device has a network connection (WiFi or mobile data)
- [ ] Chrome (or another Custom Tabs provider) is installed — required for OAuth
- [ ] `adb logcat` is running to catch `FATAL EXCEPTION` / ANR traces

---

## 3. Authentication (Google OAuth or email/password)

The app supports Google OAuth via Chrome Custom Tabs and an inline email/password form. OAuth returns through the deep link `app.roam.android://callback`.

### 3.1 First sign-in

**Steps:**
1. Launch the app → SplashScreen → OnboardingScreen.
2. Tap **Continue with Google**.
3. A Chrome Custom Tab opens the Google account chooser.
4. Pick a test account and authorize.
5. The tab closes and returns to the app via `app.roam.android://callback`.

**Expected:**
- No crash on the callback; the splash does not get stuck.
- A brand-new Google user lands on **CategoryOnboardingScreen** (interest picker).
- A returning user with categories lands directly on the **Discover** tab.
- Logcat `AuthViewModel` logs show `SessionStatus = Authenticated` then a resolved `AuthState`.

### 3.2 Email/password sign-in

**Steps:**
1. Launch the app → SplashScreen → OnboardingScreen.
2. Tap **Continue with Email**.
3. Enter email and password.
4. Tap **Create Account** or **Sign In**.

**Expected:**
- New email users either confirm their inbox or proceed into onboarding depending on account settings.
- Returning email users land in the authenticated app state.
- Incorrect credentials show a clear inline error message.

### 3.3 Onboarding (interest categories)

**Steps:**
1. From CategoryOnboardingScreen, select one or more categories.
2. Confirm / continue.

**Expected:**
- Selections persist to `user_categories` (Supabase).
- `markOnboardingComplete()` advances to the Discover tab without a re-check.
- Re-launching the app skips onboarding (categories now exist).

### 3.4 Session persistence

**Steps:**
1. Sign in.
2. Force-stop: `adb shell am force-stop app.roam.android`
3. Relaunch.

**Expected:**
- User stays signed in — no OnboardingScreen.
- `TokenRefreshWorker` is scheduled (12 h periodic, KEEP policy); a missing refresh
  token resolves to `success()` and does not loop.

### 3.5 Manual deep-link simulation

```powershell
adb shell am start -a android.intent.action.VIEW `
  -d "app.roam.android://callback?code=test_code&state=test_state" `
  app.roam.android
```

**Expected:**
- The single `MainActivity` (launchMode `singleTop`) handles the intent.
- A duplicate callback URI within the same process is ignored (no double exchange).
- No uncaught exceptions in Logcat.

### 3.6 Sign out

**Steps:**
1. Go to **Settings** → **Sign out**.

**Expected:**
- Returns to OnboardingScreen.
- Supabase session cleared; a subsequent roam would require sign-in again.

---

## 4. Discovery & Rating

### 4.1 Roam (tap to discover)

**Steps:**
1. On the Discover tab, tap **Roam** (or swipe down past the threshold).
2. Repeat several times.

**Expected:**
- First roam after sign-in is near-instant (hot queue pre-filled).
- Page renders full-screen in the WebView; the status bar shows `Category · domain`.
- The hot(3)/warm(5) prefetch queues refill in the background on `Dispatchers.IO`
  (no main-thread network → no ANR).
- If the pool is empty, an **Exhausted** state is shown; on network failure an
  **Error** banner with a retry path appears.

### 4.2 Thumbs up / thumbs down

**Steps:**
1. With a page loaded, tap **Like** (thumbs up).
2. Tap **Skip** (thumbs down).

**Expected:**
- **Like** records a `+1` rating and **stays on the current page** (no navigation).
- **Skip** records a `-1` rating and **navigates to the next URL**, excluding the
  current domain.
- Haptic feedback fires on both.
- Thumbs up while no page is loaded opens the **Submit a URL** sheet instead.

### 4.3 Swipe gestures

**Steps:**
1. Swipe down → roam; swipe right → like; swipe left → skip.

**Expected:**
- Matches `resolveSwipeAction` (see `SwipeDirectionTest`): dominant axis wins, drags
  below threshold do nothing, upward swipes are ignored.

### 4.4 Focus mode

**Steps:**
1. Open the config sheet → enable **Focus mode** and pick a category (and optionally a
   subcategory).
2. Roam several times.

**Expected:**
- Results are restricted to the chosen category/subcategory.
- Changing the category/subcategory clears both prefetch queues and refills.
- Focus mode is ephemeral — it resets to off on the next app launch.

---

## 5. Collections, Saving & Submitting

### 5.1 Save for later

**Steps:**
1. Long-press / open the config sheet on a loaded page → **Save for later**.
2. Go to the **Saved** screen.

**Expected:**
- A confirmation shows briefly; the entry appears newest-first on the Saved screen.
- Saved locally in SharedPreferences (`roam_saved`) and synced to the server
  (fire-and-forget). Removing it deletes both copies.

### 5.2 Add to collection

**Steps:**
1. Config sheet → **Add to collection**.
2. Pick an existing collection, or create one inline and add.

**Expected:**
- The URL is added via the `collection` edge function.
- A newly created collection appears in the list; the item is attached to it.

### 5.3 Submit a URL

**Steps:**
1. **Settings** → **Submit a URL** (or thumbs-up on an unknown page).
2. Paste a URL, pick a category, optionally pick a subcategory (only shown after a
   category is chosen), tap **Submit**.

**Expected:**
- **Submit** is disabled until both a URL and a category are provided.
- **Cancel** dismisses without sending.
- On success a toast ("Submitted for review — thanks!") shows for ~4 s; on failure a
  "Couldn't submit" toast with the error.

### 5.4 Report broken link

**Steps:**
1. Config sheet → **Report broken link**.

**Expected:**
- The URL is reported (server sets `inactive = TRUE`), the sheet closes, and the app
  roams to the next URL excluding that domain.

---

## 6. Settings

| Setting | Default | Storage |
|---|---|---|
| Skip paywalled sites | Off | Supabase `user_settings` |
| Discovery mode | `discovery` | Supabase `user_settings` |
| Preferred languages | `["en"]` | Supabase `user_settings` |
| Dark mode for web pages | On | SharedPreferences (`web_dark_mode`) |
| JavaScript enabled | On | SharedPreferences (`js_enabled`) |
| Translate target language | `en` | SharedPreferences (`translate_language`) |
| Auto-translate current page | Off (per-page) | In-memory only — resets each roam |
| Interest categories | (onboarding) | Supabase `user_categories` |

**Checks:**
- [ ] Toggling **Dark mode for web pages** re-renders the WebView dark/light.
- [ ] Toggling **JavaScript** reloads the page with JS on/off.
- [ ] **Auto-translate** wraps the current page through Google Translate using the
      chosen target language; it does not persist across roams.
- [ ] Changing **Preferred languages** to empty falls back to `["en"]`.
- [ ] Settings backed by `user_settings` survive a reinstall (read back on launch).

---

## 7. Profile

**Steps:**
1. Open the **Profile** tab.
2. Edit username / display name / bio.
3. Tap the avatar and pick an image.

**Expected:**
- Field edits debounce ~800 ms, then upsert to `profiles`.
- Avatar is compressed to ≤ 600 px JPEG and uploaded to the `avatars` bucket; the new
  public URL appears immediately.
- Stats (pages roamed / submitted) load via server-side COUNT — no full-row fetch.
- Category chips reflect `user_categories` and toggle optimistically.

---

## 8. WebView Lifecycle

### 8.1 Backgrounding

**Steps:**
1. Load a page → press Home → wait 10 s → reopen the app.
2. Lock the screen on a loaded page → unlock.

**Expected:**
- No blank-screen bug: `onPause/onResume` toggle `pauseTimers/resumeTimers`.
- Scroll position is restored after a reload.
- If the renderer was killed (`onRenderProcessGone`), the WebView is recreated via the
  `key(webViewKey)` bump and state is restored from the saved `Bundle` — no crash.

### 8.2 In-page navigation & controls

**Steps:**
1. Tap links inside a page; use back/forward/reload from the config sheet.
2. Clear cookies from the config sheet.

**Expected:**
- Back/forward/reload act on the WebView history.
- Clear-cookies wipes cookies + web storage and reloads.

---

## 9. Offline & Sync

### 9.1 Offline roam

**Steps:**
1. Enable Airplane Mode.
2. Tap **Roam**.

**Expected:**
- An offline message is shown ("You appear to be offline…") — not a generic crash.
- No retry storm; offline errors are not sent to Sentry.

### 9.2 Offline rating queue

**Steps:**
1. While offline, thumbs-up / thumbs-down a loaded page.
2. Disable Airplane Mode and wait.

**Expected:**
- Ratings that fail with `IOException` are queued in memory (`pendingRatings`).
- On reconnect, `connectivityFlow` fires and `flushPendingRatings()` resends them.
- A roam that errored while offline auto-retries when connectivity returns.

---

## 10. Security & Compliance

- [ ] All traffic is HTTPS — `usesCleartextTraffic="false"` and
      `network_security_config.xml` are in effect (verify with a proxy).
- [ ] `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SENTRY_DSN` come from `BuildConfig`
      (injected from `local.properties`) — never hard-coded or committed.
- [ ] `Env.validateAtStartup()` fails fast if Supabase keys are missing or non-HTTPS.
- [ ] Data access is gated by Supabase RLS — the anon key alone cannot read other
      users' rows.
- [ ] No secrets printed to Logcat.

---

## 11. Crash & Stability

### 11.1 Monkey test

```powershell
adb shell monkey -p app.roam.android -v 500
```

**Expected:** no crashes, no ANRs, Logcat clean of uncaught exceptions.

### 11.2 Cold start

```powershell
adb shell am start -W -n app.roam.android/.MainActivity
```

**Expected:** cold start is responsive; the splash does not get stuck.

### 11.3 Sentry

- [ ] Real app-thrown exceptions reach Sentry via `Sentry.captureException`.
- [ ] OkHttp-auto-captured HTTP 500s are dropped by the `beforeSend` filter (noise).
- [ ] No new unresolved issues after a regression pass (check the dashboard).

---

## 12. Compatibility Matrix

Run the core flows (Sections 3–9) on each:

| API | Android | Status |
|---|---|---|
| 26 | 8.0 (min) | ___ |
| 31 | 12 | ___ |
| 35 | 15 (target) | ___ |

---

## 13. Pre-Release Regression Checklist

- [ ] `testDebugUnitTest` is green (52 tests)
- [ ] Google OAuth completes and returns via `app.roam.android://callback`
- [ ] New user → category onboarding; returning user → Discover
- [ ] Session persists across force-stop / relaunch
- [ ] Sign out clears the session
- [ ] Roam loads pages; prefetch refills without ANR
- [ ] Thumbs up stays on page; thumbs down advances
- [ ] Focus mode filters by category/subcategory and resets on relaunch
- [ ] Save for later + Saved screen + remove all work and sync
- [ ] Add to / create collection works
- [ ] Submit a URL validates (URL + category) and confirms
- [ ] Report broken link advances to the next URL
- [ ] WebView survives background, lock/unlock, and renderer death
- [ ] Offline roam shows a friendly message; ratings flush on reconnect
- [ ] All traffic HTTPS; no secrets in Logcat
- [ ] No new unresolved Sentry issues

---

## 14. Test Execution Log

| Date | Tester | Device | API | Build | Notes |
|------|--------|--------|-----|-------|-------|
|      |        |        |     |       |       |

