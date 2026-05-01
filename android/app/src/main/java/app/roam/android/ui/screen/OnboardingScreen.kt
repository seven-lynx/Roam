package app.roam.android.ui.screen

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext

private const val ONBOARDING_URL = "https://roam-flame.vercel.app/join"

/**
 * Shown when the user has no valid session.
 * Opens the web onboarding page in a Chrome Custom Tab immediately.
 * The Custom Tab returns to the app via the deep link app.roam.android://callback
 * which Supabase Auth picks up automatically.
 */
@Composable
fun OnboardingScreen() {
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        val intent = CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
        intent.launchUrl(context, Uri.parse(ONBOARDING_URL))
    }

    // Show a spinner while the Custom Tab is opening
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
