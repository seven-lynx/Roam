package app.roam.android.viewmodel

import android.app.Application
import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.roam.android.data.repository.RoamRepository
import app.roam.android.model.CategoryItem
import app.roam.android.model.Collection
import app.roam.android.model.RoamUrl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONArray

sealed interface RoamState {
    data object Idle : RoamState
    data object Loading : RoamState
    data class Loaded(val roamUrl: RoamUrl) : RoamState
    data object Exhausted : RoamState  // 404 — user has seen everything
    data class Error(val message: String) : RoamState
}

data class SavedUrl(val url: String, val title: String)

class MainViewModel(
    application: Application,
    private val repo: RoamRepository = RoamRepository(),
) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences("roam_saved", Context.MODE_PRIVATE)
    private val SAVED_KEY = "saved_urls"

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

    /** User preference: list of language codes to include (e.g. ["en", "fr"]) */
    private val _preferredLanguages = MutableStateFlow(listOf("en"))
    val preferredLanguages: StateFlow<List<String>> = _preferredLanguages.asStateFlow()

    /** Available categories (starts as hardcoded fallback, replaced by DB data on init) */
    private val _categories = MutableStateFlow(CategoryItem.FALLBACK)
    val categories: StateFlow<List<CategoryItem>> = _categories.asStateFlow()

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
            }
        }
    }

    fun roam(excludeDomain: String? = null) {
        viewModelScope.launch {
            _state.value = RoamState.Loading
            runCatching {
                repo.roam(
                    collectionId = _activeCollectionId.value,
                    excludeDomain = excludeDomain,
                )
            }.onSuccess { result ->
                if (result == null) {
                    _state.value = RoamState.Exhausted
                } else {
                    _currentUrl.value = result.url
                    _state.value = RoamState.Loaded(result)
                }
            }.onFailure { e ->
                _state.value = RoamState.Error(e.message ?: "Something went wrong. Please try again.")
            }
        }
    }

    fun thumbsUp(context: Context) {
        val loaded = _state.value as? RoamState.Loaded ?: run {
            // Unknown page — show submit sheet
            _showSubmitSheet.value = true
            return
        }
        viewModelScope.launch {
            haptic(context)
            runCatching { repo.rate(loaded.roamUrl.id, 1) }
            roam(excludeDomain = extractDomain(_currentUrl.value))
        }
    }

    fun thumbsDown(context: Context) {
        val loaded = _state.value as? RoamState.Loaded
        viewModelScope.launch {
            haptic(context)
            if (loaded != null) {
                runCatching { repo.rate(loaded.roamUrl.id, -1) }
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

    fun setCollectionFilter(collectionId: String?) {
        _activeCollectionId.value = collectionId
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
        val entry = SavedUrl(url = url, title = title)
        val current = _savedUrls.value
        if (current.none { it.url == url }) {
            val updated = listOf(entry) + current   // Newest first
            _savedUrls.value = updated
            persistSavedUrls(updated)
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
    }

    fun openAddToCollection() {
        viewModelScope.launch {
            runCatching { _collections.value = repo.getCollections() }
        }
        _showAddToCollection.value = true
    }
    fun closeAddToCollection() { _showAddToCollection.value = false }

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
        // Use the subcategory of the current page if known; fall back to global roam
        val categoryId = loaded?.roamUrl?.subcategoryId
        _showConfigSheet.value = false
        viewModelScope.launch {
            _state.value = RoamState.Loading
            runCatching {
                repo.roam(collectionId = null, excludeDomain = extractDomain(_currentUrl.value))
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
}

