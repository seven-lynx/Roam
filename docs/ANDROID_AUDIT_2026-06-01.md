# Android App Hard Audit — Coroutines, Race Conditions & Code Quality
**Date**: June 1, 2026  
**Scope**: Complete analysis of coroutine launches, Jobs, Channels, Flows, state management, and networking patterns in `android/app/src/main/java/app/roam/android/`

---

## Executive Summary

The Android app demonstrates **solid coroutine hygiene overall**, with proper use of `viewModelScope`, `Mutex` for queue synchronization, and structured error handling. However, several **medium-severity issues** have been identified that could cause UX degradation, race conditions, or state inconsistency under specific conditions.

**Critical Finding**: The prefetch queue design has a subtle **inter-job race condition** where `startPrefillQueue()` (IO-bound) can race with `roam()` (main thread) when both update `_rawUrl` and `_currentUrl` simultaneously.

---

## Task 1: Coroutine Launches & Job Management

### Summary of All Launches

| Coroutine | Scope | Job Storage | Cancellation | File | Line |
|---|---|---|---|---|---|
| `roam()` | `viewModelScope.launch` | `roamJob` | ✅ Yes | MainViewModel.kt | 362 |
| `startPrefillQueue()` | `viewModelScope.launch(Dispatchers.IO)` | `prefetchJob` | ✅ Yes | MainViewModel.kt | 489 |
| `init` (categories) | `viewModelScope.launch` | None | Fire-and-forget | MainViewModel.kt | 308 |
| `init` (subcategories) | `viewModelScope.launch` | None | Fire-and-forget | MainViewModel.kt | 312 |
| `init` (settings) | `viewModelScope.launch` | None | Fire-and-forget | MainViewModel.kt | 316 |
| `init` (saved URLs sync) | `viewModelScope.launch` | None | Fire-and-forget | MainViewModel.kt | 333 |
| `init` (connectivity) | `viewModelScope.launch` | None | Collect in coroutine | MainViewModel.kt | 349 |
| `thumbsUp()` | `viewModelScope.launch` | None | Fire-and-forget | MainViewModel.kt | 645 |
| `thumbsDown()` | `viewModelScope.launch` | None | Fire-and-forget | MainViewModel.kt | 660 |
| `submitUrl()` | `viewModelScope.launch` (×2) | None | Fire-and-forget | MainViewModel.kt | 673, 681 |
| Collection ops | `viewModelScope.launch` (×7) | None | Fire-and-forget | MainViewModel.kt | 703+ |
| `saveForLater()` | `viewModelScope.launch` (×2) | None | Fire-and-forget | MainViewModel.kt | 788, 793 |
| `flushPendingRatings()` | `viewModelScope.launch` | None | Fire-and-forget | MainViewModel.kt | 1036 |
| `onProfileFieldChanged()` | `viewModelScope.launch` | `profileSaveJob` | ✅ Yes (debounced) | MainViewModel.kt | 975 |
| `MainActivity.onCreate()` | `lifecycleScope.launch` | None | Activity lifecycle | MainActivity.kt | 41 |
| `MainActivity.handleDeepLink()` | `lifecycleScope.launch` | None | Activity lifecycle | MainActivity.kt | 87 |
| `AuthViewModel.init` | `viewModelScope.launch` | None | Collect in coroutine | AuthViewModel.kt | 39 |
| `RoamWebView` (nav commands) | `LaunchedEffect` | None | Composition lifecycle | RoamWebView.kt | 67 |
| `RoamWebView` (clear cookies) | `LaunchedEffect` | None | Composition lifecycle | RoamWebView.kt | 77 |

### Key Observations

✅ **Good patterns**:
- All network-heavy operations use `viewModelScope` (tied to activity/fragment lifecycle)
- `roamJob` and `prefetchJob` are properly cancelled when new requests arrive
- `profileSaveJob` implements debouncing with cancellation
- No `GlobalScope` usage anywhere
- No `runBlocking` or thread-blocking calls

⚠️ **Concerns**:
- Multiple fire-and-forget launches in `init` could be consolidated
- No timeout wrapping on any coroutine (relies on Supabase client timeouts)

---

## Task 2: Channel & Flow Usage

### All Channels

| Channel | Buffer Type | Usage | File | Line |
|---|---|---|---|---|
| `_webNavChannel` | `BUFFERED` | Navigation commands (Back/Forward/Reload) | MainViewModel.kt | 120 |
| `_clearCookiesChannel` | `CONFLATED` | Cookie clear signal | MainViewModel.kt | 172 |

### Analysis

**`_webNavChannel` (BUFFERED)**:
```kotlin
private val _webNavChannel = Channel<WebNavCommand>(Channel.BUFFERED)
val webNavFlow = _webNavChannel.receiveAsFlow()

fun webNavBack()    { _webNavChannel.trySend(WebNavCommand.Back) }
fun webNavForward() { _webNavChannel.trySend(WebNavCommand.Forward) }
fun webNavReload()  { _webNavChannel.trySend(WebNavCommand.Reload) }
```
- **Semantics**: `BUFFERED` (default capacity 64) — holds commands while WebView processes them
- **Collection**: `RoamWebView.kt` line 67 in `LaunchedEffect(navCommandsFlow)`
- **Thread safety**: ✅ Safe; `trySend()` doesn't block, collected in composition scope
- **Risk**: If WebView collection pauses, buffer could fill and later sends could be dropped. Low risk in practice (user taps slowly, WebView keeps processing).

