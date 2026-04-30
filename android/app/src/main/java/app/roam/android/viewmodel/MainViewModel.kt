package app.roam.android.viewmodel

import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.roam.android.data.repository.RoamRepository
import app.roam.android.model.RoamUrl
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface RoamState {
    data object Idle : RoamState
    data object Loading : RoamState
    data class Loaded(val roamUrl: RoamUrl) : RoamState
    data object Exhausted : RoamState  // 404 — user has seen everything
    data class Error(val message: String) : RoamState
}

class MainViewModel(
    private val repo: RoamRepository = RoamRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<RoamState>(RoamState.Idle)
    val state: StateFlow<RoamState> = _state.asStateFlow()

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

    init {
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
                _state.value = RoamState.Error(e.message ?: "Unknown error")
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

    private fun extractDomain(url: String?): String? {
        url ?: return null
        return runCatching {
            android.net.Uri.parse(url).host?.removePrefix("www.")
        }.getOrNull()
    }
}

