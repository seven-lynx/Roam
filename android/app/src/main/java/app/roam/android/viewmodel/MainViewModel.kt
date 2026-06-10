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
import app.roam.android.model.UrlHistoryEntry
import app.roam.android.model.deserializeHistory
import app.roam.android.model.serializeHistory
import app.roam.android.model.AppNotification
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
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
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
    private val PREFETCH_WEBVIEW_KEY  = "prefetch_webview"
    private val NOTIFICATIONS_ENABLED_KEY = "notifications_enabled"
    private val URL_HISTORY_KEY = "url_history"
    private val MAX_HISTORY_ENTRIES = 100

    private val _state = MutableStateFlow<RoamState>(RoamState.Idle)
    val state: StateFlow<RoamState> = _state.asStateFlow()

    private val _savedUrls = MutableStateFlow<List<SavedUrl>>(loadSavedUrls())
    val savedUrls: StateFlow<List<SavedUrl>> = _savedUrls.asStateFlow()

    private val _urlHistory = MutableStateFlow<List<UrlHistoryEntry>>(loadUrlHistory())
    val urlHistory: StateFlow<List<UrlHistoryEntry>> = _urlHistory.asStateFlow()

    /** True while a save-for-later confirmation should be visible */
    private val _savedConfirmation = MutableStateFlow(false)
    val savedConfirmation: StateFlow<Boolean> = _savedConfirmation.asStateFlow()

    /** True while a dead-link report confirmation should be visible */
    private val _reportConfirmation = MutableStateFlow(false)
    val reportConfirmation: StateFlow<Boolean> = _reportConfirmation.asStateFlow()

    /** One-shot message shown after a submit-url attempt (null = nothing to show) */
    private val _submitToast = MutableStateFlow<String?>(null)
    val submitToast: StateFlow<String?> = _submitToast.asStateFlow()

    /** True when the user has thumbs-upped the current page */
    private val _hasRatedUp = MutableStateFlow(false)
    val hasRatedUp: StateFlow<Boolean> = _hasRatedUp.asStateFlow()

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

    /** User preference: render web pages in dark mode */
    private val _webDarkMode = MutableStateFlow(prefs.getBoolean(WEB_DARK_KEY, true))
    val webDarkMode: StateFlow<Boolean> = _webDarkMode.asStateFlow()

    fun setWebDarkMode(enabled: Boolean) {
        _webDarkMode.value = enabled
        prefs.edit().putBoolean(WEB_DARK_KEY, enabled).apply()
    }

    /** True while the current URL is wrapped through Google Translate. */
    val isTranslated: Boolean
        get() = _currentUrl.value?.startsWith("https://translate.google.com/translate?") == true

    /** Toggles between the raw (discovery) URL and the Google Translate wrapper. */
    fun toggleTranslation() {
        val raw = _rawUrl.value ?: return
        _currentUrl.value = if (isTranslated) raw else translateUrl(raw)
    }

    /** Translates the current page to [targetLang]. Uses the persisted preference. */
    fun translateTo(targetLang: String = _translateLanguage.value) {
        val raw = _rawUrl.value ?: return
        // Persist the language choice so future toggles use the same language
        _translateLanguage.value = targetLang
        prefs.edit().putString(TRANSLATE_LANG_KEY, targetLang).apply()
        _currentUrl.value = translateUrl(raw)
    }

    /** User preference: enable JavaScript in the WebView (default on) */
    private val _jsEnabled = MutableStateFlow(prefs.getBoolean(JS_ENABLED_KEY, true))
    val jsEnabled: StateFlow<Boolean> = _jsEnabled.asStateFlow()

    fun setJsEnabled(enabled: Boolean) {
        _jsEnabled.value = enabled
        prefs.edit().putBoolean(JS_ENABLED_KEY, enabled).apply()
    }

    /** User preference: load the next queued URL in a background WebView to warm the cache */
    private val _prefetchWebView = MutableStateFlow(prefs.getBoolean(PREFETCH_WEBVIEW_KEY, false))
    val prefetchWebView: StateFlow<Boolean> = _prefetchWebView.asStateFlow()

    fun setPrefetchWebView(enabled: Boolean) {
        _prefetchWebView.value = enabled
        prefs.edit().putBoolean(PREFETCH_WEBVIEW_KEY, enabled).apply()
        if (!enabled) _nextPrefetchUrl.value = null
    }

    /** The next URL in the hot queue, exposed so the UI can warm-load it in a background WebView */
    private val _nextPrefetchUrl = MutableStateFlow<String?>(null)
    val nextPrefetchUrl: StateFlow<String?> = _nextPrefetchUrl.asStateFlow()

    private val _clearCookiesChannel = Channel<Unit>(Channel.CONFLATED)
    val clearCookiesFlow = _clearCookiesChannel.receiveAsFlow()

    fun clearCookies() { _clearCookiesChannel.trySend(Unit) }

    /** User preference: target language for Google Translate (default: English) */
    private val _translateLanguage = MutableStateFlow(prefs.getString(TRANSLATE_LANG_KEY, "en") ?: "en")
    val translateLanguage: StateFlow<String> = _translateLanguage.asStateFlow()

    fun setTranslateLanguage(lang: String) {
        _translateLanguage.value = lang
        prefs.edit().putString(TRANSLATE_LANG_KEY, lang).apply()
        // If the current page is already translated, re-translate with the new language
        if (isTranslated) {
            val raw = _rawUrl.value ?: return
            _currentUrl.value = translateUrl(raw)
        }
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
    // Hot queue  (HOT_TARGET = 10): HEAD-validated URLs served instantly on tap.
    // Warm queue (WARM_TARGET = 15): fetched from the API but not yet validated.
    // Phase 2 validates URLs concurrently to maximize throughput.

    private val HOT_TARGET  = 12
    private val WARM_TARGET = 15
    private val hotQueue    = ArrayDeque<RoamUrl>()
    private val warmQueue   = ArrayDeque<RoamUrl>()
    private val prefetchMutex = Mutex()
    private var prefetchJob: Job? = null

    /** Current user's profile */
    private val _profile = MutableStateFlow<UserProfile?>(null)
    val profile: StateFlow<UserProfile?> = _profile.asStateFlow()

    /** Whether the user's profile is public */
    private val _profileIsPublic = MutableStateFlow(true)
    val profileIsPublic: StateFlow<Boolean> = _profileIsPublic.asStateFlow()

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

    /** Whether push notifications are enabled */
    private val _notificationsEnabled = MutableStateFlow(prefs.getBoolean(NOTIFICATIONS_ENABLED_KEY, true))
    val notificationsEnabled: StateFlow<Boolean> = _notificationsEnabled.asStateFlow()

    fun setNotificationsEnabled(enabled: Boolean) {
        _notificationsEnabled.value = enabled
        prefs.edit().putBoolean(NOTIFICATIONS_ENABLED_KEY, enabled).apply()
        // Sync push token state with the server so the push-notify edge
        // function knows whether to deliver push messages for this user.
        viewModelScope.launch {
            if (enabled) {
                // Re-register the current FCM token (if we have one stored).
                // FCMService stores the pending token in "roam_fcm" prefs.
                val fcmPrefs = getApplication<android.app.Application>()
                    .getSharedPreferences("roam_fcm", android.content.Context.MODE_PRIVATE)
                val token = fcmPrefs.getString("pending_fcm_token", null)
                if (token != null) {
                    runCatching { repo.registerPushToken(token) }
                }
            } else {
                // Delete all Android push tokens so the edge function stops
                // sending push messages to this user.
                runCatching { repo.unregisterPushTokens() }
            }
        }
    }

    /** Unread notification count */
    private val _unreadNotificationCount = MutableStateFlow(0)
    val unreadNotificationCount: StateFlow<Int> = _unreadNotificationCount.asStateFlow()

    /** List of recent notifications */
    private val _notifications = MutableStateFlow<List<AppNotification>>(emptyList())
    val notifications: StateFlow<List<AppNotification>> = _notifications.asStateFlow()

    /** True while notifications are being fetched */
    private val _notificationsLoading = MutableStateFlow(false)
    val notificationsLoading: StateFlow<Boolean> = _notificationsLoading.asStateFlow()

    /** Toggles profile public/private. */
    fun toggleProfilePublic() {
        val next = !_profileIsPublic.value
        _profileIsPublic.value = next
        viewModelScope.launch {
            runCatching { repo.updateProfilePublic(next) }
                .onFailure {
                    _profileIsPublic.value = !next // revert on failure
                    _profileSaveError.value = "Failed to update visibility"
                }
        }
    }

    /** Debounce job for profile auto-save */
    private var profileSaveJob: Job? = null

    /** Profile save error message (null = no error), surfaced in ProfileScreen */
    private val _profileSaveError = MutableStateFlow<String?>(null)
    val profileSaveError: StateFlow<String?> = _profileSaveError.asStateFlow()

    /** Non-null when interests failed to load, surfaced in ProfileScreen */
    private val _profileInterestsError = MutableStateFlow<String?>(null)
    val profileInterestsError: StateFlow<String?> = _profileInterestsError.asStateFlow()

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
            }
        }
        // Prime the prefetch queue so first roam() is instant.
        // Only start when the user has enabled prefetching — the parallel API calls
        // in the prefill loop consume OkHttp connection slots and starve the main
        // roam() request if they kick off unconditionally.
        if (_prefetchWebView.value) startPrefillQueue()

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
        haptic(getApplication())
        _hasRatedUp.value = false

        // Default to excluding the current domain so the bottom-bar Roam button
        // behaves the same as Thumbs Down / Report Broken Link — otherwise the
        // API may return another dead URL from the same domain.
        val effectiveExclude = excludeDomain ?: extractDomain(_rawUrl.value)

        roamJob?.cancel()
        roamJob = viewModelScope.launch {
            // Try to pop from the hot queue for an instant transition, skipping any entry from
            // the excluded domain or matching the current URL.
            val prefetched = prefetchMutex.withLock {
                var result: RoamUrl? = null
                while (hotQueue.isNotEmpty()) {
                    val candidate = hotQueue.removeFirst()
                    val candDomain = extractDomain(candidate.url)
                    val sameDomain = effectiveExclude != null && candDomain == effectiveExclude
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
                _state.value = RoamState.Loaded(prefetched)
                recordUrlVisit(prefetched.url, prefetched.title ?: prefetched.url)
                // If background WebView preloading is enabled, expose the next hot-queue entry
                // so the UI can start warming it in an invisible WebView right now.
                if (_prefetchWebView.value) {
                    _nextPrefetchUrl.value = prefetchMutex.withLock { hotQueue.firstOrNull()?.url }
                }
                startPrefillQueue(excludeDomain = extractDomain(prefetched.url))
                return@launch
            }

            _state.value = RoamState.Loading
            
            // Wait for session to be fully ready before the network call.
            // If the app just launched, it might take a few hundred ms for the
            // SharedPreferences session to be restored and status to flip to Authenticated.
            var sessionWaitAttempts = 0
            while (!repo.hasSession() && sessionWaitAttempts < 10) {
                delay(100)
                sessionWaitAttempts++
            }

            var lastException: Throwable? = null
            var result: RoamUrl? = null
            var success = false
            // Retry up to 3 times with increasing delays to handle transient auth/network issues.
            // Ktor (SupabaseClient.kt) already enforces a 60s request timeout per attempt.
            for (attempt in 0 until 3) {
                if (attempt > 0) delay(1000L * attempt)
                val outcome = runCatching {
                    repo.roam(
                        collectionId = _activeCollectionId.value,
                        excludeDomain = effectiveExclude,
                        categoryId = if (_focusModeEnabled.value) _focusCategoryId.value else null,
                        subcategoryId = if (_focusModeEnabled.value) _focusSubcategoryId.value else null,
                    )
                }
                // Re-throw CancellationException so coroutine cancellation (e.g. ViewModel cleared)
                // propagates correctly — runCatching swallows it otherwise.
                outcome.exceptionOrNull()?.let {
                    if (it is kotlinx.coroutines.CancellationException) throw it
                }
                if (outcome.isSuccess) {
                    result = outcome.getOrNull()
                    success = true
                    break
                }
                lastException = outcome.exceptionOrNull()
                // Don't retry offline errors — they won't resolve with retries
                if (lastException != null && isOfflineError(lastException)) break
                // IllegalStateException: no refresh token — session is gone entirely.
                if (lastException is IllegalStateException) break
                
                // If we get an UnauthorizedRestException (like "Invalid JWT"),
                // it might be a transient state where the anon key was used as bearer.
                // We'll let it retry.
                if (lastException != null) {
                    android.util.Log.w("MainViewModel", "Roam attempt ${attempt + 1} failed: ${lastException.message}")
                }
            }

            if (success) {
                val roamUrl = result
                if (roamUrl == null) {
                    android.util.Log.i("MainViewModel", "Roam pool exhausted")
                    _state.value = RoamState.Exhausted
                } else {
                    android.util.Log.i("MainViewModel", "Roam success: ${roamUrl.url}")
                    _rawUrl.value = roamUrl.url
                    _currentUrl.value = roamUrl.url
                    _state.value = RoamState.Loaded(roamUrl)
                    recordUrlVisit(roamUrl.url, roamUrl.title ?: roamUrl.url)
                    startPrefillQueue(excludeDomain = extractDomain(roamUrl.url))
                }
            } else {
                val e = lastException ?: Exception("Unknown error")
                val isOffline = isOfflineError(e)
                val isTimeout = e.javaClass.name.contains("Timeout", ignoreCase = true)
                    || e.message?.contains("timed out", ignoreCase = true) == true
                val isDnsError = e.message?.contains("Unable to resolve host", ignoreCase = true) == true
                    || e.message?.contains("No address associated", ignoreCase = true) == true
                    || e.message?.contains("Unknown host", ignoreCase = true) == true
                
                val msg = when {
                    isDnsError -> "Network unreachable. Check WiFi/cellular connection."
                    isTimeout -> "Request timed out. Check your network connection."
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
     * Runs Phase 1 (warm fill) and Phase 2 (hot promotion) concurrently
     * to maximize throughput and responsiveness.
     */
    private fun startPrefillQueue(excludeDomain: String? = null) {
        prefetchJob?.cancel()
        prefetchJob = viewModelScope.launch(Dispatchers.IO) {
            // Wait for session to be fully authenticated before starting prefetch.
            // checking currentUserOrNull isn't enough; we need an active session token
            // for the edge functions to accept the request.
            while (!repo.hasSession()) {
                delay(500)
            }
            
            // Give Supabase a tiny bit more time to propagate the token to all plugins.
            delay(100)

            // Launch concurrent workers for warm filling and hot promotion
            coroutineScope {
                // Phase 1: Warm Fill (parallel fetching from API)
                launch {
                    var warmFails = 0
                    while (true) {
                        val warmSize = prefetchMutex.withLock { warmQueue.size }
                        if (warmSize >= WARM_TARGET) {
                            delay(1000)
                            continue
                        }
                        if (warmFails >= 5) {
                            delay(5000) // Back off on repeated failures
                            warmFails = 0
                            continue
                        }

                        // Fetch candidates. Use a batch size of 2 to leave OkHttp connection
                        // slots available for the main roam() request and other API calls.
                        val batchSize = minOf(2, WARM_TARGET - warmSize)
                        val candidates = (1..batchSize).map {
                            async {
                                runCatching {
                                    repo.roam(
                                        collectionId = _activeCollectionId.value,
                                        excludeDomain = excludeDomain,
                                        categoryId = if (_focusModeEnabled.value) _focusCategoryId.value else null,
                                        subcategoryId = if (_focusModeEnabled.value) _focusSubcategoryId.value else null,
                                    )
                                }.getOrNull()
                            }
                        }.awaitAll().filterNotNull()

                        if (candidates.isEmpty()) {
                            warmFails++
                            delay(1000)
                        } else {
                            warmFails = 0
                            prefetchMutex.withLock {
                                candidates.forEach { candidate ->
                                    val domain = extractDomain(candidate.url)
                                    val domainAlreadyQueued = domain != null && (
                                        warmQueue.any { extractDomain(it.url) == domain } ||
                                        hotQueue.any { extractDomain(it.url) == domain }
                                    )
                                    if (!domainAlreadyQueued && warmQueue.size < WARM_TARGET) {
                                        warmQueue.addLast(candidate)
                                    }
                                }
                            }
                            delay(500) // Pace to avoid hammering
                        }
                    }
                }

                // Phase 2: Hot Promotion (parallel validation)
                launch {
                    var hotFails = 0
                    while (true) {
                        val (hotSize, warmSize) = prefetchMutex.withLock { hotQueue.size to warmQueue.size }
                        if (hotSize >= HOT_TARGET) {
                            delay(1000)
                            continue
                        }
                        if (warmSize == 0) {
                            delay(500)
                            continue
                        }

                        // Pull a batch from warm to validate
                        val batch = prefetchMutex.withLock {
                            val size = minOf(4, warmQueue.size, HOT_TARGET - hotQueue.size)
                            (1..size).mapNotNull { if (warmQueue.isNotEmpty()) warmQueue.removeFirst() else null }
                        }

                        if (batch.isNotEmpty()) {
                            val validationResults = batch.map { url ->
                                async { url to isUrlReachable(url.url) }
                            }.awaitAll()

                            prefetchMutex.withLock {
                                var successCount = 0
                                validationResults.forEach { (url, isReachable) ->
                                    val domain = extractDomain(url.url)
                                    val domainInHot = domain != null && hotQueue.any { extractDomain(it.url) == domain }
                                    if (isReachable && !domainInHot && hotQueue.size < HOT_TARGET) {
                                        hotQueue.addLast(url)
                                        successCount++
                                    }
                                }
                                hotFails = if (successCount > 0) 0 else hotFails + 1
                            }
                        }
                        
                        if (hotFails >= 5) {
                            delay(2000)
                            hotFails = 0
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
            conn.connectTimeout = 1_000
            conn.readTimeout = 1_000
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
        _hasRatedUp.value = true
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
        val excludeDomain = extractDomain(_rawUrl.value)
        _hasRatedUp.value = false
        viewModelScope.launch {
            haptic(context)
            if (loaded != null) {
                // Fire the rating in the background — don't wait for it before showing next page
                launch {
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
            }
            roam(excludeDomain = excludeDomain)
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

    fun setCollectionFilter(collectionId: String?) {
        _activeCollectionId.value = collectionId
        prefetchJob?.cancel()
        viewModelScope.launch { prefetchMutex.withLock { hotQueue.clear(); warmQueue.clear() } }
        startPrefillQueue()
    }

    /** Called when the WebView finishes rendering the current page. 
     *  Proactively exposes the next hot-queue URL so the hidden prefetch WebView 
     *  can start warming the disk cache while the user is still reading.
     *  This replaces the reactive approach where _nextPrefetchUrl was only set
     *  when the user tapped Roam — which meant the cache and the main WebView
     *  were racing, and the prefetch rarely finished first. */
    fun onPageFinishedForPrefetch() {
        if (_prefetchWebView.value) {
            viewModelScope.launch {
                val nextUrl = prefetchMutex.withLock { hotQueue.firstOrNull()?.url }
                if (nextUrl != null) {
                    _nextPrefetchUrl.value = nextUrl
                }
            }
        }
    }

    fun openSubmitSheet() { _showSubmitSheet.value = true }
    fun closeSubmitSheet() { _showSubmitSheet.value = false }
    fun openConfigSheet() { _showConfigSheet.value = true }
    fun closeConfigSheet() { _showConfigSheet.value = false }

    /** Called by the WebView when the user navigates to a page not in the discovery pool */
    fun onWebViewUrlChanged(url: String) {
        // During an active roam (Loading state), ignore stale onPageFinished callbacks
        // from the previous page. These would otherwise revert _currentUrl after roam()
        // has already advanced _rawUrl to the new destination.
        // During normal browsing (Loaded state), always accept URL changes — this ensures
        // WebView back/forward navigation and link clicks update _currentUrl correctly.
        if (_state.value is RoamState.Loading && url != _rawUrl.value) return
        _currentUrl.value = url
        recordUrlVisit(url, (_state.value as? RoamState.Loaded)?.roamUrl?.title ?: url)
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
        // Use _currentUrl (what the user is actually viewing) rather than _rawUrl
        // (the original discovery URL). If the user clicked a link within the page
        // and navigated to a different URL on the same domain, we should save the
        // page they're looking at, not the original entry point.
        //
        // If the current URL is a Google Translate wrapper, extract the underlying
        // URL so we save the actual page, not translate.google.com.
        val raw = _rawUrl.value
        val rawUrl = _currentUrl.value ?: raw ?: return
        val url = if (rawUrl.startsWith("https://translate.google.com/translate?")) {
            Uri.parse(rawUrl).getQueryParameter("u") ?: rawUrl
        } else {
            rawUrl
        }
        // Use the discovered page title if the user is still on the original
        // discovered page; otherwise fall back to the URL itself.
        val rawTitle = (_state.value as? RoamState.Loaded)?.roamUrl?.title
        val isOnDiscoveredPage = url == raw
        val title = (if (isOnDiscoveredPage && !rawTitle.isNullOrBlank()) rawTitle else url)
            .take(200)  // Guard against huge titles
        val urlId = if (isOnDiscoveredPage) (_state.value as? RoamState.Loaded)?.roamUrl?.id else null
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
        showTransientToast("Removed from saved")
        viewModelScope.launch {
            runCatching { repo.unsaveUrl(url) }
        }
    }

    fun reportBrokenLink() {
        val loaded = _state.value as? RoamState.Loaded ?: return
        val urlId = loaded.roamUrl.id
        val excludeDomain = extractDomain(_rawUrl.value)
        _showConfigSheet.value = false
        _reportConfirmation.value = true
        viewModelScope.launch {
            // Fire the report in the background — don't wait for it before showing next page
            launch { runCatching { repo.reportUrl(urlId) } }
            roam(excludeDomain = excludeDomain)
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
        _hasRatedUp.value = false
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
            createResult.onSuccess {
                showTransientToast("Created collection '$name'")
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
            // Find and show the collection name in the success message
            val collectionName = _collections.value.firstOrNull { it.id == collectionId }?.name
            if (collectionName != null) {
                showTransientToast("Added to $collectionName")
            }
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
            result.onSuccess {
                showTransientToast("Created collection '$name'")
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

    fun updateCollectionPublic(collectionId: String, isPublic: Boolean) {
        viewModelScope.launch {
            val result = runCatching { repo.updateCollectionPublic(collectionId, isPublic) }
            result.onFailure { e ->
                Sentry.captureException(e)
                showTransientToast("Couldn't update: ${e.message ?: "unknown error"}")
            }
            // Refresh collections to sync state
            runCatching { _collections.value = repo.getCollections() }
        }
    }

    fun removeItemFromCollection(collectionId: String, urlId: String) {
        viewModelScope.launch {
            val result = runCatching { repo.removeItemFromCollection(collectionId, urlId) }
            result.onFailure { e ->
                Sentry.captureException(e)
                showTransientToast("Couldn't remove item: ${e.message ?: "unknown error"}")
            }
            // Refresh collection items to reflect the removal
            runCatching { _collectionItems.value = repo.getCollectionItems(collectionId) }
        }
    }

    /** Shows a 4-second toast via the existing submitToast flow. */
    /** Fetches unread count on init and when entering subscribed screens. */
    fun fetchUnreadNotificationCount() {
        viewModelScope.launch {
            if (!repo.hasSession()) return@launch
            runCatching {
                _unreadNotificationCount.value = repo.getUnreadNotificationCount()
            }
        }
    }

    /** Loads recent notifications for the notifications screen. */
    fun loadNotifications() {
        viewModelScope.launch {
            _notificationsLoading.value = true
            runCatching {
                _notifications.value = repo.getNotifications()
            }
            _notificationsLoading.value = false
        }
    }

    /** Marks all notifications as read and clears the unread count. */
    fun markAllNotificationsRead() {
        _unreadNotificationCount.value = 0
        _notifications.value = _notifications.value.map { it.copy(read = true) }
        viewModelScope.launch {
            runCatching { repo.markAllNotificationsRead() }
        }
    }

    /** Deletes a single notification locally and on the server. */
    fun deleteNotification(notificationId: String) {
        _notifications.value = _notifications.value.filter { it.id != notificationId }
        viewModelScope.launch {
            runCatching { repo.deleteNotification(notificationId) }
        }
        // Refresh unread count since we may have just deleted an unread one
        fetchUnreadNotificationCount()
    }

    fun showTransientToast(message: String) {
        _submitToast.value = message
        viewModelScope.launch {
            delay(4000)
            if (_submitToast.value == message) _submitToast.value = null
        }
    }

    fun roamWithinCategory() {
        _hasRatedUp.value = false
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
        _profileInterestsError.value = null
        viewModelScope.launch {
            runCatching { _profile.value = repo.getProfile() }
        }
        viewModelScope.launch {
            // Wait for the session to be fully authenticated before querying
            // user_categories. On reinstall / fresh update the token may not
            // be propagated yet, and the repo silently returns emptySet() when
            // currentUserOrNull is null — which makes the user's previously
            // saved category selections appear unsaved.
            var sessionWait = 0
            while (!repo.hasSession() && sessionWait < 10) {
                delay(150)
                sessionWait++
            }
            val loaded = runCatching {
                val topicIds = repo.getUserTopicIds()
                if (topicIds.isNotEmpty()) {
                    _userTopicIds.value = topicIds
                    _interestMode.value = "topics"
                } else {
                    _userCategoryIds.value = repo.getUserCategoryIds()
                    _interestMode.value = "pillars"
                }
            }
            loaded.onFailure {
                _profileInterestsError.value = "Couldn't load your saved interests. Pull to refresh."
            }
        }
        viewModelScope.launch {
            runCatching {
                val (roamed, submitted) = repo.getProfileStats()
                _profileStats.value = ProfileStats(roamed = roamed, submitted = submitted)
            }
        }
    }

    /** Re-runs the interests query, incrementing a version so ProfileScreen re-reads. */
    fun reloadInterests() {
        _profileInterestsError.value = null
        viewModelScope.launch {
            var sessionWait = 0
            while (!repo.hasSession() && sessionWait < 10) {
                delay(150)
                sessionWait++
            }
            val loaded = runCatching {
                val topicIds = repo.getUserTopicIds()
                if (topicIds.isNotEmpty()) {
                    _userTopicIds.value = topicIds
                    _interestMode.value = "topics"
                } else {
                    _userCategoryIds.value = repo.getUserCategoryIds()
                    _interestMode.value = "pillars"
                }
            }
            loaded.onFailure {
                _profileInterestsError.value = "Couldn't load your saved interests. Pull to refresh."
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
        _profileSaveError.value = null
        profileSaveJob?.cancel()
        profileSaveJob = viewModelScope.launch {
            delay(800)
            val result = runCatching { repo.updateProfile(username, displayName, bio) }
            result.onFailure { e ->
                val message = e.message.orEmpty()
                val isUniqueViolation = message.contains("duplicate key", ignoreCase = true)
                    || message.contains("unique", ignoreCase = true)
                    || message.contains("violates", ignoreCase = true)
                if (isUniqueViolation) {
                    _profileSaveError.value = "Username '$username' is already taken. Please choose another."
                    // Revert local state to the last known server value so the text field
                    // doesn't show the rejected username. Only revert if we still have a profile.
                    val latest = runCatching { repo.getProfile() }.getOrNull()
                    if (latest != null) {
                        _profile.value = latest
                    }
                } else {
                    _profileSaveError.value = "Couldn't save: ${e.message ?: "unknown error"}"
                    Sentry.captureException(e)
                }
            }
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

    // ── URL History ───────────────────────────────────────────────────────────

    fun recordUrlVisit(url: String, title: String) {
        if (url.isBlank()) return
        val trimmedTitle = title.take(200)
        val entry = UrlHistoryEntry(url = url, title = trimmedTitle)
        val current = _urlHistory.value.toMutableList()
        // Remove existing entry for the same URL to avoid duplicates, then prepend
        current.removeAll { it.url == url }
        current.add(0, entry)
        // Trim to max entries
        if (current.size > MAX_HISTORY_ENTRIES) {
            current.subList(MAX_HISTORY_ENTRIES, current.size).clear()
        }
        _urlHistory.value = current
        persistUrlHistory(current)
    }

    fun clearUrlHistory() {
        _urlHistory.value = emptyList()
        prefs.edit().remove(URL_HISTORY_KEY).apply()
    }

    private fun loadUrlHistory(): List<UrlHistoryEntry> {
        val raw = prefs.getString(URL_HISTORY_KEY, null) ?: return emptyList()
        return deserializeHistory(raw)
    }

    private fun persistUrlHistory(list: List<UrlHistoryEntry>) {
        prefs.edit().putString(URL_HISTORY_KEY, serializeHistory(list)).apply()
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
            var host = android.net.Uri.parse(url).host ?: return null
            // Remove www. prefix if present
            if (host.startsWith("www.")) {
                host = host.substring(4)
            }
            val parts = host.split(".")
            // For subdomains like "username.itch.io", extract "itch.io" (registrable domain).
            // Simple heuristic: if 3+ parts, take the last 2. Doesn't handle all multi-part TLDs
            // perfectly (e.g., .co.uk), but works for ~95% of cases.
            if (parts.size >= 3) {
                parts.takeLast(2).joinToString(".")
            } else {
                host
            }
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