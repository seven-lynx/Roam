package app.roam.android

import android.content.Intent
import android.os.Bundle
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
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import kotlinx.coroutines.launch


class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Handle deep link if the activity was started by the auth callback
        handleDeepLink(intent)
        setContent {
            RoamTheme {
                val authVm: AuthViewModel = viewModel()
                val authState by authVm.authState.collectAsState()
                when (authState) {
                    AuthState.Loading -> SplashScreen()
                    AuthState.Unauthenticated -> OnboardingScreen()
                    AuthState.NeedsOnboarding -> {
                        val mainVm: MainViewModel = viewModel()
                        CategoryOnboardingScreen(
                            vm = mainVm,
                            onComplete = { authVm.markOnboardingComplete() },
                        )
                    }
                    AuthState.Authenticated -> {
                        val mainVm: MainViewModel = viewModel()
                        MainScreen(
                            vm = mainVm,
                            activity = this,
                            onSignOut = { authVm.signOut() },
                        )
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme == "app.roam.android" && uri.host == "callback") {
            // supabase-kt v3: handleDeeplinks handles both PKCE (code) and implicit (fragment) flows
            lifecycleScope.launch {
                runCatching { supabase.handleDeeplinks(intent) }
            }
        }
    }
}