**`_clearCookiesChannel` (CONFLATED)**:
```kotlin
private val _clearCookiesChannel = Channel<Unit>(Channel.CONFLATED)
val clearCookiesFlow = _clearCookiesChannel.receiveAsFlow()

fun clearCookies() { _clearCookiesChannel.trySend(Unit) }
```
- **Semantics**: `CONFLATED` — only the newest value is kept
- **Collection**: `RoamWebView.kt` line 77
- **Risk**: ⚠️ **RACE CONDITION** — if user taps "Clear Cookies" twice in rapid succession before the first clear completes, the second tap is lost (CONFLATED drops intermediate values)
- **Impact**: Low severity; user would need to retry manually, but no data corruption

### All StateFlows (40+)

**Summary**: All StateFlows follow the pattern `_state: MutableStateFlow<T>` → `state: StateFlow<T> = _state.asStateFlow()`.

**Collection patterns**:
- **Compose UI**: `val state by vm.state.collectAsState()` (standard, safe)
- **Coroutines**: `connectivityFlow(application).collect { online -> ... }` in `init` (safe)
- **Lifecycle**: `supabase.auth.sessionStatus.collect { ... }` in AuthViewModel (safe)

**State emission patterns**: All `.value =` assignments happen on `viewModelScope`, ensuring they're thread-safe (Main dispatcher by default).

**No issues found** in Flow collection—proper use of `collectAsState()` for Compose recomposition.

---

## Task 3: Red Flags & Dangerous Patterns

### ✅ Patterns NOT found (good news)
- ❌ No `GlobalScope` anywhere
- ❌ No `runBlocking`
- ❌ No `Thread.sleep`
- ❌ No manual `synchronized` blocks
- ❌ No `ReentrantLock` (using `Mutex` instead ✅)
- ❌ No busy-waiting loops

### ⚠️ Patterns of concern

#### 1. **Multiple simultaneous StateFlow assignments in `roam()` (Race Window)**

**Location**: MainViewModel.kt, lines 389–434

```kotlin
val prefetched = ... // from hot queue
if (prefetched != null) {
    _rawUrl.value = prefetched.url       // ← Emission 1
    _currentUrl.value = prefetched.url   // ← Emission 2
    _autoTranslate.value = false         // ← Emission 3
    _state.value = RoamState.Loaded(prefetched)  // ← Emission 4
    startPrefillQueue(excludeDomain = extractDomain(prefetched.url))
    return@launch
}
```

**Problem**: These 4 assignments are sequential, but UI collection (in `DiscoverTab`) observes them separately:
```kotlin
val currentUrl by vm.currentUrl.collectAsState()
val rawUrl by vm.rawUrl.collectAsState()
val state by vm.state.collectAsState()
```

If a fast roam triggers `_state.value = Loaded` before the UI has processed `_currentUrl` update, the WebView might not load the new URL immediately. This is **not a crash**, but **UX jank**.

**Severity**: 🟡 **Medium** — user might see the wrong URL briefly or WebView content lag

**Recommended fix**: Emit a combined state object instead:
```kotlin
data class LoadedState(val url: String, val roamUrl: RoamUrl)
// Then: _state.value = RoamState.Loaded(combined)
```

---

#### 2. **Race between `roam()` and `startPrefillQueue()`** (CRITICAL)

**Location**: MainViewModel.kt, `roam()` line 362 & `startPrefillQueue()` line 489

Both functions update the queues and can fire `repo.roam()` simultaneously:

```kotlin
fun roam() {
    roamJob?.cancel()
    roamJob = viewModelScope.launch {
        // Pop from hot queue
        val prefetched = prefetchMutex.withLock { hotQueue.pop() }
        // ...call repo.roam() if not prefetched
    }
}

private fun startPrefillQueue() {
    prefetchJob?.cancel()
    prefetchJob = viewModelScope.launch(Dispatchers.IO) {
        while (true) {
            // ...call repo.roam() for warm/hot filling
        }
    }
}
```

**The race**:
1. User taps Roam → `roam()` cancels `prefetchJob` (line 362: `roamJob?.cancel()` is missing! Wait, let me re-read...)

Actually, I see: `roamJob?.cancel()` is there on line 362. But there's a race here:

1. User taps Roam → `roam()` calls `repo.roam()` (API call)
2. Meanwhile, `startPrefillQueue()` (running on IO) also calls `repo.roam()` 
3. Both complete and update state simultaneously

**Real race**: If both `roam()` and `startPrefillQueue()` receive different results from the API (e.g., one gets URL A, one gets URL B), and they update `_rawUrl`/`_currentUrl` in the wrong order, the user sees the prefetch result instead of the manual roam result.

**Severity**: 🟡 **Medium** — race window is small (sub-second), but can happen under network latency

**Root cause**: No mutual exclusion between `roam()` and `startPrefillQueue()`'s API calls. Only the hot queue accesses are locked.

**Recommended fix**:
```kotlin
fun roam() {
    roamJob?.cancel()
    prefetchJob?.cancel()  // ← Cancel prefetch while user roams
    roamJob = viewModelScope.launch {
        // ... do roam
        startPrefillQueue()  // Re-start prefetch after manual roam
    }
}
```

---

#### 3. **Multiple `.delay(2000)` magic numbers without abstraction**

**Location**: MainViewModel.kt, lines 793, 1047

