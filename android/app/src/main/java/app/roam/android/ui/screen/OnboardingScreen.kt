package app.roam.android.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.roam.android.data.supabase
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import kotlinx.coroutines.launch

/**
 * Shown when the user has no valid session.
 * User taps "Connect with Google" to initiate Supabase OAuth, which opens a Chrome
 * Custom Tab and redirects back via app.roam.android://callback on completion.
 */
@Composable
fun OnboardingScreen() {
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Roam",
            style = MaterialTheme.typography.displayLarge,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Discover the internet, one page at a time.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f),
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(48.dp))
        Button(
            onClick = {
                scope.launch {
                    runCatching { supabase.auth.signInWith(Google) }
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
        ) {
            Text("Connect with Google")
        }
    }
}