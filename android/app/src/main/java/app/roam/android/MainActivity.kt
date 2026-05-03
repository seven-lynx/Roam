package app.roam.android
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import app.roam.android.data.supabase
import app.roam.android.ui.screen.CategoryOnboardingScreen
import app.roam.android.ui.screen.MainScreen
import app.roam.android.ui.screen.OnboardingScreen
import app.roam.android.ui.screen.SplashScreen
import app.roam.android.ui.theme.RoamTheme
import app.roam.android.viewmodel.AuthState
import app.roam.android.viewmodel.AuthViewModel
import app.roam.android.viewmodel.MainViewModel
import io.github.jan.supabase.auth.handleDeeplinks
import kotlinx.coroutines.launch
private const val TAG = "MainActivity"
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleDeepLink(intent)
        setContent {
            RoamTheme {
                val authVm: AuthViewModel = viewModel()
                val mainVm: MainViewModel = viewModel()
                val authState by authVm.authState.collectAsState()
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
        val uri = intent?.data ?: return
        if (uri.scheme == "app.roam.android") {
            Log.d(TAG, "Processing auth deep link: $uri")
            lifecycleScope.launch {
                runCatching { supabase.handleDeeplinks(intent) }
                    .onFailure { Log.e(TAG, "Failed to process auth callback deep link", it) }
            }
        }
    }
}