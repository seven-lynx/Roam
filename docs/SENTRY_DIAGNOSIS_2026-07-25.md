# Sentry Issue Diagnosis & Fix Proposals — 2026-07-25

**Sources:** `roam-android`, `roam-extension` (roam-web: 0 issues, roam-functions: N/A)
**Period:** 14 days
**Total unresolved:** 8 issues

---

## 1. ROAM-ANDROID-6 — `HttpRequestException: unexpected end of stream`
**Count:** 72 | **Users:** 26 | **Level:** error | **Last seen:** 2026-07-14

**Error:** `HTTP request to .../functions/v1/roam (POST) failed with message: unexpected end of stream`

**Root Cause:** The `roam` edge function fires fire-and-forget RPC calls (streak, XP) after the response JSON has been sent via `.then()` chains. However, the Deno Deploy isolate stays alive until **all** pending promises settle. During this window, Supabase's edge proxy can send an HTTP/2 RST_STREAM or GOAWAY frame, which OkHttp on Android interprets as a truncated response — even though the JSON body was already fully received. The client sees `unexpected end of stream` and throws `HttpRequestException`.

The code at `supabase/functions/roam/index.ts:87-92` already documents this problem and the `.then()` fix, but there's a remaining edge: the `award_xp` RPC (line 120-129) can still take 200-500ms on a cold start, keeping the isolate alive just long enough for the proxy timeout to fire.

**Proposed Fix (Supabase edge function):** Move streak and XP calls into a **separate, non-blocking background request** using `EdgeRuntime.waitUntil()` (Deno Deploy API) which tells the runtime "don't wait for this promise after the response is sent." Replace the `.then()` chains with:

```typescript
// After json(roamResult) response is built, fire-and-forget with zero isolate hold:
EdgeRuntime.waitUntil(
  Promise.allSettled([
    supabase.rpc('update_streak', { p_user_id: user.id }),
    supabase.rpc('award_xp', { p_user_id: user.id, p_action: 'roam', p_metadata: { url_id: row.id }, p_idempotency_key: idemKey }),
  ])
)
```

**Alternative (Android client):** Add a retry interceptor in OkHttp that retries on `unexpected end of stream` up to 2 times with exponential backoff, and ignore the error if a body was already received (check `response.body.contentLength() > 0`).

---

## 2. ROAM-ANDROID-P — `submit-url failed: Submission failed (HTTP 500)`
**Count:** 69 | **Users:** 30 | **Level:** info (misclassified — should be error) | **Last seen:** 2026-07-15

**Error:** Generic catch-all in `RoamRepository.submitUrl()` when `status !in 200..299` and it's not a 409 duplicate.

**Root Cause:** Multiple causes combine into this bucket:
1. **Safe Browsing API 503** — `checkSafeBrowsing` line 195-198 returns 503 "Safe Browsing check temporarily unavailable". The Android client sees 503 → `SubmitResult.Failed("Submission failed (HTTP 503)")`.
2. **Profile insert FK failures** — lines 237-263 attempt profile creation; if both the base username AND fallback username fail, a 500 is returned.
3. **Rate limit count query failure** — line 130-133, if the `count()` query fails, returns 500 "Internal error".

**Proposed Fixes:**
1. **Android side:** Improve the error message to surface the actual server error instead of "Submission failed (HTTP X)":
   ```kotlin
   // In RoamRepository.kt:196-197, use the parsed error message:
   else -> SubmitResult.Failed(message ?: "Submission failed (HTTP $status)")
   ```
   The message parsing is already done at line 187-188 — ensure it's not being overwritten. The issue may be that `supabase-kt` throws before we get the body text. Wrap with better fallback.

2. **Server side (submit-url):** Add Sentry breadcrumbs for each failure mode so we can distinguish Safe Browsing 503s from profile insert 500s:
   ```typescript
   report(`submit-url failed: ${reason}`, 'error', { userId: user.id, url: normalized })
   ```

3. **User-facing improvement:** When Safe Browsing returns 503, tell the user "Safety check unavailable — try again in a moment" instead of the generic message.

---

## 3. ROAM-ANDROID-10 — `NotFoundRestException: {"error":"No more URLs to discover"}`
**Count:** 5 | **Users:** 3 | **Level:** error | **Last seen:** 2026-07-11

**Error:** The `roam()` RPC returns 404 (pool exhausted), but supabase-kt's `functions.invoke()` throws `RestException` before the 404 check at `RoamRepository.kt:142` can execute.

**Root Cause:** Race condition in `supabase-kt`. When `functions.invoke()` sends a POST and the response is 404, the library triggers its error handler, which maps the response body to a `RestException` and throws. The `try/catch` at the call site in `MainViewModel` or wherever `roam()` is called catches this and reports to Sentry before `RoamRepository.roam()` can return null.

Specifically, the `functions.invoke("roam", body)` call at line 141 throws `RestException(status=404)` before line 142's `response.status` check runs.

**Proposed Fix (Android):** Wrap the `functions.invoke()` call in `roam()` with a proper exception handler:
```kotlin
suspend fun roam(...): RoamUrl? {
    // ...
    return try {
        val response = supabase.functions.invoke("roam", body = body)
        if (response.status.value == 404) return null  // pool exhausted
        json.decodeFromString(response.body())
    } catch (e: RestException) {
        if (e.statusCode == 404) return null  // pool exhausted — not an error
        throw e  // re-throw real errors
    }
}
```

---

## 4. ROAM-ANDROID-Z — `CancellationException: c03 was cancelled`
**Count:** 4 | **Users:** 2 | **Level:** error (misclassified — should be info or silenced) | **Last seen:** 2026-07-19

**Error:** Coroutine `c03` was cancelled. Stack traces show `onProfileFieldChanged` → `cancel` chain — the user navigated away from a screen, the ViewModel scope was cancelled, and the in-flight network request was aborted.