```kotlin
// In saveForLater()
viewModelScope.launch {
    kotlinx.coroutines.delay(2000)
    _savedConfirmation.value = false
}

// In reportBrokenLink()
viewModelScope.launch {
    // ...
    kotlinx.coroutines.delay(2000)
    _reportConfirmation.value = false
}

// In showTransientToast()
viewModelScope.launch {
    delay(4000)
    if (_submitToast.value == message) _submitToast.value = null
}
```

**Problem**: Magic numbers scattered; hard to maintain UI consistency.

**Severity**: 🟢 **Low** — code quality, not a bug

**Fix**: Extract constants:
```kotlin
companion object {
    private const val CONFIRMATION_DISPLAY_MS = 2000
    private const val TOAST_DISPLAY_MS = 4000
}
```

---

#### 4. **Pending ratings queue is not thread-safe**

**Location**: MainViewModel.kt, lines 307, 653, 668

```kotlin
private val pendingRatings = ArrayDeque<PendingRating>()

fun thumbsUp() {
    viewModelScope.launch {
        if (error) pendingRatings.addLast(...)  // ← No synchronization
    }
}

fun flushPendingRatings() {
    if (pendingRatings.isEmpty()) return
    viewModelScope.launch {
        val snapshot = pendingRatings.toList()  // ← Concurrent read?
        pendingRatings.clear()
    }
}
```

**Problem**: `ArrayDeque` is not thread-safe. If `thumbsUp()` adds while `flushPendingRatings()` reads, a race could occur.

**Severity**: 🟡 **Medium** — could cause lost ratings or crashes

**Real risk**: Low in practice because:
- `addLast()` and `isEmpty()` / `toList()` are usually on same thread (viewModelScope)
- But if offline → online transition happens during a rating, race is possible

**Fix**: Wrap in `Mutex`:
```kotlin
private val pendingRatingsMutex = Mutex()
private val pendingRatings = ArrayDeque<PendingRating>()

fun thumbsUp() {
    viewModelScope.launch {
        pendingRatingsMutex.withLock {
            pendingRatings.addLast(...)
        }
    }
}

private fun flushPendingRatings() {
    viewModelScope.launch {
        pendingRatingsMutex.withLock {
            val snapshot = pendingRatings.toList()
            pendingRatings.clear()
            snapshot.forEach { ... }
        }
    }
}
```

---

#### 5. **Head-check timeout is hardcoded in isUrlReachable()**

**Location**: MainViewModel.kt, lines 607–620

```kotlin
private suspend fun isUrlReachable(url: String): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = "HEAD"
        conn.connectTimeout = 5_000   // ← Hardcoded
        conn.readTimeout = 5_000      // ← Hardcoded
        val code = conn.responseCode
        conn.disconnect()
        code < 400
    }.getOrDefault(false)
}
```

**Problem**: 
- 5-second timeout for each HEAD check means prefetch can stall if a URL is slow
- If 3 URLs in a row are slow, prefetch can block for 15 seconds
- This runs on `Dispatchers.IO` (limited thread pool), so slow HEAD checks can exhaust the thread pool

**Severity**: 🟡 **Medium** — prefetch can stall under poor network conditions

**Fix**: Reduce timeout and parallelize:
```kotlin
private const val HEAD_CHECK_TIMEOUT_MS = 2_000  // Reduce to 2 seconds

private suspend fun isUrlReachable(url: String): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "HEAD"
            connectTimeout = HEAD_CHECK_TIMEOUT_MS
            readTimeout = HEAD_CHECK_TIMEOUT_MS
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "Mozilla/5.0")
        }
        try {
            conn.responseCode < 400
        } finally {
            conn.disconnect()
        }
    }.getOrDefault(false)
}
```

---

#### 6. **Optimistic UI updates without rollback timeout**

**Location**: MainViewModel.kt, line 818 (deleteCollection)

```kotlin
fun deleteCollection(collectionId: String) {
    val previous = _collections.value
    _collections.value = previous.filter { it.id != collectionId }  // ← Optimistic
    viewModelScope.launch {
        val result = runCatching { repo.deleteCollection(collectionId) }
        result.onFailure { e ->
            _collections.value = previous  // ← Rollback
        }
    }
}
```

**Problem**: If the API call hangs (no timeout), the optimistic removal is permanent in the UI even if the server fails silently.

**Severity**: 🟡 **Medium** — data inconsistency if API times out

**Current state**: Supabase client likely has a default timeout, but it's not explicit.

**Recommended fix**: Add a timeout wrapper:
```kotlin
fun deleteCollection(collectionId: String) {
    val previous = _collections.value
    _collections.value = previous.filter { it.id != collectionId }
    viewModelScope.launch {
        val result = runCatching {
            withTimeout(10_000) { repo.deleteCollection(collectionId) }
        }
        result.onFailure { _collections.value = previous }
    }
}
```

---

## Task 4: State Management Analysis

### State Consolidation Issues

**Problem**: Too many independent StateFlows cause excessive recomposition.

**Example from DiscoverTab** (MainScreen.kt, lines 165–179):

