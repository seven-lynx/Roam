package app.roam.android.viewmodel

import android.app.Application
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.roam.android.data.repository.RoamRepository
import app.roam.android.model.CategoryItem
import app.roam.android.model.Collection
import app.roam.android.model.RoamUrl
import app.roam.android.model.UserProfile
import app.roam.android.util.connectivityFlow
import io.github.jan.supabase.exceptions.UnauthorizedRestException
import io.sentry.Sentry
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
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
import org.json.JSONArray

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

data class SavedUrl(val url: String, val title: String)

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
    private val AUTO_TRANSLATE_KEY = "auto_translate"
    private val JS_ENABLED_KEY = "js_enabled"
    private val TRANSLATE_LANG_KEY = "translate_language"

    private val _state = MutableStateFlow<RoamState>(RoamState.Idle)
    val state: StateFlow<RoamState> = _state.asStateFlow()

    private val _savedUrls = MutableStateFlow<List<SavedUrl>>(loadSavedUrls())
    val savedUrls: StateFlow<List<SavedUrl>> = _savedUrls.asStateFlow()

    /** True while a save-for-later confirmation should be visible */
    private val _savedConfirmation = MutableStateFlow(false)
    val savedConfirmation: StateFlow<Boolean> = _savedConfirmation.asStateFlow()

    /** User's collections (lazy-loaded when config sheet opens) */
    private val _collections = MutableStateFlow<List<Collection>>(emptyList())
    val collections: StateFlow<List<Collection>> = _collections.asStateFlow()

    /** Controls whether the "add to collection" dialog is visible */
    private val _showAddToCollection = MutableStateFlow(false)
    val showAddToCollection: StateFlow<Boolean> = _showAddToCollection.asStateFlow()

    /** The URL currently loaded in the WebView (may differ from state while loading next) */
    private val _currentUrl = MutableStateFlow<String?>(null)
    val currentUrl: StateFlow<String?> = _currentUrl.asStateFlow()

    private val _webNavChannel = Channel<WebNavCommand>(Channel.CONFLATED)
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

    /** User preference: auto-translate pages through Google Translate */
    private val _autoTranslate = MutableStateFlow(prefs.getBoolean(AUTO_TRANSLATE_KEY, false))
    val autoTranslate: StateFlow<Boolean> = _autoTranslate.asStateFlow()

    fun setAutoTranslate(enabled: Boolean) {
        _autoTranslate.value = enabled
        prefs.edit().putBoolean(AUTO_TRANSLATE_KEY, enabled).apply()
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

    /** Wraps [url] through Google Translate when auto-translate is on. */
    private fun maybeTranslate(url: String): String {
        if (!_autoTranslate.value) return url
        return "https://translate.google.com/translate?sl=auto&tl=${_translateLanguage.value}&u=${Uri.encode(url)}"
    }

    /** User preference: list of language codes to include (e.g. ["en", "fr"]) */
    private val _preferredLanguages = MutableStateFlow(listOf("en"))
    val preferredLanguages: StateFlow<List<String>> = _preferredLanguages.asStateFlow()

    /** Available categories (starts as hardcoded fallback, replaced by DB data on init) */
    private val _categories = MutableStateFlow(CategoryItem.FALLBACK)
    val categories: StateFlow<List<CategoryItem>> = _categories.asStateFlow()

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

    /** Counts of pages roamed and submitted by the current user */
    private val _profileStats = MutableStateFlow(ProfileStats())
    val profileStats: StateFlow<ProfileStats> = _profileStats.asStateFlow()

    /** Debounce job for profile auto-save */
    private var profileSaveJob: Job? = null

    // ── Connectivity + offline queue (14.9) ───────────────────────────────────

    /** True when the device has an active internet connection */
    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    /** Ratings that failed to send because the device was offline */
    private data class PendingRating(val urlId: String, val value: Int)
    private val pendingRatings = ArrayDeque<PendingRating>()

    init {
        viewModelScope.launch {
            runCatching { repo.getCategories() }
                .onSuccess { if (it.isNotEmpty()) _categories.value = it }
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
        // Only do this when a session is already in memory (returning user).
        // On first launch the session isn't loaded yet and the call would hit
        // /functions/v1/roam with the anon key, causing a 401 (ROAM-ANDROID-5).
        // MainScreen's LaunchedEffect fires vm.roam() after auth is established.
        if (repo.hasSession()) startPrefillQueue()

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
        viewModelScope.launch {
            // Pop from the hot queue for an instant transition, skipping any entry from
            // the excluded domain or matching the current URL (avoids re-serving the same
            // page after a thumbs-down when the prefetch queue was built before the skip).
            val prefetched = prefetchMutex.withLock {
                var result: RoamUrl? = null
                while (hotQueue.isNotEmpty()) {
                    val candidate = hotQueue.removeFirst()
                    val sameDomain = excludeDomain != null &&
                        extractDomain(candidate.url) == excludeDomain
                    val sameUrl = candidate.url == _currentUrl.value
                    if (!sameDomain && !sameUrl) {
                        result = candidate
                        break
                    }
                }
                result
            }
            if (prefetched != null) {
                val served = prefetched.copy(url = maybeTranslate(prefetched.url))
                _currentUrl.value = served.url
                _state.value = RoamState.Loaded(served)
                startPrefillQueue(excludeDomain = extractDomain(prefetched.url))
                return@launch
            }

            _state.value = RoamState.Loading
            var lastException: Throwable? = null
            var result: RoamUrl? = null
            var success = false
            // Retry up to 3 times with increasing delays to handle transient auth/network issues
            for (attempt in 0 until 3) {
                if (attempt > 0) delay(500L * attempt)
                val outcome = runCatching {
                    repo.roam(
                        collectionId = _activeCollectionId.value,
                        excludeDomain = excludeDomain,
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

            if (success) {
                if (result == null) {
                    _state.value = RoamState.Exhausted
                } else {
                    val served = result.copy(url = maybeTranslate(result.url))
                    _currentUrl.value = served.url
                    _state.value = RoamState.Loaded(served)
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
                // Small delay between calls reduces cold-start hammering on the
                // edge function, which helps avoid 60s timeouts (ROAM-ANDROID-4).
                if (!warmDone && warmFails < 8) {
                    delay(300)
                    val candidate = runCatching {
                        repo.roam(
                            collectionId  = _activeCollectionId.value,
                            excludeDomain = excludeDomain,
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
            conn.connectTimeout = 5_000
            conn.readTimeout = 5_000
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
                // Queue for retry if offline; report unexpected errors
                if (result.exceptionOrNull() is IOException) {
                    pendingRatings.addLast(PendingRating(loaded.roamUrl.id, 1))
                } else {
                    result.exceptionOrNull()?.let { Sentry.captureException(it) }
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
                    if (result.exceptionOrNull() is IOException) {
                        pendingRatings.addLast(PendingRating(loaded.roamUrl.id, -1))
                    } else {
                        result.exceptionOrNull()?.let { Sentry.captureException(it) }
                    }
                }
            }
            roam(excludeDomain = extractDomain(_currentUrl.value))
        }
    }

    fun submitUrl(url: String, categoryId: String) {
        viewModelScope.launch {
            runCatching { repo.submitUrl(url, categoryId) }
            _showSubmitSheet.value = false
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
        val url = _currentUrl.value ?: return
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
        viewModelScope.launch {
            runCatching { repo.reportUrl(urlId) }
            roam(excludeDomain = extractDomain(_currentUrl.value))
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

    fun addCurrentUrlToCollection(collectionId: String) {
        val loaded = _state.value as? RoamState.Loaded ?: return
        viewModelScope.launch {
            runCatching { repo.addUrlToCollection(collectionId, loaded.roamUrl.id) }
            _showAddToCollection.value = false
            closeConfigSheet()
        }
    }

    fun createCollectionAndAdd(name: String) {
        val loaded = _state.value as? RoamState.Loaded ?: return
        viewModelScope.launch {
            runCatching {
                val col = repo.createCollection(name)
                repo.addUrlToCollection(col.id, loaded.roamUrl.id)
            }
            _showAddToCollection.value = false
            closeConfigSheet()
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
                    excludeDomain = extractDomain(_currentUrl.value),
                    categoryId = categoryId,
                )
            }.onSuccess { result ->
                if (result == null) _state.value = RoamState.Exhausted
                else { _currentUrl.value = result.url; _state.value = RoamState.Loaded(result) }
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
            runCatching { _userCategoryIds.value = repo.getUserCategoryIds() }
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

    /**
     * Reads the image from [uri], compresses it to ≤ 600 px JPEG, uploads to Supabase Storage,
     * then updates the profile's avatar_url.
     */
    fun onAvatarPicked(uri: Uri) {
        viewModelScope.launch {
            runCatching {
                val contentResolver = getApplication<android.app.Application>().contentResolver
                val raw = contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: return@runCatching
                val compressed = compressJpeg(raw)
                val avatarUrl = repo.uploadAvatar(compressed)
                _profile.value = _profile.value?.copy(avatarUrl = avatarUrl)
            }
        }
    }

    /** Optimistically toggles a category, then syncs to Supabase. */
    fun toggleCategory(categoryId: String, selected: Boolean) {
        _userCategoryIds.value = if (selected) {
            _userCategoryIds.value + categoryId
        } else {
            _userCategoryIds.value - categoryId
        }
        viewModelScope.launch {
            runCatching { repo.setUserCategory(categoryId, selected) }
        }
    }

    private fun compressJpeg(input: ByteArray, maxDim: Int = 600): ByteArray {
        val bitmap = BitmapFactory.decodeByteArray(input, 0, input.size) ?: return input
        val scaled = if (bitmap.width > maxDim || bitmap.height > maxDim) {
            val scale = maxDim.toFloat() / maxOf(bitmap.width, bitmap.height)
            Bitmap.createScaledBitmap(
                bitmap,
                (bitmap.width * scale).toInt(),
                (bitmap.height * scale).toInt(),
                true,
            )
        } else bitmap
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 85, out)
        // Recycle intermediate bitmaps to release native memory immediately.
        if (scaled !== bitmap) scaled.recycle()
        bitmap.recycle()
        return out.toByteArray()
    }

    // ── Pending ratings flush (14.9) ──────────────────────────────────────────

    private fun flushPendingRatings() {
        if (pendingRatings.isEmpty()) return
        viewModelScope.launch {
            val snapshot = pendingRatings.toList()
            pendingRatings.clear()
            snapshot.forEach { pending ->
                runCatching { repo.rate(pending.urlId, pending.value) }
                    .onFailure { e ->
                        // Re-queue only if still offline; drop other errors
                        if (e is IOException) pendingRatings.addLast(pending)
                        else Sentry.captureException(e)
                    }
            }
        }
    }

    // ── Local persistence ─────────────────────────────────────────────────────

    private fun loadSavedUrls(): List<SavedUrl> {
        val json = prefs.getString(SAVED_KEY, null) ?: return emptyList()
        return runCatching {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                SavedUrl(url = obj.getString("url"), title = obj.getString("title"))
            }
        }.getOrDefault(emptyList())
    }

    private fun persistSavedUrls(list: List<SavedUrl>) {
        val arr = JSONArray()
        list.forEach { saved ->
            arr.put(org.json.JSONObject().apply {
                put("url", saved.url)
                put("title", saved.title)
            })
        }
        prefs.edit().putString(SAVED_KEY, arr.toString()).apply()
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