**Root Cause:** The Sentry SDK captures unhandled `CancellationException`s from structured concurrency. These are **not bugs** — they're normal Android lifecycle behavior. The exception bubbles up because somewhere in the coroutine chain, `CancellationException` is caught and re-thrown, or there's a `CoroutineExceptionHandler` that reports it.

**Proposed Fix:** Add a `CoroutineExceptionHandler` to the Sentry SDK initialization (or at the ViewModel scope level) that silently ignores `CancellationException`:
```kotlin
// In RoamApplication.kt Sentry init:
Sentry.init { options ->
    options.beforeSend { event, hint ->
        if (hint is ExceptionMechanismHint) {
            val exception = hint.throwable
            if (exception is CancellationException) return@beforeSend null  // drop
        }
        event
    }
}
```

---

## 5. ROAM-EXTENSION-C — `popup error shown: Something went wrong`
**Count:** 11 | **Users:** 0 | **Level:** warning | **Last seen:** 2026-07-24

**Error:** Generic "Something went wrong. Please close and reopen the extension." shown in the popup UI. One event traces to a `request` failure in Firefox 152.

**Root Cause:** The extension's `showError` function is a catch-all for any async operation failure (auth check, roam API call, queue sync, etc.). Without inspecting the actual error detail logged separately, there's no way to distinguish an auth expiration from a network timeout from an API error.

**Proposed Fix:**
1. **Add error context to showError:** Modify `popup.ts:showError()` to include the operation name and error message:
   ```typescript
   function showError(operation: string, err: Error) {
     Sentry.captureMessage(`popup error: ${operation}`, { 
       level: 'warning',
       extra: { message: err.message, stack: err.stack }
     })
     // show user-facing message...
   }
   ```
2. **Distinguish 401:** If the error is an `Unauthorized` (see ROAM-EXTENSION-E below), prompt re-login instead of "close and reopen."

---

## 6. ROAM-ANDROID-Y — `ApplicationNotResponding: ANR`
**Count:** 1 | **Users:** 1 | **Level:** fatal | **Last seen:** 2026-07-01

**Error:** ANR on main thread. Stack: `art_quick_generic_jni_trampoline` → `ReleaseByteArrayElements` → `ConditionVariable::WaitHoldingLocks` → `parkNanos` → `await`.

**Root Cause:** The main thread is blocked waiting for a bitmap/image operation. `ReleaseByteArrayElements` is a JNI call that releases a pinned byte array (typically image data loaded via `BitmapFactory`). The `ConditionVariable::WaitHoldingLocks` with `parkNanos` suggests a synchronous image decode happening on the main thread — likely loading a large OG image for display in the Roam view or the category selection UI.

The device is a Pixel 6 Pro, so this isn't a slow device issue — it's a genuine main-thread I/O block.

**Proposed Fix:**
1. Audit all `BitmapFactory.decode*` and image loading calls — ensure they use `withContext(Dispatchers.IO)` or Coil/Glide (which handle this automatically).
2. If using `RoamWebView` for rendering page content, check whether image loading within the WebView is triggering callbacks on the main thread via `shouldInterceptRequest`.

---

## 7. ROAM-EXTENSION-E — `[bg] ROAM failed: Unauthorized`
**Count:** 1 | **Users:** 0 | **Level:** error | **Last seen:** 2026-07-24

**Error:** Background service worker's roam API call returned 401 Unauthorized. This is a paired event with ROAM-EXTENSION-D.

**Root Cause:** The extension's Supabase session token expired while the service worker was running. The service worker attempted a `roam()` call with an expired JWT, got 401, and reported it as an error.

**Proposed Fix:**
1. **Auto-refresh in background:** When a 401 hits in the background script, attempt a `supabase.auth.refreshSession()` before reporting the error.
2. **Silent degradation:** If refresh also fails (user logged out), don't report to Sentry — this is expected behavior.
3. **Popup prompt:** Show a re-login prompt in the popup when the background reports an unrecoverable 401.

---

## 8. ROAM-EXTENSION-D — `popup error shown: Unauthorized`
**Count:** 1 | **Users:** 0 | **Level:** warning | **Last seen:** 2026-07-24

**Error:** Popup caught an "Unauthorized" error and showed it to the user.

**Root Cause:** Same session expiration as ROAM-EXTENSION-E, but surfaced in the popup UI. The popup tried to make an API call, got 401, and the error handler displayed a generic message.

**Proposed Fix:** Same as ROAM-EXTENSION-E — implement session refresh and re-login flow. Combined fix addresses both issues.

---

## Summary: Priority & Action Items

| Priority | Issue | Fix Complexity | Action |
|----------|-------|----------------|--------|
| **P0** | ROAM-ANDROID-6 (unexpected end of stream) | Low | Use `EdgeRuntime.waitUntil()` in roam function. Add OkHttp retry interceptor. |
| **P0** | ROAM-ANDROID-P (submit 500) | Medium | Improve error classification server-side. Better client error messages. |
| **P1** | ROAM-ANDROID-10 (404 treated as crash) | Low | Wrap `functions.invoke()` with 404 catch in `RoamRepository.roam()`. |
| **P1** | ROAM-ANDROID-Z (CancellationException noise) | Low | Add `beforeSend` filter in Sentry init to drop CancellationExceptions. |
| **P2** | ROAM-EXTENSION-C/D/E (extension auth + error handling) | Medium | Implement session refresh + operation-context error reporting in extension. |
| **P2** | ROAM-ANDROID-Y (ANR) | Medium | Audit main-thread image loading. Ensure all BitmapFactory calls use Dispatchers.IO. |

Total estimated effort: **~3 hours** for all fixes.