```kotlin
val state by vm.state.collectAsState()
val currentUrl by vm.currentUrl.collectAsState()
val rawUrl by vm.rawUrl.collectAsState()
val showSubmitSheet by vm.showSubmitSheet.collectAsState()
val savedConfirmation by vm.savedConfirmation.collectAsState()
val reportConfirmation by vm.reportConfirmation.collectAsState()
val submitToast by vm.submitToast.collectAsState()
val collections by vm.collections.collectAsState()
val categories by vm.categories.collectAsState()
val subcategories by vm.subcategories.collectAsState()
val savedUrls by vm.savedUrls.collectAsState()
val isOnline by vm.isOnline.collectAsState()
val webDarkMode by vm.webDarkMode.collectAsState()
val jsEnabled by vm.jsEnabled.collectAsState()
val sheetGestureMode by vm.sheetGestureMode.collectAsState()
```

**Impact**: Compose recomposes the entire `DiscoverTab` whenever ANY of these 15 StateFlows changes.

**Severity**: 🟡 **Medium** — potential jank during rapid interactions

**Recommended fix**: Group related state:
```kotlin
data class DiscoverUIState(
    val state: RoamState,
    val currentUrl: String?,
    val webDarkMode: Boolean,
    val jsEnabled: Boolean,
    val sheetGestureMode: String,
)

private val _discoverUIState = MutableStateFlow(DiscoverUIState(...))
val discoverUIState: StateFlow<DiscoverUIState> = _discoverUIState.asStateFlow()
```

Then collect once:
```kotlin
val discoverUI by vm.discoverUIState.collectAsState()
```

This reduces recomposition triggers from 15 to 1.

---

### Write Amplification in Settings

**Location**: MainViewModel.kt, lines 651–695

Functions like `setWebDarkMode()` update both the StateFlow AND SharedPreferences:

```kotlin
fun setWebDarkMode(enabled: Boolean) {
    _webDarkMode.value = enabled
    prefs.edit().putBoolean(WEB_DARK_KEY, enabled).apply()  // ← Sync I/O on main thread!
}
```

**Problem**: `.apply()` is asynchronous but can block the main thread briefly on some Android versions.

**Severity**: 🟢 **Low** — unlikely to cause ANR, but not best practice

**Fix**: Move to background:
```kotlin
fun setWebDarkMode(enabled: Boolean) {
    _webDarkMode.value = enabled
    viewModelScope.launch(Dispatchers.IO) {
        prefs.edit().putBoolean(WEB_DARK_KEY, enabled).apply()
    }
}
```

---

## Task 5: Deep Dive — `roam()` Function

### Current implementation (MainViewModel.kt, lines 358–472)

```kotlin
fun roam(excludeDomain: String? = null) {
    val effectiveExclude = excludeDomain ?: extractDomain(_rawUrl.value)
    
    roamJob?.cancel()  // ← Cancel previous roam
    roamJob = viewModelScope.launch {
        // Phase 1: Try hot queue first
        val prefetched = prefetchMutex.withLock {
            var result: RoamUrl? = null
            while (hotQueue.isNotEmpty()) {
                val candidate = hotQueue.removeFirst()
                if (!isSameDomain && !isSameUrl) {
                    result = candidate
                    break
                }
            }
            result
        }
        
        if (prefetched != null) {
            // Use prefetched result instantly
            _rawUrl.value = prefetched.url
            _currentUrl.value = prefetched.url
            _state.value = RoamState.Loaded(prefetched)
            startPrefillQueue(...)
            return@launch
        }
        
        // Phase 2: Fetch from API with retries
        _state.value = RoamState.Loading
        for (attempt in 0 until 3) {
            val outcome = runCatching { repo.roam(...) }
            if (outcome.isSuccess) {
                result = outcome.getOrNull()
                success = true
                break
            }
            // Early exit for known non-retryable errors
            if (isOfflineError || isUnauthorized || isExpiredSession) break
            delay(500L * attempt)
        }
        
        if (success) {
            _rawUrl.value = result.url
            _currentUrl.value = result.url
            _state.value = RoamState.Loaded(result)
            startPrefillQueue(...)
        } else {
            _state.value = RoamState.Error(msg)
        }
    }
}
```

### Issues

#### ✅ Strengths
- Proper retry logic (up to 3 attempts with exponential backoff)
- Early exit for non-retryable errors (offline, unauthorized)
- Hot queue prevents redundant API calls
- Cancellation of previous job prevents stale results overwriting new ones

#### ⚠️ Problems

1. **No timeout on retries**
   - `delay(500L * attempt)` waits 0, 500, 1000 ms between retries
   - Total possible wait: 3 API calls × 30s each (Supabase default) + 1500ms delays = **91.5 seconds**
   - User sees "Loading" spinner for 90+ seconds

   **Fix**: Wrap in `withTimeout()`:
   ```kotlin
   withTimeout(15_000) {  // 15 second total timeout
       for (attempt in 0 until 3) { ... }
   }
   ```

2. **Race between roam() and startPrefillQueue() (noted above)**
   - If `startPrefillQueue()` is running on IO while `roam()` fires, both call `repo.roam()` simultaneously
   - They could overwrite each other's results

   **Evidence**: The recent commit fixed this by cancelling `prefetchJob` when focus mode changes, but NOT when `roam()` is called manually.

3. **Same-domain filtering uses extractDomain() which can return null**
   ```kotlin
   val effectiveExclude = excludeDomain ?: extractDomain(_rawUrl.value)
   // If _rawUrl.value is null or not a valid URL, effectiveExclude is null
   // But the hot queue filtering still works (null != null is false)
   ```
   
   This is actually OK, but risky if `_rawUrl` is never initialized.

---

