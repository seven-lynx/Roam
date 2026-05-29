package app.roam.android.ui.screen

import android.util.Log
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.roam.android.data.supabase
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.launch

private const val TAG = "OnboardingScreen"

@Composable
fun OnboardingScreen() {
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    var showEmailForm by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Roam",
            style = MaterialTheme.typography.displayLarge,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Discover the internet,\none page at a time.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(56.dp))

        // ── Google sign-in ────────────────────────────────────────────────────
        Button(
            onClick = {
                errorMessage = null
                scope.launch {
                    isLoading = true
                    val result = runCatching { supabase.auth.signInWith(Google) }
                    isLoading = false
                    result.onFailure { e ->
                        Log.e(TAG, "Google sign-in failed", e)
                        errorMessage = "Couldn't open Google sign-in. Please try again."
                    }
                }
            },
            enabled = !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
        ) {
            Text(if (isLoading) "Opening…" else "Continue with Google")
        }

        // ── Email form (expands inline) ───────────────────────────────────────
        AnimatedVisibility(
            visible = showEmailForm,
            enter = expandVertically() + fadeIn(),
        ) {
            Column {
                Spacer(Modifier.height(24.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it; errorMessage = null },
                    label = { Text("Email") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next,
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focusManager.moveFocus(FocusDirection.Down) },
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it; errorMessage = null },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = { focusManager.clearFocus() },
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OutlinedButton(
                        onClick = {
                            errorMessage = null
                            scope.launch {
                                isLoading = true
                                val result = runCatching {
                                    supabase.auth.signUpWith(Email) {
                                        this.email = email.trim()
                                        this.password = password
                                    }
                                }
                                isLoading = false
                                result.onFailure { e ->
                                    Log.e(TAG, "Email sign-up failed", e)
                                    errorMessage = e.message ?: "Sign-up failed. Please try again."
                                }
                            }
                        },
                        enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                    ) {
                        Text(if (isLoading) "Creating…" else "Create Account")
                    }
                    Button(
                        onClick = {
                            errorMessage = null
                            scope.launch {
                                isLoading = true
                                val result = runCatching {
                                    supabase.auth.signInWith(Email) {
                                        this.email = email.trim()
                                        this.password = password
                                    }
                                }
                                isLoading = false
                                result.onFailure { e ->
                                    Log.e(TAG, "Email sign-in failed", e)
                                    errorMessage = when {
                                        e.message?.contains("Invalid login") == true ||
                                        e.message?.contains("invalid_grant") == true ->
                                            "Incorrect email or password."
                                        e.message?.contains("Email not confirmed") == true ->
                                            "Please verify your email first."
                                        else -> e.message ?: "Sign-in failed. Please try again."
                                    }
                                }
                            }
                        },
                        enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                    ) {
                        Text(if (isLoading) "Signing in…" else "Sign In")
                    }
                }
            }
        }

        if (!showEmailForm) {
            // ── "or" divider + email button ───────────────────────────────────
            Spacer(Modifier.height(24.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                HorizontalDivider(modifier = Modifier.weight(1f))
                Text(
                    text = "or",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                )
                HorizontalDivider(modifier = Modifier.weight(1f))
            }
            Spacer(Modifier.height(16.dp))
            OutlinedButton(
                onClick = { showEmailForm = true; errorMessage = null },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
            ) {
                Text("Continue with Email")
            }
        } else {
            Spacer(Modifier.height(8.dp))
            TextButton(
                onClick = {
                    showEmailForm = false
                    email = ""
                    password = ""
                    errorMessage = null
                },
            ) {
                Text("← Back to Google sign-in")
            }
        }

        // ── Error message ─────────────────────────────────────────────────────
        errorMessage?.let { msg ->
            Spacer(Modifier.height(16.dp))
            Text(
                text = msg,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                textAlign = TextAlign.Center,
            )
        }
    }
}