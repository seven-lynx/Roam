package app.roam.android.viewmodel

import android.app.Application
import android.content.Context
import android.net.Uri
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.roam.android.data.repository.RoamRepository
import app.roam.android.model.CategoryItem
import app.roam.android.model.SubcategoryItem
import app.roam.android.model.Collection
import app.roam.android.model.CollectionItem
import app.roam.android.model.RoamUrl
import app.roam.android.model.SavedUrl
import app.roam.android.model.UserProfile
import app.roam.android.util.connectivityFlow
import io.github.jan.supabase.exceptions.UnauthorizedRestException
import io.sentry.Sentry
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

sealed interface WebNavCommand {
    object Back : WebNavCommand
    object Forward : WebNavCommand
    object Reload : WebNavCommand
}

sealed interface RoamState {
    data object Idle : RoamState
    data object Loading : RoamState
    data class Loaded(val roamUrl: RoamUrl) : RoamState
    data object Exhausted : RoamState  // 404 — user has seen everything
    data class Error(val message: String) : RoamState
}

data class ProfileStats(val roamed: Int = 0, val submitted: Int = 0)

class MainViewModel(
    application: Application,
    private val repo: RoamRepository,
) : AndroidViewModel(application) {
    /** Single-arg constructor required by AndroidViewModelFactory (reflection). */
    constructor(application: Application) : this(application, RoamRepository())

    private val prefs = application.getSharedPreferences("roam_saved", Context.MODE_PRIVATE)
    private val SAVED_KEY = "saved_urls"
    private val WEB_DARK_KEY = "web_dark_mode"
    private val JS_ENABLED_KEY = "js_enabled"
    private val TRANSLATE_LANG_KEY = "translate_language"
    private val SHEET_GESTURE_MODE_KEY = "sheet_gesture_mode"  // "slide" or "tap"

    private val _state = MutableStateFlow<RoamState>(RoamState.Idle)
    val state: StateFlow<RoamState> = _state.asStateFlow()

    private val _savedUrls = MutableStateFlow<List<SavedUrl>>(loadSavedUrls())
    val savedUrls: StateFlow<List<SavedUrl>> = _savedUrls.asStateFlow()

    /** True while a save-for-later confirmation should be visible */
    private val _savedConfirmation = MutableStateFlow(false)
    val savedConfirmation: StateFlow<Boolean> = _savedConfirmation.asStateFlow()

    /** True while a dead-link report confirmation should be visible */
    private val _reportConfirmation = MutableStateFlow(false)
    val reportConfirmation: StateFlow<Boolean> = _reportConfirmation.asStateFlow()

    /** One-shot message shown after a submit-url attempt (null = nothing to show) */
    private val _submitToast = MutableStateFlow<String?>(null)
    val submitToast: StateFlow<String?> = _submitToast.asStateFlow()

    /** User's collections (lazy-loaded when config sheet opens) */
    private val _collections = MutableStateFlow<List<Collection>>(emptyList())
    val collections: StateFlow<List<Collection>> = _collections.asStateFlow()

    /** Collection currently open for browsing in SavedScreen (null = list view) */
    private val _selectedCollection = MutableStateFlow<Collection?>(null)
    val selectedCollection: StateFlow<Collection?> = _selectedCollection.asStateFlow()

    private val _collectionItems = MutableStateFlow<List<CollectionItem>>(emptyList())
    val collectionItems: StateFlow<List<CollectionItem>> = _collectionItems.asStateFlow()

    private val _collectionItemsLoading = MutableStateFlow(false)
    val collectionItemsLoading: StateFlow<Boolean> = _collectionItemsLoading.asStateFlow()

    /** Controls whether the "add to collection" dialog is visible */
    private val _showAddToCollection = MutableStateFlow(false)
    val showAddToCollection: StateFlow<Boolean> = _showAddToCollection.asStateFlow()

    /** The URL currently loaded in the WebView (may differ from state while loading next) */
    private val _currentUrl = MutableStateFlow<String?>(null)
    val currentUrl: StateFlow<String?> = _currentUrl.asStateFlow()

    /** The canonical (un-translated) URL from the discovery API — never a Google Translate wrapper */
    private val _rawUrl = MutableStateFlow<String?>(null)
    val rawUrl: StateFlow<String?> = _rawUrl.asStateFlow()

    private val _webNavChannel = Channel<WebNavCommand>(Channel.BUFFERED)
    val webNavFlow = _webNavChannel.receiveAsFlow()

    fun webNavBack()    { _webNavChannel.trySend(WebNavCommand.Back) }
    fun webNavForward() { _webNavChannel.trySend(WebNavCommand.Forward) }
    fun webNavReload()  { _webNavChannel.trySend(WebNavCommand.Reload) }

    /** Active collection filter (null = global discovery) */
    private val _activeCollectionId = MutableStateFlow<String?>(null)
    val activeCollectionId: StateFlow<String?> = _activeCollectionId.asStateFlow()

    /** Controls whether the submit bottom sheet is visible */
    private val _showSubmitSheet = MutableStateFlow(false)
    val showSubmitSheet: StateFlow<Boolean> = _showSubmitSheet.asStateFlow()

    /** Controls whether the config bottom sheet is visible */
    private val _showConfigSheet = MutableStateFlow(false)
    val showConfigSheet: StateFlow<Boolean> = _showConfigSheet.asStateFlow()

    /** User preference: skip paywalled sites */
    private val _skipPaywalled = MutableStateFlow(false)
    val skipPaywalled: StateFlow<Boolean> = _skipPaywalled.asStateFlow()

    /** User preference: discovery mode ("discovery" = broad, "deep_dive" = personalised) */
    private val _discoveryMode = MutableStateFlow("discovery")
    val discoveryMode: StateFlow<String> = _discoveryMode.asStateFlow()

    /** User preference: render web pages in dark mode */
    private val _webDarkMode = MutableStateFlow(prefs.getBoolean(WEB_DARK_KEY, true))
    val webDarkMode: StateFlow<Boolean> = _webDarkMode.asStateFlow()

    fun setWebDarkMode(enabled: Boolean) {
        _webDarkMode.value = enabled
        prefs.edit().putBoolean(WEB_DARK_KEY, enabled).apply()
    }

    /** Auto-translate is ephemeral (per-page) — always starts off, resets on each roam */
    private val _autoTranslate = MutableStateFlow(false)
    val autoTranslate: StateFlow<Boolean> = _autoTranslate.asStateFlow()

    fun setAutoTranslate(enabled: Boolean) {
        _autoTranslate.value = enabled
        val raw = _rawUrl.value ?: return
        _currentUrl.value = if (enabled) translateUrl(raw) else raw
    }

    /** User preference: enable JavaScript in the WebView (default on) */
    private val _jsEnabled = MutableStateFlow(prefs.getBoolean(JS_ENABLED_KEY, true))
    val jsEnabled: StateFlow<Boolean> = _jsEnabled.asStateFlow()

    fun setJsEnabled(enabled: Boolean) {
        _jsEnabled.value = enabled
        prefs.edit().putBoolean(JS_ENABLED_KEY, enabled).apply()
    }

    private val _clearCookiesChannel = Channel<Unit>(Channel.CONFLATED)
    val clearCookiesFlow = _clearCookiesChannel.receiveAsFlow()

    fun clearCookies() { _clearCookiesChannel.trySend(Unit) }

    /** User preference: target language for Google Translate (default: English) */
    private val _translateLanguage = MutableStateFlow(prefs.getString(TRANSLATE_LANG_KEY, "en") ?: "en")
    val translateLanguage: StateFlow<String> = _translateLanguage.asStateFlow()

    fun setTranslateLanguage(lang: String) {
        _translateLanguage.value = lang
        prefs.edit().putString(TRANSLATE_LANG_KEY, lang).apply()
    }

    /** User preference: sheet gesture mode ("slide" = drag to open, "tap" = tap handle to toggle) */
    private val _sheetGestureMode = MutableStateFlow(prefs.getString(SHEET_GESTURE_MODE_KEY, "slide") ?: "slide")
    val sheetGestureMode: StateFlow<String> = _sheetGestureMode.asStateFlow()

    fun setSheetGestureMode(mode: String) {
        _sheetGestureMode.value = mode
        prefs.edit().putString(SHEET_GESTURE_MODE_KEY, mode).apply()
    }

    /** Wraps [url] through Google Translate. */
    fun translateUrl(url: String): String =
        "https://translate.google.com/translate?sl=auto&tl=${_translateLanguage.value}&u=${Uri.encode(url)}"

    /** User preference: list of language codes to include (e.g. ["en", "fr"]) */
    private val _preferredLanguages = MutableStateFlow(listOf("en"))
    val preferredLanguages: StateFlow<List<String>> = _preferredLanguages.asStateFlow()

    /** Available categories (starts as hardcoded fallback, replaced by DB data on init) */
    private val _categories = MutableStateFlow(CategoryItem.FALLBACK)
    val categories: StateFlow<List<CategoryItem>> = _categories.asStateFlow()

    /** All subcategories (loaded on init, filtered in UI by categoryId) */
    private val _subcategories = MutableStateFlow<List<SubcategoryItem>>(emptyList())
    val subcategories: StateFlow<List<SubcategoryItem>> = _subcategories.asStateFlow()

    // ── Focus Mode ────────────────────────────────────────────────────────────
    // Ephemeral — resets to off on every app launch. No SharedPreferences.

    private val _focusModeEnabled = MutableStateFlow(false)
    val focusModeEnabled: StateFlow<Boolean> = _focusModeEnabled.asStateFlow()

    private val _focusCategoryId = MutableStateFlow<String?>(null)
    val focusCategoryId: StateFlow<String?> = _focusCategoryId.asStateFlow()

    private val _focusSubcategoryId = MutableStateFlow<String?>(null)
    val focusSubcategoryId: StateFlow<String?> = _focusSubcategoryId.asStateFlow()

    fun setFocusMode(enabled: Boolean) {
        _focusModeEnabled.value = enabled
        if (!enabled) {
            _focusCategoryId.value = null
            _focusSubcategoryId.value = null
        }
        prefetchJob?.cancel()
        viewModelScope.launch { prefetchMutex.withLock { hotQueue.clear(); warmQueue.clear() } }
        if (enabled && _focusCategoryId.value != null) startPrefillQueue()
    }

    fun setFocusCategory(categoryId: String?) {
        _focusCategoryId.value = categoryId
        _focusSubcategoryId.value = null  // reset subcategory when category changes
        if (_focusModeEnabled.value) {
            prefetchJob?.cancel()
            viewModelScope.launch { prefetchMutex.withLock { hotQueue.clear(); warmQueue.clear() } }
            if (categoryId != null) startPrefillQueue()
        }
    }

    fun setFocusSubcategory(subcategoryId: String?) {
        _focusSubcategoryId.value = subcategoryId
        if (_focusModeEnabled.value && _focusCategoryId.value != null) {
            prefetchJob?.cancel()
            viewModelScope.launch { prefetchMutex.withLock { hotQueue.clear(); warmQueue.clear() } }
            startPrefillQueue()
        }
    }

    // ── Prefetch queues ───────────────────────────────────────────────────────
    // Hot queue  (HOT_TARGET = 3): HEAD-validated URLs served instantly on tap.
    // Warm queue (WARM_TARGET = 5): fetched from the API but not yet validated.

    private val HOT_TARGET  = 3
    private val WARM_TARGET = 5
    private val hotQueue    = ArrayDeque<RoamUrl>()
    private val warmQueue   = ArrayDeque<RoamUrl>()
    private val prefetchMutex = Mutex()
    private var prefetchJob: Job? = null

    /** Current user's profile */
    private val _profile = MutableStateFlow<UserProfile?>(null)
    val profile: StateFlow<UserProfile?> = _profile.asStateFlow()

    /** IDs of categories the user has selected (whole-category, no subcategory filter) */
    private val _userCategoryIds = MutableStateFlow<Set<String>>(emptySet())
    val userCategoryIds: StateFlow<Set<String>> = _userCategoryIds.asStateFlow()

    /** IDs of subcategories the user has selected when in topic mode */
    private val _userTopicIds = MutableStateFlow<Set<String>>(emptySet())
    val userTopicIds: StateFlow<Set<String>> = _userTopicIds.asStateFlow()

    /** Whether the user is in 'pillars' (whole category) or 'topics' (specific subcategory) mode */
    private val _interestMode = MutableStateFlow("pillars")
    val interestMode: StateFlow<String> = _interestMode.asStateFlow()

    /** True when local interest state has unsaved changes */
    private val _interestsDirty = MutableStateFlow(false)
    val interestsDirty: StateFlow<Boolean> = _interestsDirty.asStateFlow()

    /** True while interests are being saved to the server */
    private val _interestsSaving = MutableStateFlow(false)
    val interestsSaving: StateFlow<Boolean> = _interestsSaving.asStateFlow()

    /** Counts of pages roamed and submitted by the current user */
    private val _profileStats = MutableStateFlow(ProfileStats())
    val profileStats: StateFlow<ProfileStats> = _profileStats.asStateFlow()

    /** Debounce job for profile auto-save */
    private var profileSaveJob: Job? = null

    /** Cancels the previous roam() coroutine when a new one starts, preventing
     *  concurrent API calls from racing and overwriting each other's results. */
    private var roamJob: Job? = null

    // ── Connectivity + offline queue (14.9) ───────────────────────────────────

    /** True when the device has an active internet connection */
    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    /** Ratings that failed to send because the device was offline */
    private data class PendingRating(val urlId: String, val value: Int)
    private val pendingRatingsMutex = Mutex()
    private val pendingRatings = ArrayDeque<PendingRating>()

    init {
        viewModelScope.launch {
            runCatching { repo.getCategories() }
                .onSuccess { if (it.isNotEmpty()) _categories.value = it }
        }
        viewModelScope.launch {
            runCatching { repo.getSubcategories() }
                .onSuccess { if (it.isNotEmpty()) _subcategories.value = it }
        }
        viewModelScope.launch {
            runCatching {
                val settings = repo.getUserSettings()
                _skipPaywalled.value = settings.skipPaywalled
                _preferredLanguages.value = settings.preferredLanguages.ifEmpty { listOf("en") }
                _discoveryMode.value = settings.discoveryMode.ifEmpty { "discovery" }
            }
        }
        // Prime the prefetch queue so first roam() is instant.
        // Start unconditionally — the loop's own session guard (delay 500ms + continue)
        // handles the case where supabase-kt hasn't restored the session yet. This lets
        // prefetching begin during onboarding so the queue is ready the moment MainScreen
        // appears (fixes fresh-install slow first load).
        startPrefillQueue()

        // Sync saved-for-later list from the server so saves from the web app
        // and other devices are visible without a reinstall.
        if (repo.hasSession()) {
            viewModelScope.launch {
                runCatching {
                    val serverUrls = repo.getSavedUrls()
                    if (serverUrls.isNotEmpty()) {
                        val local = _savedUrls.value
                        // Server is source of truth; merge so locally-saved items that
                        // haven't been pushed yet (e.g. offline saves) are preserved.
                        val merged = (serverUrls + local).distinctBy { it.url }
                        _savedUrls.value = merged
                        persistSavedUrls(merged)
                    }
                }
            }
        }

        // Observe connectivity; flush queued ratings when back online (14.9)
        viewModelScope.launch {
            connectivityFlow(application).collect { online ->
                _isOnline.value = online
                if (online) {
                    flushPendingRatings()
                    // If a roam failed while offline, auto-retry now that we're back online
                    // so the status bar clears the error instead of staying stuck.
                    if (_state.value is RoamState.Error) roam()
                }
            }
        }
    }

    fun roam(excludeDomain: String? = null) {
        // Default to excluding the current domain so the bottom-bar Roam button
        // behaves the same as Thumbs Down / Report Broken Link — otherwise the
        // API may return another dead URL from the same domain.
        val effectiveExclude = excludeDomain ?: extractDomain(_rawUrl.value)

        roamJob?.cancel()
        prefetchJob?.cancel()  // Stop prefetch while user is roaming
        roamJob = viewModelScope.launch {
            // Pop from the hot queue for an instant transition, skipping any entry from
            // the excluded domain or matching the current URL (avoids re-serving the same
            // page after a thumbs-down when the prefetch queue was built before the skip).
            val prefetched = prefetchMutex.withLock {
                var result: RoamUrl? = null
                while (hotQueue.isNotEmpty()) {
                    val candidate = hotQueue.removeFirst()
                    val sameDomain = effectiveExclude != null &&
                        extractDomain(candidate.url) == effectiveExclude
                    val sameUrl = candidate.url == _rawUrl.value
                    if (!sameDomain && !sameUrl) {
                        result = candidate
                        break
                    }
                }
                result
            }
            if (prefetched != null) {
                _rawUrl.value = prefetched.url
                _currentUrl.value = prefetched.url
                _autoTranslate.value = false
                _state.value = RoamState.Loaded(prefetched)
                startPrefillQueue(excludeDomain = extractDomain(prefetched.url))
                return@launch
            }

            _state.value = RoamState.Loading
            var lastException: Throwable? = null
            var result: RoamUrl? = null
            var success = false
            try {
                withTimeout(15_000) {  // 15 second total timeout for all retries
                    // Retry up to 3 times with increasing delays to handle transient auth/network issues
                    for (attempt in 0 until 3) {
                        if (attempt > 0) delay(500L * attempt)
                        val outcome = runCatching {
                    repo.roam(
                        collectionId = _activeCollectionId.value,
                        excludeDomain = effectiveExclude,
                        categoryId = if (_focusModeEnabled.value) _focusCategoryId.value else null,
                        subcategoryId = if (_focusModeEnabled.value) _focusSubcategoryId.value else null,
                    )
                }
                if (outcome.isSuccess) {
                    result = outcome.getOrNull()
                    success = true
                    break
                }
                lastException = outcome.exceptionOrNull()
                // Don't retry offline errors — they won't resolve with retries
                if (lastException != null && isOfflineError(lastException!!)) break
                // UnauthorizedRestException: repository already attempted one session refresh.
                // A second attempt won't help; break early so we don't burn retry budget.
                        if (lastException is UnauthorizedRestException) break
                        // IllegalStateException: no refresh token — session is gone entirely.
                        if (lastException is IllegalStateException) break
                    }
                }
            } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
                lastException = e
                success = false
            }

            if (success) {
                if (result == null) {
                    _state.value = RoamState.Exhausted
                } else {
                    _rawUrl.value = result.url
                    _currentUrl.value = result.url
                    _autoTranslate.value = false
                    _state.value = RoamState.Loaded(result)
                    startPrefillQueue(excludeDomain = extractDomain(result.url))
                }
            } else {
                val e = lastException ?: Exception("Unknown error")
                val isOffline = isOfflineError(e)
                val isTimeout = e.javaClass.name.contains("Timeout", ignoreCase = true)
                    || e.message?.contains("timed out", ignoreCase = true) == true
                val msg = when {
                    isTimeout -> "Request timed out. Please try again."
                    e is UnauthorizedRestException -> "Session expired. Please sign in again."
                    e is IllegalStateException -> "Session expired. Please sign in again."
                    isOffline -> "You appear to be offline. Please check your connection."
                    else -> e.message ?: "Something went wrong. Please try again."
                }
                _state.value = RoamState.Error(msg)
                // Don't forward our own server-side error messages to Sentry — they are already
                // logged by the edge function's console.error and captured server-side.
                // IllegalStateException (no refresh token) is also not worth capturing — it just
                // means the user's session has fully expired; sign-in will recover it.
                val isKnownServerMessage = e.message == "Discovery failed. Please try again."
                    || e.message == "Discovery timed out. Please try again."
                // UnauthorizedRestException: repo already attempted a refresh — if it still
                // fails here the session is gone (no refresh token). Not a bug, just sign-in needed.
                // IllegalStateException: no refresh token at all — same outcome.
                val isExpiredSession = e is UnauthorizedRestException || e is IllegalStateException
                if (!isKnownServerMessage && !isExpiredSession && !isOffline) {
                    Sentry.captureException(e)
                }
            }
        }
    }

    /**
     * Cancels any running fill job and starts a fresh one.
     *
     * Phase 1 — warm fill: fetch URLs from the API (no HEAD check) until the warm
     *   queue reaches [WARM_TARGET]. Fast — just network calls to our own edge function.
     *
     * Phase 2 — hot promotion: pull from the front of warm, HEAD-check the URL,
     *   and move it to the hot queue until hot reaches [HOT_TARGET].
     *
     * Both phases run concurrently inside the same coroutine so warm keeps filling
     * while hot is being topped up.
     */
    private fun startPrefillQueue(excludeDomain: String? = null) {
        prefetchJob?.cancel()
        // Run entirely on IO — OkHttp network calls must not touch the main thread.
        // Running on Main caused foreground & background ANRs (ROAM-ANDROID-D/E/F/G).
        prefetchJob = viewModelScope.launch(Dispatchers.IO) {
            var warmFails = 0
            var hotFails  = 0

            while (true) {
                // Wait for a valid session before hitting the edge function.
                // supabase-kt restores the persisted session asynchronously after
                // app start; calling functions.invoke() before restoration sends
                // the anon key as Bearer, causing UNAUTHORIZED_INVALID_JWT_FORMAT (ROAM-ANDROID-5).
                if (!repo.hasSession()) {
                    delay(500)
                    continue
                }

                val (hotSize, warmSize) = prefetchMutex.withLock { hotQueue.size to warmQueue.size }

                val hotDone  = hotSize  >= HOT_TARGET
                val warmDone = warmSize >= WARM_TARGET

                if (hotDone && warmDone) break
                if (warmFails >= 8 && warmSize == 0) break   // server returning nothing

                // Phase 1: keep warm topped up (cheap — no HEAD check)
                // Skip the inter-call delay on the very first fetch (when both queues are
                // empty) so the queue starts filling without added latency on cold start.
                // After that, pace calls to avoid hammering the edge function (ROAM-ANDROID-4).
                if (!warmDone && warmFails < 8) {
                    if (warmSize > 0 || hotSize > 0) delay(300)
                    val candidate = runCatching {
                        repo.roam(
                            collectionId  = _activeCollectionId.value,
                            excludeDomain = excludeDomain,
                            categoryId = if (_focusModeEnabled.value) _focusCategoryId.value else null,
                            subcategoryId = if (_focusModeEnabled.value) _focusSubcategoryId.value else null,
                        )
                    }.getOrNull()

                    if (candidate == null) {
                        warmFails++
                    } else {
                        prefetchMutex.withLock {
                            if (warmQueue.size < WARM_TARGET) warmQueue.addLast(candidate)
                        }
                        warmFails = 0
                    }
                }

                // Phase 2: promote warm → hot (HEAD-validate one entry per loop tick)
                if (!hotDone) {
                    val next = prefetchMutex.withLock {
                        if (warmQueue.isNotEmpty()) warmQueue.removeFirst() else null
                    }
                    if (next != null) {
                        if (isUrlReachable(next.url)) {
                            prefetchMutex.withLock {
                                if (hotQueue.size < HOT_TARGET) hotQueue.addLast(next)
                            }
                            hotFails = 0
                        } else {
                            hotFails++
                        }
                    }
                }
            }
        }
    }

    /** HEAD-checks [url] with a short timeout. Returns false on any error or 4xx/5xx. */
    private suspend fun isUrlReachable(url: String): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.requestMethod = "HEAD"
            conn.connectTimeout = 2_000
            conn.readTimeout = 2_000
            conn.instanceFollowRedirects = true
            conn.setRequestProperty("User-Agent", "Mozilla/5.0")
            val code = conn.responseCode
            conn.disconnect()
            code < 400
        }.getOrDefault(false)
    }

    fun thumbsUp(context: Context) {
        val loaded = _state.value as? RoamState.Loaded ?: run {
            // Unknown page — show submit sheet
            _showSubmitSheet.value = true
            return
        }
        viewModelScope.launch {
            haptic(context)
            val result = runCatching { repo.rate(loaded.roamUrl.id, 1) }
            if (result.isFailure) {
                val err = result.exceptionOrNull()
                // Queue for retry if offline; report unexpected errors.
                // Use isOfflineError() — Ktor's HttpRequestException wraps IOException
                // in the cause chain and does not itself extend IOException.
                if (err != null && isOfflineError(err)) {
                    pendingRatingsMutex.withLock {
                        pendingRatings.addLast(PendingRating(loaded.roamUrl.id, 1))
                    }
                } else {
                    err?.let { Sentry.captureException(it) }
                }
            }
            // Thumbs up just records the rating — no navigation, user may still be reading
        }
    }

    fun thumbsDown(context: Context) {
        val loaded = _state.value as? RoamState.Loaded
        viewModelScope.launch {
            haptic(context)
            if (loaded != null) {
                val result = runCatching { repo.rate(loaded.roamUrl.id, -1) }
                if (result.isFailure) {
                    val err = result.exceptionOrNull()
                    if (err != null && isOfflineError(err)) {
                        pendingRatingsMutex.withLock {
                            pendingRatings.addLast(PendingRating(loaded.roamUrl.id, -1))
                        }
                    } else {
                        err?.let { Sentry.captureException(it) }
                    }
                }
            }
            roam(excludeDomain = extractDomain(_rawUrl.value))
        }
    }

    fun submitUrl(url: String, categoryId: String, subcategoryId: String? = null) {
        viewModelScope.launch {
            val result = runCatching { repo.submitUrl(url, categoryId, subcategoryId) }
            _showSubmitSheet.value = false
            result.fold(
                onSuccess = { outcome ->
                    _submitToast.value = when (outcome) {
                        is app.roam.android.data.repository.SubmitResult.Queued -> outcome.message
                        is app.roam.android.data.repository.SubmitResult.Duplicate -> outcome.message
                        is app.roam.android.data.repository.SubmitResult.Failed -> {
                            Sentry.captureMessage("submit-url failed: ${outcome.message}")
                            "Couldn't submit: ${outcome.message}"
                        }
                    }
                },
                onFailure = { err ->
                    Sentry.captureException(err)
                    _submitToast.value = "Couldn't submit: ${err.message ?: "unknown error"}"
                },
            )
        }
        viewModelScope.launch {
            delay(4000)
            _submitToast.value = null
        }
    }

    fun setSkipPaywalled(value: Boolean) {
        _skipPaywalled.value = value
        viewModelScope.launch {
            runCatching { repo.upsertUserSettings(skipPaywalled = value) }
        }
    }

    fun setPreferredLanguages(langs: List<String>) {
        val final = langs.ifEmpty { listOf("en") }
        _preferredLanguages.value = final
        viewModelScope.launch {
            runCatching { repo.upsertUserSettings(preferredLanguages = final) }
        }
    }

    fun setDiscoveryMode(mode: String) {
        _discoveryMode.value = mode
        viewModelScope.launch {
            runCatching { repo.upsertUserSettings(discoveryMode = mode) }
        }
    }

    fun setCollectionFilter(collectionId: String?) {
        _activeCollectionId.value = collectionId
        prefetchJob?.cancel()
        viewModelScope.launch { prefetchMutex.withLock { hotQueue.clear(); warmQueue.clear() } }
        startPrefillQueue()
    }

    fun openSubmitSheet() { _showSubmitSheet.value = true }
    fun closeSubmitSheet() { _showSubmitSheet.value = false }
    fun openConfigSheet() { _showConfigSheet.value = true }
    fun closeConfigSheet() { _showConfigSheet.value = false }

    /** Called by the WebView when the user navigates to a page not in the discovery pool */
    fun onWebViewUrlChanged(url: String) {
        _currentUrl.value = url
    }

    private fun haptic(context: Context) {
        val vibrator = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        vibrator.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    fun saveForLater() {
        val url = _rawUrl.value ?: return
        val title = ((_state.value as? RoamState.Loaded)?.roamUrl?.title ?: url)
            .take(200)  // Guard against huge titles
        val urlId = (_state.value as? RoamState.Loaded)?.roamUrl?.id
        val entry = SavedUrl(url = url, title = title)
        val current = _savedUrls.value
        if (current.none { it.url == url }) {
            val updated = listOf(entry) + current   // Newest first
            _savedUrls.value = updated
            persistSavedUrls(updated)
        }
        // Sync to server in the background (fire-and-forget)
        viewModelScope.launch {
            runCatching { repo.saveUrl(url, title, urlId) }
        }
        _savedConfirmation.value = true
        viewModelScope.launch {
            kotlinx.coroutines.delay(2000)
            _savedConfirmation.value = false
        }
    }

    fun removeSavedUrl(url: String) {
        val updated = _savedUrls.value.filter { it.url != url }
        _savedUrls.value = updated
        persistSavedUrls(updated)
        viewModelScope.launch {
            runCatching { repo.unsaveUrl(url) }
        }
    }

    fun reportBrokenLink() {
        val loaded = _state.value as? RoamState.Loaded ?: return
        val urlId = loaded.roamUrl.id
        _showConfigSheet.value = false
        _reportConfirmation.value = true
        viewModelScope.launch {
            runCatching { repo.reportUrl(urlId) }
            roam(excludeDomain = extractDomain(_rawUrl.value))
            kotlinx.coroutines.delay(2000)
            _reportConfirmation.value = false
        }
    }

    fun sendFeedback(message: String, email: String?, onResult: (success: Boolean) -> Unit) {
        viewModelScope.launch {
            val result = runCatching { repo.sendFeedback(message, email) }
            onResult(result.isSuccess)
        }
    }

    fun openAddToCollection() {
        viewModelScope.launch {
            runCatching { _collections.value = repo.getCollections() }
        }
        _showAddToCollection.value = true
    }
    fun closeAddToCollection() { _showAddToCollection.value = false }

    fun loadCollections() {
        viewModelScope.launch {
            runCatching { _collections.value = repo.getCollections() }
        }
    }

    /** Opens a collection detail view — loads its URLs. */
    fun openCollection(collection: Collection) {
        _selectedCollection.value = collection
        _collectionItems.value = emptyList()
        _collectionItemsLoading.value = true
        viewModelScope.launch {
            runCatching { _collectionItems.value = repo.getCollectionItems(collection.id) }
            _collectionItemsLoading.value = false
        }
    }

    /** Returns from the collection detail view to the collection list. */
    fun closeCollection() {
        _selectedCollection.value = null
        _collectionItems.value = emptyList()
        _collectionItemsLoading.value = false
    }

    /**
     * Navigates the WebView directly to [url] without going through the discovery queue.
     * Useful for opening internal web pages (e.g. profile/collections management).
     */
    fun navigateTo(url: String) {
        _rawUrl.value = url
        _currentUrl.value = url
        _state.value = RoamState.Loaded(RoamUrl(id = "", url = url))
    }

    /**
     * Looks up each URL in [urls] in the database, then adds each found entry
     * to the given collection.
     */
    fun addSavedUrlsToCollection(collectionId: String, urls: List<String>) {
        viewModelScope.launch {
            urls.forEach { url ->
                runCatching {
                    val roamUrl = repo.checkUrl(url)
                    if (roamUrl != null) repo.addUrlToCollection(collectionId, roamUrl.id)
                }
            }
            // Refresh counts so the collections list shows the updated tally immediately.
            runCatching { _collections.value = repo.getCollections() }
        }
    }

    /**
     * Creates a new collection then adds all [urls] to it.
     */
    fun createCollectionAndAddSaved(name: String, urls: List<String>) {
        viewModelScope.launch {
            val createResult = runCatching {
                val col = repo.createCollection(name)
                urls.forEach { url ->
                    runCatching {
                        val roamUrl = repo.checkUrl(url)
                        if (roamUrl != null) repo.addUrlToCollection(col.id, roamUrl.id)
                    }
                }
            }
            createResult.onFailure { e ->
                Sentry.captureException(e)
                showTransientToast("Couldn't create collection: ${e.message ?: "unknown error"}")
            }
            // Reload so item_count and sort order are accurate after creation + inserts.
            runCatching { _collections.value = repo.getCollections() }
        }
    }

    fun addCurrentUrlToCollection(collectionId: String) {
        val loaded = _state.value as? RoamState.Loaded ?: return
        viewModelScope.launch {
            runCatching { repo.addUrlToCollection(collectionId, loaded.roamUrl.id) }
            runCatching { _collections.value = repo.getCollections() }
            _showAddToCollection.value = false
            closeConfigSheet()
        }
    }

    fun createCollectionAndAdd(name: String) {
        val loaded = _state.value as? RoamState.Loaded
        viewModelScope.launch {
            val result = runCatching {
                val col = repo.createCollection(name)
                if (loaded != null) repo.addUrlToCollection(col.id, loaded.roamUrl.id)
            }
            result.onFailure { e ->
                Sentry.captureException(e)
                showTransientToast("Couldn't create collection: ${e.message ?: "unknown error"}")
            }
            runCatching { _collections.value = repo.getCollections() }
            _showAddToCollection.value = false
            closeConfigSheet()
        }
    }

    fun renameCollection(collectionId: String, name: String) {
        viewModelScope.launch {
            val result = runCatching { repo.renameCollection(collectionId, name) }
            result.onFailure { e ->
                Sentry.captureException(e)
                showTransientToast("Couldn't rename: ${e.message ?: "unknown error"}")
            }
            runCatching { _collections.value = repo.getCollections() }
        }
    }

    fun deleteCollection(collectionId: String) {
        // Clear the active filter if the deleted collection was selected.
        if (_activeCollectionId.value == collectionId) setCollectionFilter(null)
        // Optimistic removal so the UI updates instantly.
        val previous = _collections.value
        _collections.value = previous.filter { it.id != collectionId }
        viewModelScope.launch {
            val result = runCatching { repo.deleteCollection(collectionId) }
            result.onFailure { e ->
                Sentry.captureException(e)
                _collections.value = previous  // Roll back optimistic removal
                showTransientToast("Couldn't delete: ${e.message ?: "unknown error"}")
            }
        }
    }

    /** Shows a 4-second toast via the existing submitToast flow. */
    private fun showTransientToast(message: String) {
        _submitToast.value = message
        viewModelScope.launch {
            delay(4000)
            if (_submitToast.value == message) _submitToast.value = null
        }
    }

    fun roamWithinCategory() {
        val loaded = _state.value as? RoamState.Loaded
        val categoryId = loaded?.roamUrl?.categoryId
        _activeCollectionId.value = null
        prefetchJob?.cancel()
        viewModelScope.launch { prefetchMutex.withLock { hotQueue.clear(); warmQueue.clear() } }
        _showConfigSheet.value = false
        viewModelScope.launch {
            _state.value = RoamState.Loading
            runCatching {
                repo.roam(
                    collectionId = null,
                    excludeDomain = extractDomain(_rawUrl.value),
                    categoryId = categoryId,
                )
            }.onSuccess { result ->
                if (result == null) _state.value = RoamState.Exhausted
                else {
                    _rawUrl.value = result.url
                    _currentUrl.value = result.url
                    _autoTranslate.value = false
                    _state.value = RoamState.Loaded(result)
                }
            }.onFailure { e ->
                _state.value = RoamState.Error(e.message ?: "Something went wrong. Please try again.")
            }
        }
    }

    fun roamCollection(collectionId: String) {
        setCollectionFilter(collectionId)
        _showConfigSheet.value = false
        roam()
    }

    // ── Profile (14.6) ────────────────────────────────────────────────────────

    /** Loads profile, user categories, and stats in parallel. */
    fun loadProfile() {
        viewModelScope.launch {
            runCatching { _profile.value = repo.getProfile() }
        }
        viewModelScope.launch {
            runCatching {
                val topicIds = repo.getUserTopicIds()
                if (topicIds.isNotEmpty()) {
                    _userTopicIds.value = topicIds
                    _interestMode.value = "topics"
                } else {
                    _userCategoryIds.value = repo.getUserCategoryIds()
                    _interestMode.value = "pillars"
                }
            }
        }
        viewModelScope.launch {
            runCatching {
                val (roamed, submitted) = repo.getProfileStats()
                _profileStats.value = ProfileStats(roamed = roamed, submitted = submitted)
            }
        }
    }

    /**
     * Called on every keystroke in the profile edit fields.
     * Debounces 800 ms then persists to Supabase.
     */
    fun onProfileFieldChanged(username: String, displayName: String, bio: String?) {
        _profile.value = _profile.value?.copy(
            username = username,
            displayName = displayName,
            bio = bio,
        )
        profileSaveJob?.cancel()
        profileSaveJob = viewModelScope.launch {
            delay(800)
            runCatching { repo.updateProfile(username, displayName, bio) }
        }
    }

    /** Optimistically toggles a pillar category, then syncs to Supabase. */
    fun toggleCategory(categoryId: String, selected: Boolean) {
        _userCategoryIds.value = if (selected) {
            _userCategoryIds.value + categoryId
        } else {
            _userCategoryIds.value - categoryId
        }
        _interestsDirty.value = true
        viewModelScope.launch {
            runCatching { repo.setUserCategory(categoryId, selected) }
        }
    }

    /** Toggles a topic (subcategory) selection in topic mode. Does not auto-save. */
    fun toggleTopic(subcategoryId: String, selected: Boolean) {
        _userTopicIds.value = if (selected) {
            _userTopicIds.value + subcategoryId
        } else {
            _userTopicIds.value - subcategoryId
        }
        _interestsDirty.value = true
    }

    /** Switches between pillar and topic modes, clearing the other mode's selection. */
    fun setInterestMode(mode: String) {
        _interestMode.value = mode
        if (mode == "topics") _userCategoryIds.value = emptySet()
        else _userTopicIds.value = emptySet()
        _interestsDirty.value = true
    }

    /** Saves current pillar or topic selections to Supabase. */
    fun saveInterests() {
        val mode = _interestMode.value
        val pillars = _userCategoryIds.value
        val topics = _userTopicIds.value
        val subcats = _subcategories.value
        if (mode == "pillars" && pillars.isEmpty()) return
        if (mode == "topics" && topics.isEmpty()) return
        _interestsSaving.value = true
        viewModelScope.launch {
            runCatching {
                val parentMap = subcats.associate { it.id to it.categoryId }
                repo.saveUserInterests(pillars, topics, parentMap)
                _interestsDirty.value = false
            }
            _interestsSaving.value = false
        }
    }

    // ── Pending ratings flush (14.9) ──────────────────────────────────────────

    private fun flushPendingRatings() {
        viewModelScope.launch {
            pendingRatingsMutex.withLock {
                if (pendingRatings.isEmpty()) return@withLock
                val snapshot = pendingRatings.toList()
                pendingRatings.clear()
                snapshot.forEach { pending ->
                    runCatching { repo.rate(pending.urlId, pending.value) }
                        .onFailure { e ->
                            // Re-queue only if still offline; drop other errors
                            if (isOfflineError(e)) pendingRatings.addLast(pending)
                            else Sentry.captureException(e)
                        }
                }
            }
        }
    }

    // ── Local persistence ─────────────────────────────────────────────────────

    private val savedUrlsJson = Json { ignoreUnknownKeys = true }

    private fun loadSavedUrls(): List<SavedUrl> {
        val raw = prefs.getString(SAVED_KEY, null) ?: return emptyList()
        return runCatching { savedUrlsJson.decodeFromString<List<SavedUrl>>(raw) }
            .getOrDefault(emptyList())
    }

    private fun persistSavedUrls(list: List<SavedUrl>) {
        prefs.edit().putString(SAVED_KEY, savedUrlsJson.encodeToString(list)).apply()
    }

    private fun extractDomain(url: String?): String? {
        url ?: return null
        return runCatching {
            android.net.Uri.parse(url).host?.removePrefix("www.")
        }.getOrNull()
    }

    /**
     * Returns true if [e] or any exception in its cause chain is an [IOException].
     * Ktor wraps [java.net.UnknownHostException] (DNS failure / no network) inside
     * its own HttpRequestException, which does not itself extend IOException, so a
     * plain `e is IOException` check misses these offline errors.
     */
    private fun isOfflineError(e: Throwable): Boolean {
        var t: Throwable? = e
        while (t != null) {
            if (t is IOException) return true
            t = t.cause
        }
        return false
    }
}