## Task 6: Networking & API Calls

### All Supabase API calls (RoamRepository.kt)

| Function | Type | Timeout | Retry | Error Handling | File | Line |
|---|---|---|---|---|---|---|
| `roam()` | Edge Fn | Client default | By caller | ✅ Throws | 47–64 | |
| `rate()` | Edge Fn | Client default | None | ✅ Throws | 68–76 | |
| `submitUrl()` | Edge Fn | Client default | None | ✅ Custom | 80–110 | |
| `getUserSettings()` | Query | Client default | None | ✅ Optional | 124 | |
| `upsertUserSettings()` | Upsert | Client default | None | ✅ Throws | 138 | |
| `getCollections()` | Query | Client default | None | ✅ Returns [] | 215 | |
| `createCollection()` | Edge Fn | Client default | None | ✅ Throws | 231 | |
| `saveUrl()` | Edge Fn | Client default | None | ✅ Throws | 257 | |
| All others | Mixed | Client default | None | ✅ Throws | ... | |

### Analysis

**Timeout pattern**: All calls rely on Supabase's client-level timeout (likely 30 seconds). No explicit `withTimeout()` wrapper anywhere.

**Severity**: 🟡 **Medium**

**Risk**: If Supabase session is broken or network is very slow, user is blocked for 30 seconds with no feedback.

**Recommended fix**: Wrap long-running calls in explicit timeouts:
```kotlin
suspend fun roam(...): RoamUrl? = withTimeout(10_000) {
    supabase.functions.invoke("roam", body = body)
}
```

---

### Error handling

**Pattern**: Most calls use `runCatching { }.getOrNull()` or `runCatching { }.fold()`.

**Example** (MainViewModel.kt, thumbsUp):
```kotlin
val result = runCatching { repo.rate(urlId, 1) }
if (result.isFailure) {
    val err = result.exceptionOrNull()
    if (err != null && isOfflineError(err)) {
        pendingRatings.addLast(...)  // Queue for retry
    } else {
        err?.let { Sentry.captureException(it) }
    }
}
```

**Assessment**: ✅ Good — distinguishes offline from other errors, captures to Sentry.

---

## Task 7: Database/Room Operations

### Analysis

**Finding**: No Room database used in the codebase. All persistence is either:
1. **Supabase Postgrest** (remote database queries)
2. **SharedPreferences** (local key-value store)
3. **In-memory StateFlows** (UI state)

### Supabase Database Calls

All database operations are in `RoamRepository.kt` and use `supabase.postgrest`:

```kotlin
supabase.postgrest.from("collections").select { ... }.decodeList()
supabase.postgrest.from("user_settings").upsert(patch)
supabase.postgrest.from("user_categories").delete { filter { ... } }
```

**Thread safety**: ✅ All calls are suspend functions, called from `viewModelScope`, so thread-safe.

**Transactional safety**: ⚠️ **Issue in `saveUserInterests()`**

```kotlin
suspend fun saveUserInterests(...) {
    val userId = supabase.auth.currentUserOrNull()?.id ?: return
    supabase.postgrest.from("user_categories").delete { filter { eq("user_id", userId) } }  // ← Delete
    val rows = pillarIds.map { ... } + topicIds.mapNotNull { ... }
    if (rows.isNotEmpty()) {
        supabase.postgrest.from("user_categories").insert(rows)  // ← Insert
    }
}
```

**Race condition**: Between DELETE and INSERT, if the network fails or the user closes the app:
- All categories deleted
- Nothing inserted
- User loses their interest selections

**Severity**: 🔴 **HIGH** (data loss)

**Fix**: Use Supabase transactions or wrap in a single operation:
```kotlin
suspend fun saveUserInterests(...) {
    val userId = supabase.auth.currentUserOrNull()?.id ?: return
    val rows: List<UserCategoryFullRow> = pillarIds.map { ... } + topicIds.mapNotNull { ... }
    
    // Delete old + insert new in one request via RPC or stored procedure
    // For now, at least ensure delete-insert are atomic from client perspective:
    val deleteResult = runCatching { 
        supabase.postgrest.from("user_categories").delete { 
            filter { eq("user_id", userId) } 
        } 
    }
    if (deleteResult.isFailure) throw deleteResult.exceptionOrNull()!!
    
    if (rows.isNotEmpty()) {
        supabase.postgrest.from("user_categories").insert(rows)
    }
}
```

Actually, the real fix is to do a **bulk upsert** instead of delete-then-insert. But this would require schema changes. For now, document the risk.

### SharedPreferences

```kotlin
prefs.edit().putBoolean(key, value).apply()
prefs.edit().putString(key, value).apply()
```

**Thread safety**: ✅ SharedPreferences is internally synchronized.

**Durability**: ⚠️ `.apply()` is asynchronous; crashes before commit could lose data.

**Severity**: 🟢 **Low** — affects only UI preferences, not critical data.

---

## Task 8: Summary of Issues & Recommendations

### Priority 1: Critical (Fix Immediately)

