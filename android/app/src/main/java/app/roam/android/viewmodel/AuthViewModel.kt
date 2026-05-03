package app.roam.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.roam.android.data.repository.RoamRepository
import app.roam.android.data.supabase
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AuthState {
    /** Still determining — show a splash/loading indicator */
    data object Loading : AuthState
    /** Valid session exists — show the main screen */
    data object Authenticated : AuthState
    /** No session — redirect to onboarding */
    data object Unauthenticated : AuthState
    /** Authenticated but no interest categories set yet — show native category picker */
    data object NeedsOnboarding : AuthState
}

class AuthViewModel(
    private val repo: RoamRepository = RoamRepository(),
) : ViewModel() {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Loading)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    init {
        viewModelScope.launch {
            supabase.auth.sessionStatus.collect { status ->
                _authState.value = when (status) {
                    is SessionStatus.Authenticated -> checkOnboarding()
                    is SessionStatus.NotAuthenticated -> AuthState.Unauthenticated
                    SessionStatus.Initializing -> AuthState.Loading
                    is SessionStatus.RefreshFailure -> AuthState.Unauthenticated
                }
            }
        }
    }

    /**
     * Checks whether the newly-authenticated user has selected any interest categories.
     * Returns [AuthState.NeedsOnboarding] if not, [AuthState.Authenticated] if yes.
     */
    private suspend fun checkOnboarding(): AuthState {
        val categories = runCatching { repo.getUserCategoryIds() }.getOrDefault(emptySet())
        return if (categories.isEmpty()) AuthState.NeedsOnboarding else AuthState.Authenticated
    }

    /** Called by [CategoryOnboardingScreen] once the user has saved their categories. */
    fun markOnboardingComplete() {
        _authState.value = AuthState.Authenticated
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching { supabase.auth.signOut() }
        }
    }
}
