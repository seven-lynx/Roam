package app.roam.android.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.util.Log
import app.roam.android.data.repository.RoamRepository
import app.roam.android.data.supabase
import com.google.firebase.messaging.FirebaseMessaging
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

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
                Log.d(TAG, "SessionStatus = $status")
                val next = when (status) {
                    is SessionStatus.Authenticated -> checkOnboarding()
                    is SessionStatus.NotAuthenticated -> AuthState.Unauthenticated
                    SessionStatus.Initializing -> AuthState.Loading
                    is SessionStatus.RefreshFailure -> AuthState.Unauthenticated
                }
                Log.d(TAG, "→ AuthState = $next")
                _authState.value = next

                if (next == AuthState.Authenticated || next == AuthState.NeedsOnboarding) {
                    registerPushToken()
                }
            }
        }
    }

    private fun registerPushToken() {
        viewModelScope.launch {
            runCatching {
                val token = FirebaseMessaging.getInstance().token.await()
                repo.registerPushToken(token)
                Log.d(TAG, "Push token registered successfully")
            }.onFailure { e ->
                Log.e(TAG, "Failed to register push token", e)
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
            Log.d(TAG, "checkOnboarding attempt ${attempt + 1}: categories=$categories, error=${categoriesResult.exceptionOrNull()?.message}")
            if (categories != null) {
                val state = if (categories.isEmpty()) AuthState.NeedsOnboarding else AuthState.Authenticated
                Log.d(TAG, "checkOnboarding resolved → $state (${categories.size} categories)")
                return state
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

    /** Sign out of the current session. Clears server-side tokens and local state.
     *  Suspends until the operation completes so callers can verify the result. */
    suspend fun signOut() {
        try {
            supabase.auth.signOut()
            Log.d(TAG, "Signed out successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Sign out API call failed; clearing local session anyway", e)
            // If the sign-out API call fails (network error, already-expired token, etc.),
            // still clear the local session so the user isn't stuck in an error loop.
            supabase.auth.clearSession()
        }
    }
}
