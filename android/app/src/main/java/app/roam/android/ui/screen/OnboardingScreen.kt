package app.roam.android.ui.screen
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.roam.android.data.supabase
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.launch
private val DarkBg = Color(0xFF0F0F0F)
private val OnDark = Color(0xFFEEEEEE)
private val OnDarkMuted = Color(0xFF999999)
@Composable
fun OnboardingScreen() {
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isSignUp by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 32.dp, vertical = 64.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Roam",
            style = MaterialTheme.typography.displayLarge,
            color = OnDark,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Discover the internet, one page at a time.",
            style = MaterialTheme.typography.bodyLarge,
            color = OnDarkMuted,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(48.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it; errorMessage = null },
            label = { Text("Email", color = OnDarkMuted) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it; errorMessage = null },
            label = { Text("Password", color = OnDarkMuted) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        if (errorMessage != null) {
            Spacer(Modifier.height(4.dp))
            Text(
                text = errorMessage!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                scope.launch {
                    runCatching {
                        if (isSignUp) {
                            supabase.auth.signUpWith(Email) {
                                this.email = email.trim()
                                this.password = password
                            }
                        } else {
                            supabase.auth.signInWith(Email) {
                                this.email = email.trim()
                                this.password = password
                            }
                        }
                    }.onFailure { e -> errorMessage = e.message ?: "Sign in failed" }
                }
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Text(if (isSignUp) "Sign Up" else "Sign In")
        }
        TextButton(onClick = { isSignUp = !isSignUp; errorMessage = null }) {
            Text(
                text = if (isSignUp) "Already have an account? Sign In" else "No account? Sign Up",
                color = OnDarkMuted,
            )
        }
        Spacer(Modifier.height(16.dp))
        HorizontalDivider(color = Color(0xFF333333))
        Spacer(Modifier.height(16.dp))
        OutlinedButton(
            onClick = {
                scope.launch {
                    runCatching { supabase.auth.signInWith(Google) }
                }
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Text("Continue with Google", color = OnDark)
        }
        Spacer(Modifier.height(32.dp))
    }
}