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
import app.roam.android.model.Badge
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
import app.roam.android.data.supabase
import app.roam.android.util.connectivityFlow
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
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
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive


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
    private val AUTO_TRANSLATE_KEY = "auto_translate"
    private val TRANSLATE_LANG_KEY = "translate_language"
    private val SHEET_GESTURE_MODE_KEY = "sheet_gesture_mode"  // "slide" or "tap"
    private val PREFETCH_WEBVIEW_KEY  = "prefetch_webview"
    private val NOTIFICATIONS_ENABLED_KEY = "notifications_enabled"
    private val URL_HISTORY_KEY = "url_history"
    private val APP_THEME_KEY = "app_theme"  // "system", "dark", "light"
    private val WALKTHROUGH_SEEN_KEY = "walkthrough_seen"
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

    /** Whether admin features are unlocked in the config bottom sheet.
     *  Persists in-memory until the app process is killed or the user signs out.
     *  Not written to SharedPreferences — ephemeral by design. */
    private val _adminModeEnabled = MutableStateFlow(false)
    val adminModeEnabled: StateFlow<Boolean> = _adminModeEnabled.asStateFlow()

    fun setAdminMode(enabled: Boolean) {
        _adminModeEnabled.value = enabled
    }

    /** Whether the moderator bottom-sheet section is unlocked (tap version 5× in Settings).
     *  Only set for users whose role is 'moderator'. Cleared on sign-out. */
    private val _moderatorModeEnabled = MutableStateFlow(false)
    val moderatorModeEnabled: StateFlow<Boolean> = _moderatorModeEnabled.asStateFlow()

    fun setModeratorMode(enabled: Boolean) {
        _moderatorModeEnabled.value = enabled
    }

    /** True when the signed-in user has app_metadata.role = 'moderator'.
     *  Set on session load; cleared on sign-out. Not persisted. */
    private val _isModerator = MutableStateFlow(false)
    val isModerator: StateFlow<Boolean> = _isModerator.asStateFlow()

    /**
     * Reads app_metadata.role from the current session and unlocks admin/mod panels.
     * Prefer the authenticated session user (always present after sign-in); fall back
     * to currentUserOrNull(). Safe to call repeatedly — e.g. when opening the You tab.
     */
    fun checkUserRole() {
        val role = try {
            val status = supabase.auth.sessionStatus.value
            val user = when (status) {
                is SessionStatus.Authenticated -> status.session.user
                else -> supabase.auth.currentUserOrNull()
            }
            user?.appMetadata?.get("role")?.jsonPrimitive?.contentOrNull
        } catch (e: Exception) {
            android.util.Log.w("MainViewModel", "checkUserRole failed: ${e.message}")
            null
        }
        android.util.Log.d("MainViewModel", "checkUserRole → role=$role")
        _isModerator.value = role == "moderator"
        // Only elevate; never demote admin/mod mid-session unless role is known non-privileged.
        // Clear first so a role change (or sign-out path) cannot leave stale unlocks.
        _adminModeEnabled.value = role == "admin"
        _moderatorModeEnabled.value = role == "moderator" || role == "admin"
    }


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

    /** User preference: app theme mode ("system", "dark", "light") */
    private val _appTheme = MutableStateFlow(prefs.getString(APP_THEME_KEY, "system") ?: "system")
    val appTheme: StateFlow<String> = _appTheme.asStateFlow()

    fun setAppTheme(theme: String) {
        _appTheme.value = theme
        prefs.edit().putString(APP_THEME_KEY, theme).apply()
    }

    /** User preference: auto-translate pages */
    private val _autoTranslate = MutableStateFlow(prefs.getBoolean(AUTO_TRANSLATE_KEY, false))
    val autoTranslate: StateFlow<Boolean> = _autoTranslate.asStateFlow()

    fun setAutoTranslate(enabled: Boolean) {
        _autoTranslate.value = enabled
        prefs.edit().putBoolean(AUTO_TRANSLATE_KEY, enabled).apply()
        // If enabling, immediately translate the current page
        if (enabled) {
            val raw = _rawUrl.value ?: return
            _currentUrl.value = translateUrl(raw)
        } else {
            // If disabling, revert to the raw URL
            _currentUrl.value = _rawUrl.value
        }
    }

    /** Returns true if the user has already seen the feature walkthrough. */
    fun hasSeenWalkthrough(): Boolean = prefs.getBoolean(WALKTHROUGH_SEEN_KEY, false)

    /** Marks the feature walkthrough as seen (persisted). */
    fun markWalkthroughSeen() {
        prefs.edit().putBoolean(WALKTHROUGH_SEEN_KEY, true).apply()
    }

    /** Resets the walkthrough flag so it shows again on the next main-screen visit. */
    fun resetWalkthrough() {
        prefs.edit().remove(WALKTHROUGH_SEEN_KEY).apply()
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
            // Cancel existing prefill, clear queues, and restart unfiltered refill
            // so the first roam after disabling focus is fast (not a cold network call).
            prefetchJob?.cancel()
            viewModelScope.launch {
                prefetchMutex.withLock { hotQueue.clear(); warmQueue.clear() }
                startPrefillQueue()
            }
        }
        // When enabling: don't touch queues yet — they stay with the current
        // (possibly unfiltered) contents. setFocusCategory() will clear + refill
        // with filtered URLs once the user actually picks a category.
    }

    /** Sets the active focus category and clears/refills the prefetch queue.
     *  When focus mode is enabled, also activates it if not already active. */
    fun setFocusCategory(categoryId: String?) {
        _focusCategoryId.value = categoryId
        _focusSubcategoryId.value = null  // reset subcategory when category changes
        if (categoryId != null) {
            // Activate focus mode if picking a category while mode was toggled on
            if (!_focusModeEnabled.value) _focusModeEnabled.value = true
            // Sequentially cancel → clear → restart to avoid the race between
            // the clear coroutine (Main) and startPrefillQueue (IO dispatcher).
            prefetchJob?.cancel()
            viewModelScope.launch {
                prefetchMutex.withLock { hotQueue.clear(); warmQueue.clear() }
                startPrefillQueue()
            }
        }
    }

    fun setFocusSubcategory(subcategoryId: String?) {
        _focusSubcategoryId.value = subcategoryId
        if (_focusModeEnabled.value && _focusCategoryId.value != null) {
            // Same sequential pattern as setFocusCategory — cancel, clear, restart
            // in a single coroutine to avoid the Main/IO dispatcher race.
            prefetchJob?.cancel()
            viewModelScope.launch {
                prefetchMutex.withLock { hotQueue.clear(); warmQueue.clear() }
                startPrefillQueue()
            }
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

    /** User's earned and in-progress badges */
    private val _badges = MutableStateFlow<List<Badge>>(emptyList())
    val badges: StateFlow<List<Badge>> = _badges.asStateFlow()

    private val _badgesLoading = MutableStateFlow(false)
    val badgesLoading: StateFlow<Boolean> = _badgesLoading.asStateFlow()

    private val _badgesError = MutableStateFlow<String?>(null)
    val badgesError: StateFlow<String?> = _badgesError.asStateFlow()

    private val _leaderboard = MutableStateFlow<List<app.roam.android.model.LeaderboardEntry>>(emptyList())
    val leaderboard: StateFlow<List<app.roam.android.model.LeaderboardEntry>> = _leaderboard.asStateFlow()

    private val _leaderboardLoading = MutableStateFlow(false)
    val leaderboardLoading: StateFlow<Boolean> = _leaderboardLoading.asStateFlow()

    private val _leaderboardError = MutableStateFlow<String?>(null)
    val leaderboardError: StateFlow<String?> = _leaderboardError.asStateFlow()

    // ── Social: follow system ──────────────────────────────────────────────

    private val _followerCount = MutableStateFlow(0)
    val followerCount: StateFlow<Int> = _followerCount.asStateFlow()

    private val _followingCount = MutableStateFlow(0)
    val followingCount: StateFlow<Int> = _followingCount.asStateFlow()

    private val _followers = MutableStateFlow<List<app.roam.android.model.FollowUser>>(emptyList())
    val followers: StateFlow<List<app.roam.android.model.FollowUser>> = _followers.asStateFlow()

    private val _following = MutableStateFlow<List<app.roam.android.model.FollowUser>>(emptyList())
    val following: StateFlow<List<app.roam.android.model.FollowUser>> = _following.asStateFlow()

    private val _followListsLoading = MutableStateFlow(false)
    val followListsLoading: StateFlow<Boolean> = _followListsLoading.asStateFlow()

    private val _publicProfile = MutableStateFlow<app.roam.android.model.PublicProfile?>(null)
    val publicProfile: StateFlow<app.roam.android.model.PublicProfile?> = _publicProfile.asStateFlow()

    private val _publicProfileLoading = MutableStateFlow(false)
    val publicProfileLoading: StateFlow<Boolean> = _publicProfileLoading.asStateFlow()

    private val _publicProfileError = MutableStateFlow<String?>(null)
    val publicProfileError: StateFlow<String?> = _publicProfileError.asStateFlow()

    private val _followStatus = MutableStateFlow("none")
    val followStatus: StateFlow<String> = _followStatus.asStateFlow()

    private val _followLoading = MutableStateFlow(false)
    val followLoading: StateFlow<Boolean> = _followLoading.asStateFlow()

    // ── Social: share URL ──────────────────────────────────────────────────

    private val _showShareUrlSheet = MutableStateFlow(false)
    val showShareUrlSheet: StateFlow<Boolean> = _showShareUrlSheet.asStateFlow()

    private val _shareRecipients = MutableStateFlow<List<app.roam.android.model.FollowUser>>(emptyList())
    val shareRecipients: StateFlow<List<app.roam.android.model.FollowUser>> = _shareRecipients.asStateFlow()

    private val _shareRecipientsLoading = MutableStateFlow(false)
    val shareRecipientsLoading: StateFlow<Boolean> = _shareRecipientsLoading.asStateFlow()

    // ── Social: user search ────────────────────────────────────────────────

    private val _userSearchResults = MutableStateFlow<List<app.roam.android.model.FollowUser>>(emptyList())
    val userSearchResults: StateFlow<List<app.roam.android.model.FollowUser>> = _userSearchResults.asStateFlow()

    private val _userSearchLoading = MutableStateFlow(false)
    val userSearchLoading: StateFlow<Boolean> = _userSearchLoading.asStateFlow()

    // ── Activity feed ──────────────────────────────────────────────────────

    private val _activityFeed = MutableStateFlow<List<app.roam.android.model.ActivityFeedItem>>(emptyList())
    val activityFeed: StateFlow<List<app.roam.android.model.ActivityFeedItem>> = _activityFeed.asStateFlow()

    private val _activityFeedLoading = MutableStateFlow(false)
    val activityFeedLoading: StateFlow<Boolean> = _activityFeedLoading.asStateFlow()

    private val _activityFeedError = MutableStateFlow<String?>(null)
    val activityFeedError: StateFlow<String?> = _activityFeedError.asStateFlow()

    fun loadLeaderboard(period: String) {
        viewModelScope.launch {
            _leaderboardLoading.value = true
            _leaderboardError.value = null
            runCatching { repo.getLeaderboard(period) }
                .onSuccess { _leaderboard.value = it }
                .onFailure { _leaderboardError.value = it.message ?: "Failed to load leaderboard" }
            _leaderboardLoading.value = false
        }
    }

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

    /** Timestamp of the last user-initiated roam for client-side cooldown. */
    private var lastRoamMillis = 0L

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

        // Continuously observe auth session so admin/mod panels unlock after sign-in
        // (MainViewModel is created before auth finishes) and clear on sign-out.
        viewModelScope.launch {
            supabase.auth.sessionStatus.collect { status ->
                when (status) {
                    is SessionStatus.Authenticated -> checkUserRole()
                    is SessionStatus.NotAuthenticated,
                    is SessionStatus.RefreshFailure -> {
                        _adminModeEnabled.value = false
                        _moderatorModeEnabled.value = false
                        _isModerator.value = false
                    }
                    SessionStatus.Initializing -> { /* wait */ }
                }
            }
        }


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

        // ── Client-side debounce: ignore rapid-fire taps within 1 second ──────
        val now = System.currentTimeMillis()
        if (now - lastRoamMillis < 1000L) return
        lastRoamMillis = now

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
            
            // Wait for the session to be fully ready before making the network call.
            // ensureAuthenticated() inside repo.roam() also handles the Initializing
            // case with its own wait loop — this is just an early exit to avoid
            // churning through retries when the session clearly isn't ready yet.
            var sessionWaitAttempts = 0
            while (!repo.hasSession() && sessionWaitAttempts < 40) {
                delay(250)
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
                        categoryId = if (_focusModeEnabled.value && _focusCategoryId.value != null) _focusCategoryId.value else null,
                        subcategoryId = if (_focusModeEnabled.value && _focusSubcategoryId.value != null) _focusSubcategoryId.value else null,
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
                // Note: IllegalStateException (token unavailable) is now prevented upstream
                // by the hasValidToken() wait loop above, so we let all 3 attempts fire rather
                // than bailing early — a second attempt usually succeeds if the token
                // materialized between attempts.

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
                
                // The UUID syntax error ("invalid input syntax for type uuid: ''") means
                // Supabase's runtime validated a JWT with an empty sub claim — this is a
                // transient state caused by the refresh-token race fix, not a real sign-out.
                // Show a non-alarmist retry message instead of "Session expired".
                val isUuidSyntaxError = e is UnauthorizedRestException &&
                    e.message?.contains("invalid input syntax for type uuid", ignoreCase = true) == true
                val msg = when {
                    isDnsError -> "Network unreachable. Check WiFi/cellular connection."
                    isTimeout -> "Request timed out. Check your network connection."
                    isUuidSyntaxError -> "Couldn't connect to your account. Please retry."
                    e is UnauthorizedRestException -> "Session expired. Please sign in again."
                    // IllegalStateException means the local token never materialized — not
                    // necessarily an expired session. Retry is more useful than signing out.
                    e is IllegalStateException -> "Couldn't connect to your account. Please retry."
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
                                        prefetch = true,
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
     * Navigates to [url] after first injecting the Supabase session cookie and
     * waiting for the CookieManager to flush. Prevents the "loads before auth" race
     * that causes blank/unauthorized pages on roamtheweb.app.
     */
    fun navigateToWebWithAuth(url: String) {
        app.roam.android.util.WebAuthUtil.injectSessionAndWait()
        navigateTo(url)
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

    /**
     * Resets discovery state so the next sign-in triggers a fresh roam rather than
     * showing a stale page from the previous session. Called on sign-out.
     *
     * Cancels any in-flight roam/prefetch jobs, clears the URL queues, and resets
     * all transient UI state to its initial values so [DiscoverTab]'s LaunchedEffect
     * (which watches for RoamState.Idle) fires a new roam() automatically.
     */
    fun resetForNewSession() {
        roamJob?.cancel()
        prefetchJob?.cancel()
        viewModelScope.launch { prefetchMutex.withLock { hotQueue.clear(); warmQueue.clear() } }
        _state.value = RoamState.Idle
        _rawUrl.value = null
        _currentUrl.value = null
        _nextPrefetchUrl.value = null
        _hasRatedUp.value = false
        _adminModeEnabled.value = false
        _moderatorModeEnabled.value = false
        _isModerator.value = false
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

    fun loadBadges() {
        viewModelScope.launch {
            _badgesLoading.value = true
            _badgesError.value = null
            runCatching { repo.getBadges() }
                .onSuccess { _badges.value = it }
                .onFailure { _badgesError.value = it.message ?: "Failed to load badges" }
            _badgesLoading.value = false
        }
    }

    // ── Profile (14.6) ────────────────────────────────────────────────────────

    /** Loads profile, user categories, and stats in parallel. */
    fun loadProfile() {
        _profileInterestsError.value = null
        loadBadges()
        viewModelScope.launch {
            runCatching {
                _profile.value = repo.getProfile()
                // After loading profile, fetch social stats
                val userId = _profile.value?.id
                if (userId != null) {
                    _followerCount.value = repo.getFollowerCount(userId)
                    _followingCount.value = repo.getFollowingCount(userId)
                }
            }
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

    /**
     * Normalizes a URL to prevent duplicate history entries caused by trivial
     * variations: trailing slashes, scheme differences, and common tracking /
     * analytics query parameters (utm_*, fbclid, ref, source).
     *
     * If the URL cannot be parsed, the raw string is returned with trailing
     * slashes stripped as a best-effort fallback.
     */
    private fun normalizeUrl(url: String): String {
        if (url.isBlank()) return url
        return try {
            val parsed = java.net.URI(url)
            val scheme = (parsed.scheme ?: "https").lowercase()
            val host = (parsed.host ?: "").lowercase().removePrefix("www.")
            // Preserve the path but strip a single trailing slash
            val path = parsed.rawPath?.trimEnd('/') ?: ""
            // Drop known analytics / tracking query parameters
            val trackingKeys = setOf(
                "utm_source", "utm_medium", "utm_campaign", "utm_term",
                "utm_content", "utm_id", "fbclid", "gclid", "ref", "source"
            )
            val cleanQuery = parsed.rawQuery
                ?.split('&')
                ?.filter { p -> p.substringBefore('=').lowercase() !in trackingKeys }
                ?.joinToString("&")
                ?.takeIf { it.isNotEmpty() }
            val base = "$scheme://$host$path"
            if (cleanQuery != null) "$base?$cleanQuery" else base
        } catch (_: Exception) {
            // Malformed URL — just strip trailing slash as a minimal normalization
            url.trimEnd('/')
        }
    }

    fun recordUrlVisit(url: String, title: String) {
        val normalized = normalizeUrl(url)
        if (normalized.isBlank()) return
        val trimmedTitle = title.take(200)
        val entry = UrlHistoryEntry(url = normalized, title = trimmedTitle)
        val current = _urlHistory.value.toMutableList()
        // Remove existing entries that normalize to the same canonical URL
        current.removeAll { normalizeUrl(it.url) == normalized }
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

    // ── Social: Follow system (methods) ───────────────────────────────────

    /** Loads follower and following counts for the current user. Called from loadProfile(). */
    fun loadProfileSocial() {
        val userId = _profile.value?.id ?: return
        viewModelScope.launch {
            runCatching {
                val fc = repo.getFollowerCount(userId)
                val fg = repo.getFollowingCount(userId)
                _followerCount.value = fc
                _followingCount.value = fg
            }
        }
    }

    /** Loads the list of followers for a given user. */
    fun loadFollowers(userId: String) {
        viewModelScope.launch {
            _followListsLoading.value = true
            runCatching { _followers.value = repo.getFollowers(userId) }
            _followListsLoading.value = false
        }
    }

    /** Loads the list of users a given user is following. */
    fun loadFollowing(userId: String) {
        viewModelScope.launch {
            _followListsLoading.value = true
            runCatching { _following.value = repo.getFollowing(userId) }
            _followListsLoading.value = false
        }
    }

    /** Loads a user's public profile by username. */
    fun loadPublicProfile(username: String) {
        _publicProfileLoading.value = true
        _publicProfileError.value = null
        _publicProfile.value = null
        viewModelScope.launch {
            val result = runCatching { repo.getPublicProfile(username) }
            result.onSuccess { profile ->
                _publicProfile.value = profile
                if (profile != null) {
                    _followStatus.value = repo.getFollowStatus(profile.id)
                }
            }
            result.onFailure {
                _publicProfileError.value = it.message ?: "Failed to load profile"
                Sentry.captureException(it)
            }
            _publicProfileLoading.value = false
        }
    }

    /** Follows a user (immediate — no pending/approval flow). */
    fun followUser(targetUserId: String) {
        _followLoading.value = true
        viewModelScope.launch {
            runCatching { repo.follow(targetUserId) }
                .onSuccess {
                    _followStatus.value = "following"
                    val current = _publicProfile.value
                    if (current != null) {
                        _publicProfile.value = current.copy(followerCount = current.followerCount + 1)
                    }
                    _followerCount.value = _followerCount.value + 1
                }
                .onFailure { showTransientToast("Couldn't follow: ${it.message}") }
            _followLoading.value = false
        }
    }

    /** Unfollows a user. */
    fun unfollowUser(targetUserId: String) {
        _followLoading.value = true
        viewModelScope.launch {
            runCatching { repo.unfollow(targetUserId) }
                .onSuccess {
                    _followStatus.value = "none"
                    val current = _publicProfile.value
                    if (current != null && current.followerCount > 0) {
                        _publicProfile.value = current.copy(followerCount = current.followerCount - 1)
                    }
                    if (_followerCount.value > 0) _followerCount.value = _followerCount.value - 1
                }
                .onFailure { showTransientToast("Couldn't unfollow: ${it.message}") }
            _followLoading.value = false
        }
    }

    // ── Social: Share URL (methods) ───────────────────────────────────────

    fun openShareUrlSheet() {
        _showShareUrlSheet.value = true
        loadShareRecipients()
    }

    fun closeShareUrlSheet() {
        _showShareUrlSheet.value = false
    }

    private fun loadShareRecipients(query: String? = null) {
        viewModelScope.launch {
            _shareRecipientsLoading.value = true
            runCatching {
                _shareRecipients.value = repo.getShareRecipients(query)
            }
            _shareRecipientsLoading.value = false
        }
    }

    /** Shares the current URL with another user. */
    fun shareUrlWithUser(recipientId: String) {
        val loaded = _state.value as? RoamState.Loaded ?: return
        viewModelScope.launch {
            runCatching { repo.shareUrl(recipientId, loaded.roamUrl.id) }
                .onSuccess {
                    showTransientToast("Sent!")
                    closeShareUrlSheet()
                }
                .onFailure { showTransientToast("Couldn't send: ${it.message}") }
        }
    }

    // ── Social: User search ────────────────────────────────────────────────

    fun searchUsers(query: String) {
        if (query.isBlank()) {
            _userSearchResults.value = emptyList()
            return
        }
        viewModelScope.launch {
            _userSearchLoading.value = true
            runCatching { _userSearchResults.value = repo.searchUsers(query) }
            _userSearchLoading.value = false
        }
    }

    // ── Activity feed ──────────────────────────────────────────────────────

    fun loadActivityFeed() {
        viewModelScope.launch {
            _activityFeedLoading.value = true
            _activityFeedError.value = null
            runCatching { _activityFeed.value = repo.getActivityFeed() }
                .onFailure { _activityFeedError.value = it.message ?: "Failed to load activity" }
            _activityFeedLoading.value = false
        }
    }

    // ── Web navigation with auto sign-in ──────────────────────────────────

    /**
     * Navigates the WebView to [url], automatically injecting the Supabase
     * session cookie if the URL is on roamtheweb.app so the user is signed in.
     */
    fun navigateToWeb(url: String) {
        if (url.contains("roamtheweb.app")) {
            app.roam.android.util.WebAuthUtil.injectSession()
        }
        navigateTo(url)
    }

    /** Returns the current user's public profile URL. */
    fun getOwnProfileUrl(): String {
        val username = _profile.value?.username ?: return "https://roamtheweb.app"
        return "https://roamtheweb.app/u/$username"
    }

    /** Sets the username that should be navigated to when MainScreen loads (from deep link). */
    fun setPendingProfileUsername(username: String) {
        _pendingProfileUsername.value = username
    }

    fun consumePendingProfileUsername(): String? {
        val u = _pendingProfileUsername.value
        _pendingProfileUsername.value = null
        return u
    }

    private val _pendingProfileUsername = MutableStateFlow<String?>(null)

    /** Copies the current user's profile URL to clipboard (expects Context from UI layer). */
    fun copyProfileLink(context: Context) {
        val username = _profile.value?.username ?: return
        val url = "https://roamtheweb.app/u/$username"
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("profile link", url))
        showTransientToast("Profile link copied")
    }

    // ── Admin / Moderator ─────────────────────────────────────────────────────

    private val _adminQueue = MutableStateFlow<List<app.roam.android.model.AdminQueueItem>>(emptyList())
    val adminQueue: StateFlow<List<app.roam.android.model.AdminQueueItem>> = _adminQueue.asStateFlow()

    private val _adminQueueLoading = MutableStateFlow(false)
    val adminQueueLoading: StateFlow<Boolean> = _adminQueueLoading.asStateFlow()

    private val _adminReports = MutableStateFlow<List<app.roam.android.model.AdminReportItem>>(emptyList())
    val adminReports: StateFlow<List<app.roam.android.model.AdminReportItem>> = _adminReports.asStateFlow()

    private val _adminReportsLoading = MutableStateFlow(false)
    val adminReportsLoading: StateFlow<Boolean> = _adminReportsLoading.asStateFlow()

    private val _adminBetaSignups = MutableStateFlow<List<app.roam.android.model.AdminBetaSignup>>(emptyList())
    val adminBetaSignups: StateFlow<List<app.roam.android.model.AdminBetaSignup>> = _adminBetaSignups.asStateFlow()

    private val _adminBetaLoading = MutableStateFlow(false)
    val adminBetaLoading: StateFlow<Boolean> = _adminBetaLoading.asStateFlow()

    private val _adminStats = MutableStateFlow<app.roam.android.model.AdminStats?>(null)
    val adminStats: StateFlow<app.roam.android.model.AdminStats?> = _adminStats.asStateFlow()

    private val _adminActionLoading = MutableStateFlow(false)
    val adminActionLoading: StateFlow<Boolean> = _adminActionLoading.asStateFlow()

    fun loadAdminQueue() {
        viewModelScope.launch {
            _adminQueueLoading.value = true
            runCatching { _adminQueue.value = repo.getAdminQueue() }
            _adminQueueLoading.value = false
        }
    }

    fun loadAdminStats() {
        viewModelScope.launch {
            runCatching { _adminStats.value = repo.getAdminStats() }
        }
    }

    fun loadAdminReports() {
        viewModelScope.launch {
            _adminReportsLoading.value = true
            runCatching { _adminReports.value = repo.getAdminReports() }
            _adminReportsLoading.value = false
        }
    }

    fun loadAdminBetaSignups() {
        viewModelScope.launch {
            _adminBetaLoading.value = true
            runCatching { _adminBetaSignups.value = repo.getBetaSignups() }
            _adminBetaLoading.value = false
        }
    }

    fun approveSubmission(id: String) {
        viewModelScope.launch {
            _adminActionLoading.value = true
            val result = repo.approveSubmission(id)
            _adminActionLoading.value = false
            if (result.ok) {
                loadAdminQueue()
                loadAdminStats()
            } else {
                showTransientToast(result.error ?: "Failed to approve")
            }
        }
    }

    fun rejectSubmission(id: String) {
        viewModelScope.launch {
            _adminActionLoading.value = true
            val result = repo.rejectSubmission(id)
            _adminActionLoading.value = false
            if (result.ok) {
                loadAdminQueue()
                loadAdminStats()
            } else {
                showTransientToast(result.error ?: "Failed to reject")
            }
        }
    }

    fun restoreReportedLink(urlId: String) {
        viewModelScope.launch {
            _adminActionLoading.value = true
            val result = repo.restoreReportedLink(urlId)
            _adminActionLoading.value = false
            if (result.ok) loadAdminReports()
            else showTransientToast(result.error ?: "Failed to restore")
        }
    }

    fun deleteBetaSignup(id: Int) {
        viewModelScope.launch {
            val result = repo.deleteBetaSignup(id)
            if (result.ok) {
                _adminBetaSignups.value = _adminBetaSignups.value.filter { it.id != id }
            } else {
                showTransientToast(result.error ?: "Failed to delete")
            }
        }
    }

}
