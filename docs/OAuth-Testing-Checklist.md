# OAuth Flow Testing Checklist

Comprehensive testing checklist for all 7 critical OAuth flows across Roam platforms. Each flow should be tested before release to ensure authentication works correctly across web, browser extension, and Android app.

**Last Updated:** May 2026
**Test Environment:** All platforms should use staging environment with test OAuth credentials

---

## Platform: Web (Next.js)

### Test 1: Web Email/Password Sign-Up
- [ ] Navigate to https://roamtheweb.app/join
- [ ] Click "Sign up with email"
- [ ] Enter unique email: `test-web-<timestamp>@example.com`
- [ ] Create password (minimum 8 chars, mixed case/numbers recommended)
- [ ] Confirm password matches
- [ ] Submit form
- [ ] Email verification sent (check Supabase logs)
- [ ] Account created successfully
- [ ] Redirected to dashboard or onboarding
- [ ] Can access `/dashboard`, `/profile`, `/collections` without re-login
- [ ] Session persists after page refresh

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ________________

---

### Test 2: Web Google OAuth Sign-Up/Login
- [ ] Navigate to https://roamtheweb.app
- [ ] Click "Continue with Google" button
- [ ] Redirect to Google login works correctly
- [ ] Select or sign in with test Google account
- [ ] Google asks for permission to access profile/email
- [ ] Click "Allow" or "Continue"
- [ ] Redirected back to Roam app (`/callback` or dashboard)
- [ ] User profile created with Google name and avatar
- [ ] Session established (auth cookie set)
- [ ] Can access protected routes
- [ ] First time login creates account automatically
- [ ] Second login (same Google account) logs in existing account
- [ ] Sentry captures auth events (check Sentry dashboard)

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ________________

---

## Platform: Browser Extension (Chrome & Firefox)

### Test 3: Extension Google OAuth + Chrome Identity Flow
- [ ] Load extension in Chrome (unpacked or from store)
- [ ] Click extension icon (Roam button)
- [ ] Extension popup shows login options
- [ ] Click "Sign in with Google"
- [ ] Chrome identity flow opens (separate window/tab)
- [ ] Google login page appears
- [ ] Sign in with test Google account
- [ ] Grant permissions to Roam
- [ ] Chrome identity callback processed
- [ ] Extension popup updates to show user signed in
- [ ] Username displayed in popup
- [ ] Can click "Roam" button to get URLs (confirms auth token works)
- [ ] Session persists after closing popup and reopening
- [ ] Logging out clears session

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ________________

---

### Test 4: Extension Firefox OAuth (Different API)
- [ ] Load extension in Firefox (unpacked or from store)
- [ ] Click extension icon (Roam button)
- [ ] Extension popup shows login options
- [ ] Click "Sign in with Google"
- [ ] Firefox browser.identity.launchWebAuthFlow() opens
- [ ] Google login page appears in Firefox
- [ ] Sign in with test Google account (different from Chrome test)
- [ ] Grant permissions to Roam
- [ ] OAuth callback processed by Firefox API
- [ ] Extension popup updates to show user signed in
- [ ] Username displayed in popup
- [ ] Can click "Roam" button to get URLs (confirms auth token works)
- [ ] Session persists after closing popup and reopening
- [ ] Cross-platform: User signed in on Chrome extension, Firefox shows not logged in (different profiles)

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ________________

---

## Platform: Android App (Kotlin + Jetpack Compose)

### Test 5: Android Email/Password Sign-Up
- [ ] Install debug APK on Android device/emulator
- [ ] Launch app (MainActivity)
- [ ] Login screen appears
- [ ] Click "Sign up with email"
- [ ] Enter unique email: `test-android-<timestamp>@example.com`
- [ ] Create password (minimum 8 chars)
- [ ] Confirm password
- [ ] Tap "Sign Up" button
- [ ] Account created successfully
- [ ] Redirected to dashboard
- [ ] Can see discovery interface
- [ ] Can access user menu → profile, settings
- [ ] No crashes or errors in logcat

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ________________

---

### Test 6: Android Google OAuth via Custom Tab + Deep Link Callback
- [ ] Launch app on Android device/emulator
- [ ] Login screen appears
- [ ] Click "Sign in with Google"
- [ ] Chrome Custom Tab opens (in-app browser)
- [ ] Google login page appears
- [ ] Sign in with test Google account
- [ ] Grant permissions to Roam
- [ ] Deep link callback triggered: `app.roam.android://callback?code=...&state=...`
- [ ] Custom Tab closes automatically
- [ ] App returns to foreground
- [ ] User signed in state displayed (name, avatar)
- [ ] Session established (auth token stored securely)
- [ ] Can use roam button to fetch URLs
- [ ] Sentry logs auth events
- [ ] No crashes in logcat during OAuth flow

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ________________

---

### Test 7: Session Persistence After App Restart
- [ ] Complete Test 6 (Android OAuth login)
- [ ] User signed in and visible on dashboard
- [ ] Force quit app: Settings → Apps → Roam → Force Stop
- [ ] Or: Use `adb shell am force-stop app.roam.android`
- [ ] Relaunch app
- [ ] User should still be signed in
- [ ] No login prompt appears
- [ ] User profile visible (name, avatar)
- [ ] Can immediately use discovery button
- [ ] Session token persists from DataStore
- [ ] Repeat test after 30 minutes (token refresh should work)
- [ ] App stays logged in indefinitely until manual sign out

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ________________

---

## Cross-Platform Validation

### Error Handling
- [ ] Invalid OAuth state returns clear error message (not blank screen)
- [ ] Sentry captures OAuth errors (check Sentry dashboard)
- [ ] Network errors during OAuth don't crash app
- [ ] User can retry OAuth flow without losing state

### Sentry Event Verification
- [ ] Sentry dashboard shows auth events for each test
- [ ] Events tagged with platform (web, extension, android)
- [ ] OAuth errors captured with stacktraces
- [ ] No sensitive data (tokens, passwords) in Sentry logs

### Data Consistency
- [ ] User account created on Supabase visible in Supabase Studio
- [ ] User profile populated with OAuth data (name, email, avatar)
- [ ] Session token stored securely (not in plaintext logs)
- [ ] Multiple logins (same user, different platforms) link to same account

---

## Sign-Off

**Tester Name:** ________________________  
**Date:** ________________________  
**Overall Result:** ☐ ALL PASS ☐ SOME FAIL ☐ CRITICAL FAIL  

**Failed Tests (if any):**
1. ________________________
2. ________________________
3. ________________________

**Blockers for Release:**
- [ ] No blockers - ready to release
- [ ] Minor issues - can release with caveats
- [ ] Critical issues - do not release

**Notes for Release Team:**
________________________________
________________________________

---

## Regression Testing (For Subsequent Releases)

If this is the first full OAuth test, future releases should at minimum test:
1. Web Google OAuth (1 test = 5 mins)
2. Extension Chrome OAuth (1 test = 5 mins)
3. Android OAuth + session persistence (1 test = 10 mins)

Total regression test time: ~20 minutes per release
