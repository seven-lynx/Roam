package app.roam.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.util.Log
import app.roam.android.data.repository.RoamRepository
import app.roam.android.data.supabase
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.delay
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

    private companion object {
        private const val TAG = "AuthViewModel"
    }

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
        // Session/auth state can flip to Authenticated slightly before user/category reads stabilize.
        repeat(4) { attempt ->
            val categoriesResult = runCatching { repo.getUserCategoryIds() }
            val categories = categoriesResult.getOrNull()
            if (categories != null) {
                return if (categories.isEmpty()) AuthState.NeedsOnboarding else AuthState.Authenticated
            }

            Log.w(TAG, "Onboarding check attempt ${attempt + 1} failed; retrying", categoriesResult.exceptionOrNull())
            delay(250)
        }

        // Fail open to the main app if onboarding status cannot be fetched after retries.
        Log.w(TAG, "Failed to check onboarding status after retries; continuing as authenticated")
        return AuthState.Authenticated
    }

    /** Called once onboarding/category selection is complete. */
    fun markOnboardingComplete() {
        _authState.value = AuthState.Authenticated
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching { supabase.auth.signOut() }
        }
    }
}