#### Issue 1.1: `saveUserInterests()` lacks transactional safety
- **Category**: Race condition / Data loss
- **Severity**: 🔴 **CRITICAL**
- **Location**: [RoamRepository.kt](RoamRepository.kt#L374-L390)
- **Root cause**: DELETE and INSERT are separate network calls; network failure between them leaves data deleted
- **Impact**: User loses all interest selections
- **Fix**:
  ```kotlin
  suspend fun saveUserInterests(...) {
      val userId = supabase.auth.currentUserOrNull()?.id ?: return
      val rows = pillarIds.map { ... } + topicIds.mapNotNull { ... }
      
      // If no changes, skip
      if (rows.isEmpty() && pillarIds.isEmpty() && topicIds.isEmpty()) return
      
      try {
          // Delete old
          supabase.postgrest.from("user_categories").delete {
              filter { eq("user_id", userId) }
          }
          
          // Insert new (only if there are rows to insert)
          if (rows.isNotEmpty()) {
              supabase.postgrest.from("user_categories").insert(rows)
          }
      } catch (e: Exception) {
          // Re-throw so caller knows the operation failed
          throw Exception("Failed to save user interests: ${e.message}", e)
      }
  }
  ```
  **Better solution**: Implement via Supabase RPC that handles delete-insert atomically server-side.

---

#### Issue 1.2: Race between `roam()` and `startPrefillQueue()`
- **Category**: Race condition
- **Severity**: 🔴 **CRITICAL** (can overwrite user's manual roam with prefetch result)
- **Location**: [MainViewModel.kt](MainViewModel.kt#L362), [MainViewModel.kt](MainViewModel.kt#L489)
- **Root cause**: Both coroutines call `repo.roam()` simultaneously; no mutual exclusion
- **Impact**: User clicks "Roam" but sees a URL the prefetch fetched instead
- **Evidence**: Recent commit fixed prefetch cancellation in `setFocusMode()`, but not in `roam()`
- **Fix**:
  ```kotlin
  fun roam(excludeDomain: String? = null) {
      val effectiveExclude = excludeDomain ?: extractDomain(_rawUrl.value)
      
      roamJob?.cancel()
      prefetchJob?.cancel()  // ← ADD: Stop prefetch while user is roaming
      
      roamJob = viewModelScope.launch {
          // ... existing logic ...
          
          if (success) {
              _rawUrl.value = result.url
              _currentUrl.value = result.url
              _state.value = RoamState.Loaded(result)
              startPrefillQueue(excludeDomain = extractDomain(result.url))  // Restart prefetch
          }
      }
  }
  ```

---

### Priority 2: High (Fix in Next Sprint)

#### Issue 2.1: No timeout on `roam()` retries
- **Category**: UX degradation
- **Severity**: 🟡 **HIGH**
- **Location**: [MainViewModel.kt](MainViewModel.kt#L397–L427)
- **Root cause**: Retry loop with no overall timeout; can block for 90+ seconds
- **Impact**: User sees "Loading" spinner indefinitely if network is slow
- **Fix**:
  ```kotlin
  roamJob = viewModelScope.launch {
      try {
          withTimeout(15_000) {  // 15 second total timeout
              // ... existing retry logic ...
          }
      } catch (e: TimeoutCancellationException) {
          _state.value = RoamState.Error("Request timed out. Please try again.")
      }
  }
  ```

---

#### Issue 2.2: Pending ratings queue not thread-safe
- **Category**: Race condition / Data loss
- **Severity**: 🟡 **HIGH** (can lose ratings)
- **Location**: [MainViewModel.kt](MainViewModel.kt#L307), lines 653, 668, 1036
- **Root cause**: `ArrayDeque` is not thread-safe; concurrent add/clear possible
- **Impact**: Ratings may be lost during offline-to-online transition
- **Fix**:
  ```kotlin
  private val pendingRatingsMutex = Mutex()
  private val pendingRatings = ArrayDeque<PendingRating>()
  
  fun thumbsUp(context: Context) {
      // ...
      viewModelScope.launch {
          if (result.isFailure) {
              if (err != null && isOfflineError(err)) {
                  pendingRatingsMutex.withLock {
                      pendingRatings.addLast(PendingRating(urlId, 1))
                  }
              }
          }
      }
  }
  
  private fun flushPendingRatings() {
      if (pendingRatings.isEmpty()) return
      viewModelScope.launch {
          pendingRatingsMutex.withLock {
              val snapshot = pendingRatings.toList()
              pendingRatings.clear()
              snapshot.forEach { pending ->
                  runCatching { repo.rate(pending.urlId, pending.value) }
                      .onFailure { e ->
                          if (isOfflineError(e)) pendingRatings.addLast(pending)
                          else Sentry.captureException(e)
                      }
              }
          }
      }
  }
  ```

---

#### Issue 2.3: Head-check timeout blocks prefetch (IO starvation)
- **Category**: Performance degradation
- **Severity**: 🟡 **HIGH**
- **Location**: [MainViewModel.kt](MainViewModel.kt#L607–L620)
- **Root cause**: 5-second HEAD timeout; if URL is slow, prefetch stalls for 15+ seconds
- **Impact**: First roam can be delayed significantly after app launch
- **Fix**:
  ```kotlin
  private const val HEAD_CHECK_TIMEOUT_MS = 2_000
  
  private suspend fun isUrlReachable(url: String): Boolean = withContext(Dispatchers.IO) {
      runCatching {
          val conn = (URL(url).openConnection() as HttpURLConnection).apply {
              requestMethod = "HEAD"
              connectTimeout = HEAD_CHECK_TIMEOUT_MS
              readTimeout = HEAD_CHECK_TIMEOUT_MS
              instanceFollowRedirects = true
              setRequestProperty("User-Agent", "Mozilla/5.0")
          }
          try {
              conn.responseCode < 400
          } finally {
              conn.disconnect()
          }
      }.getOrDefault(false)
  }
  ```

---

### Priority 3: Medium (Fix in Current/Next Sprint)

#### Issue 3.1: Inter-StateFlow race in `roam()` result emission
- **Category**: UX jank
- **Severity**: 🟡 **MEDIUM**
- **Location**: [MainViewModel.kt](MainViewModel.kt#L389–L392), [MainViewModel.kt](MainViewModel.kt#L431–L433)
- **Root cause**: Multiple separate `.value =` assignments; UI can observe intermediate states
- **Impact**: WebView URL might lag behind state, causing flicker
- **Fix**:
  ```kotlin
  // Instead of emitting 4 separate StateFlows:
  _rawUrl.value = result.url
  _currentUrl.value = result.url
  _autoTranslate.value = false
  _state.value = RoamState.Loaded(result)
  
  // Emit a combined state:
  data class DiscoveryResult(
      val url: String,
      val roamUrl: RoamUrl,
      val autoTranslate: Boolean = false,
  )
  
  // In MainViewModel:
  private val _discoveryResult = MutableStateFlow<DiscoveryResult?>(null)
  val discoveryResult: StateFlow<DiscoveryResult?> = _discoveryResult.asStateFlow()
  
  // In roam():
  _discoveryResult.value = DiscoveryResult(
      url = result.url,
      roamUrl = result,
      autoTranslate = false,
  )
  ```

---

#### Issue 3.2: Too many StateFlows cause excessive recomposition
- **Category**: Performance
- **Severity**: 🟡 **MEDIUM** (jank under rapid interactions)
- **Location**: [MainScreen.kt](MainScreen.kt#L165–L179)
- **Root cause**: 15+ independent StateFlows collected in DiscoverTab; each change triggers full recomposition
- **Impact**: Jank when multiple fields update (e.g., roam + save-for-later simultaneously)
- **Fix**: Group related state into composite objects:
  ```kotlin
  data class DiscoverTabState(
      val roamState: RoamState,
      val currentUrl: String?,
      val rawUrl: String?,
      val webDarkMode: Boolean,
      val jsEnabled: Boolean,
      val sheetGestureMode: String,
      val isOnline: Boolean,
  )
  
  private val _discoverTabState = MutableStateFlow(DiscoverTabState(...))
  val discoverTabState: StateFlow<DiscoverTabState> = _discoverTabState.asStateFlow()
  
  // In DiscoverTab:
  val tab by vm.discoverTabState.collectAsState()
  // Use: tab.roamState, tab.currentUrl, etc.
  ```

---

#### Issue 3.3: No explicit timeout on API calls (all rely on Supabase default)
- **Category**: Robustness
- **Severity**: 🟡 **MEDIUM**
- **Location**: [RoamRepository.kt](RoamRepository.kt) (all suspend functions)
- **Root cause**: No `withTimeout()` wrapper; relies on Supabase client default (likely 30s)
- **Impact**: User blocked for up to 30 seconds on slow networks
- **Fix**: Add explicit timeouts to long-running calls:
  ```kotlin
  suspend fun roam(...): RoamUrl? = withTimeout(10_000) {
      supabase.functions.invoke("roam", body = body).body()
  }
  
  suspend fun createCollection(name: String): Collection = withTimeout(8_000) {
      val response = supabase.functions.invoke("collection", body = body)
      json.decodeFromString(response.body())
  }
  ```

---

#### Issue 3.4: Optimistic UI updates lack timeout rollback
- **Category**: Data consistency
- **Severity**: 🟡 **MEDIUM**
- **Location**: [MainViewModel.kt](MainViewModel.kt#L818) (deleteCollection)
- **Root cause**: Optimistic removal shown indefinitely if API times out
- **Impact**: User sees collection deleted but it's still on server
- **Fix**: Add timeout and rollback:
  ```kotlin
  fun deleteCollection(collectionId: String) {
      val previous = _collections.value
      _collections.value = previous.filter { it.id != collectionId }
      
      viewModelScope.launch {
          val result = runCatching {
              withTimeout(10_000) {
                  repo.deleteCollection(collectionId)
              }
          }
          result.onFailure { e ->
              _collections.value = previous
              showTransientToast("Couldn't delete: ${e.message ?: "unknown error"}")
          }
      }
  }
  ```

---

#### Issue 3.5: Hardcoded delay constants scattered throughout
- **Category**: Code quality / Maintainability
- **Severity**: 🟢 **LOW**
- **Location**: [MainViewModel.kt](MainViewModel.kt#L793), [MainViewModel.kt](MainViewModel.kt#L1047)
- **Root cause**: Magic numbers `2000`, `4000`, `500`, `300` hardcoded in multiple places
- **Impact**: Hard to maintain consistent UI timing
- **Fix**:
  ```kotlin
  companion object {
      private const val CONFIRMATION_DISPLAY_MS = 2_000
      private const val TOAST_DISPLAY_MS = 4_000
      private const val PREFETCH_INTER_CALL_DELAY_MS = 300
      private const val SESSION_RESTORE_DELAY_MS = 500
      private const val HEAD_CHECK_TIMEOUT_MS = 2_000
  }
  ```

---

#### Issue 3.6: CONFLATED channel for clear-cookies has race condition
- **Category**: UX (minor)
- **Severity**: 🟢 **LOW**
- **Location**: [MainViewModel.kt](MainViewModel.kt#L172)
- **Root cause**: CONFLATED drops intermediate values; rapid taps lose sends
- **Impact**: User must retry "Clear Cookies" if they tap twice quickly
- **Fix**: Use BUFFERED instead or dedup in UI:
  ```kotlin
  private val _clearCookiesChannel = Channel<Unit>(Channel.BUFFERED)  // Allow up to 64 pending clears
  ```

---

#### Issue 3.7: SharedPreferences writes on main thread
- **Category**: Performance (minor ANR risk)
- **Severity**: 🟢 **LOW**
- **Location**: [MainViewModel.kt](MainViewModel.kt#L147), [MainViewModel.kt](MainViewModel.kt#L166), etc.
- **Root cause**: `.apply()` is async but can block briefly
- **Impact**: Potential jank on older devices
- **Fix**:
  ```kotlin
  fun setWebDarkMode(enabled: Boolean) {
      _webDarkMode.value = enabled
      viewModelScope.launch(Dispatchers.IO) {
          prefs.edit().putBoolean(WEB_DARK_KEY, enabled).apply()
      }
  }
  ```

---

## Summary Table: All Issues by Severity

| Priority | Issue | Category | Severity | Effort | Impact |
|---|---|---|---|---|---|
| **P1** | `saveUserInterests()` not transactional | Race/Data Loss | 🔴 CRITICAL | 2h | Data loss of user interests |
| **P1** | Race between `roam()` and `startPrefillQueue()` | Race Condition | 🔴 CRITICAL | 1h | User sees wrong URL after manual roam |
| **P2** | `roam()` retry timeout missing | UX | 🟡 HIGH | 1h | Spinner stuck for 90+ seconds |
| **P2** | Pending ratings queue not thread-safe | Race/Data Loss | 🟡 HIGH | 2h | Ratings lost during offline transition |
| **P2** | HEAD-check timeout blocks prefetch | Performance | 🟡 HIGH | 1h | 15+ second delay on cold start |
| **P3** | Inter-StateFlow race in roam() | UX Jank | 🟡 MEDIUM | 2h | WebView URL lags |
| **P3** | Too many StateFlows cause recomposition | Performance | 🟡 MEDIUM | 4h | Jank during rapid interactions |
| **P3** | No explicit API timeouts | Robustness | 🟡 MEDIUM | 2h | User blocked for 30s on slow network |
| **P3** | Optimistic updates lack rollback timeout | Data Consistency | 🟡 MEDIUM | 1h | Incorrect UI if API times out |
| **P3** | Magic number delays | Code Quality | 🟢 LOW | 0.5h | Hard to maintain |
| **P3** | CONFLATED channel race | UX (Minor) | 🟢 LOW | 0.5h | User must retry "Clear Cookies" |
| **P3** | SharedPreferences writes on main | Performance (Minor) | 🟢 LOW | 1h | Potential jank on older devices |

---

## Recommendations by Priority

### Immediate (This Week)
1. **Fix `roam()` / `startPrefillQueue()` race** — Add `prefetchJob?.cancel()` in `roam()`
2. **Add timeout to `roam()` retries** — Wrap in `withTimeout(15_000)`
3. **Wrap pending ratings in Mutex** — Prevent lost ratings during offline transitions

### Next Sprint
4. **Make `saveUserInterests()` transactional** — Use RPC or batch operation server-side
5. **Reduce HEAD-check timeout** — 5s → 2s to avoid IO starvation
6. **Add explicit API call timeouts** — 10–15 seconds per call
7. **Group StateFlows to reduce recomposition** — Composite state objects
8. **Emit combined state** — Fix inter-StateFlow race in `roam()`

### Follow-up
9. **Extract delay constants** — Create companion object with timing values
10. **Move SharedPreferences writes to IO** — `Dispatchers.IO`
11. **Review other optimistic updates** — Apply same timeout pattern to all

---

## Testing Recommendations

### Unit Tests
- [ ] `roam()` cancels prefetch job before starting
- [ ] Pending ratings queue is thread-safe under concurrent adds/clears
- [ ] Multiple roam() calls don't race (latest result wins)
- [ ] Head-check timeout is enforced (<3s)

### Integration Tests
- [ ] Offline → online transition flushes pending ratings
- [ ] Rapid "Roam" taps only fetch 1 URL
- [ ] Collection delete with API failure rolls back UI
- [ ] Timeout on edge function calls shows error in <20s

### Manual Testing
- [ ] Cold app start: first roam completes in <5s (not 15+)
- [ ] Slow network (2G): roam shows error after 15s, not 90s
- [ ] Offline → online: pending ratings flush
- [ ] Rapid taps: no WebView content lags

---

## Conclusion

The Android app is **well-structured overall** with proper use of `viewModelScope`, structured concurrency, and error handling. However, **two critical race conditions** could cause data loss or UX degradation:

1. **User's manual roam can be overwritten by prefetch** — Fix by cancelling prefetch when roam() fires
2. **User interests can be lost if network fails between delete and insert** — Fix by making the operation transactional server-side

Additionally, several **medium-severity issues** affect robustness and performance:
- Missing timeouts on retry loops and API calls
- Pending ratings queue not thread-safe
- Excessive recomposition from too many StateFlows

**Recommended effort**: ~20 hours across all fixes. **Critical fixes** (2 issues) should be addressed immediately (~3 hours).

