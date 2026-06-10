package app.roam.android
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.lifecycleScope
import app.roam.android.data.supabase
import app.roam.android.ui.screen.CategoryOnboardingScreen
import app.roam.android.ui.screen.MainScreen
import app.roam.android.ui.screen.OnboardingScreen
import app.roam.android.ui.screen.SplashScreen
import app.roam.android.ui.theme.RoamTheme
import app.roam.android.viewmodel.AuthState
import app.roam.android.viewmodel.AuthViewModel
import app.roam.android.viewmodel.MainViewModel
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
private const val TAG = "MainActivity"
class MainActivity : ComponentActivity() {
    companion object {
        // Guards against re-processing the same OAuth callback after configuration changes.
        private var lastHandledAuthUri: String? = null
    }

    private val authVm: AuthViewModel by viewModels()
    private val mainVm: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Wait for Supabase to finish restoring its session from SharedPreferences before
        // attempting the PKCE code exchange. If we call handleDeeplinks() while the Auth
        // plugin is still in Initializing state, the code_verifier hasn't been loaded yet
        // and Supabase throws "both auth code and code verifier should be non-empty".
        lifecycleScope.launch {
            supabase.auth.sessionStatus.first { it !is SessionStatus.Initializing }
            handleDeepLink(intent)
        }
        setContent {
            val authState by authVm.authState.collectAsState()
            val webDarkMode by mainVm.webDarkMode.collectAsState()
            // Force dark theme while on the login/splash screen so enableEdgeToEdge()
            // paints a dark window background rather than the system default white.
            // When authenticated, use the user's webDarkMode preference.
            val forceDark = when (authState) {
                AuthState.Unauthenticated, AuthState.Loading -> true
                AuthState.NeedsOnboarding, AuthState.Authenticated -> webDarkMode
            }
            RoamTheme(darkTheme = forceDark) {
                Log.d(TAG, "AuthState = $authState")
                when (authState) {
                    AuthState.Loading -> SplashScreen()
                    AuthState.Unauthenticated -> OnboardingScreen()
                    AuthState.NeedsOnboarding -> CategoryOnboardingScreen(
                        vm = mainVm,
                        onComplete = { authVm.markOnboardingComplete() },
                    )
                    AuthState.Authenticated -> MainScreen(
                        vm = mainVm,
                        activity = this,
                        onSignOut = { authVm.signOut() },
                    )
                }
            }
        }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }
    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: intent?.getStringExtra("notification_url")?.let { android.net.Uri.parse(it) } ?: return
        val rawUri = uri.toString()
        if (rawUri == lastHandledAuthUri) {
            Log.d(TAG, "Skipping duplicate deep link: $rawUri")
            return
        }
        
        if (uri.scheme == "app.roam.android") {
            lastHandledAuthUri = rawUri
            Log.d(TAG, "Processing auth deep link: $uri")
            lifecycleScope.launch {
                // Ensure Supabase has finished loading session storage before exchanging the
                // PKCE code — the code_verifier must already be in memory at this point.
                supabase.auth.sessionStatus.first { it !is SessionStatus.Initializing }
                if (intent != null) {
                    runCatching { supabase.handleDeeplinks(intent) }
                        .onFailure { e ->
                            Log.e(TAG, "Failed to process auth callback deep link", e)
                            io.sentry.Sentry.captureException(e)
                        }
                    // Consume the deep link so activity recreation doesn't replay the same callback.
                    // Clear the guard so a future sign-out + sign-in with the same URI isn't dropped.
                    intent.data = null
                }
                lastHandledAuthUri = null
            }
        } else {
            // Standard web URL or other deep link (e.g. from notification)
            Log.d(TAG, "Processing non-auth deep link: $uri")
            mainVm.navigateTo(rawUri)
        }
    }
}