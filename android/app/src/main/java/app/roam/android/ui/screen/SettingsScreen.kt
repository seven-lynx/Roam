package app.roam.android.ui.screen

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.roam.android.BuildConfig
import app.roam.android.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    vm: MainViewModel,
    onSignOut: () -> Unit,
    onNavigateToSaved: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
) {
    val skipPaywalled by vm.skipPaywalled.collectAsState()
    val preferredLanguages by vm.preferredLanguages.collectAsState()
    val currentUrl by vm.currentUrl.collectAsState()
    val context = LocalContext.current
    var showSignOutDialog by remember { mutableStateOf(false) }
    var showFeedbackDialog by remember { mutableStateOf(false) }
    var feedbackMessage by remember { mutableStateOf("") }
    var feedbackEmail by remember { mutableStateOf("") }
    var feedbackSending by remember { mutableStateOf(false) }
    var feedbackSent by remember { mutableStateOf(false) }
    var feedbackError by remember { mutableStateOf("") }

    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { showSignOutDialog = false },
            title = { Text("Sign out?") },
            text = { Text("You'll need to sign in again to continue using Roam.") },
            confirmButton = {
                TextButton(onClick = {
                    showSignOutDialog = false
                    onSignOut()
                }) { Text("Sign out") }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutDialog = false }) { Text("Cancel") }
            },
        )
    }

    if (showFeedbackDialog) {
        AlertDialog(
            onDismissRequest = {
                if (!feedbackSending) {
                    showFeedbackDialog = false
                    feedbackMessage = ""
                    feedbackEmail = ""
                    feedbackSent = false
                    feedbackError = ""
                }
            },
            title = { Text(if (feedbackSent) "Thanks!" else "Send feedback") },
            text = {
                if (feedbackSent) {
                    Text("Your feedback has been sent.")
                } else {
                    Column {
                        if (feedbackError.isNotEmpty()) {
                            Text(
                                feedbackError,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(bottom = 8.dp),
                            )
                        }
                        OutlinedTextField(
                            value = feedbackMessage,
                            onValueChange = { feedbackMessage = it },
                            label = { Text("Message") },
                            placeholder = { Text("Bug, suggestion, or just saying hi — we read everything.") },
                            minLines = 3,
                            maxLines = 6,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !feedbackSending,
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = feedbackEmail,
                            onValueChange = { feedbackEmail = it },
                            label = { Text("Email (optional)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !feedbackSending,
                        )
                    }
                }
            },
            confirmButton = {
                if (feedbackSent) {
                    TextButton(onClick = {
                        showFeedbackDialog = false
                        feedbackMessage = ""
                        feedbackEmail = ""
                        feedbackSent = false
                    }) { Text("Close") }
                } else {
                    TextButton(
                        enabled = feedbackMessage.isNotBlank() && !feedbackSending,
                        onClick = {
                            feedbackSending = true
                            feedbackError = ""
                            vm.sendFeedback(
                                message = feedbackMessage.trim(),
                                email = feedbackEmail.trim().ifBlank { null },
                            ) { success ->
                                feedbackSending = false
                                if (success) {
                                    feedbackSent = true
                                } else {
                                    feedbackError = "Couldn't send your feedback. Please try again."
                                }
                            }
                        },
                    ) { Text(if (feedbackSending) "Sending…" else "Send") }
                }
            },
            dismissButton = {
                if (!feedbackSent) {
                    TextButton(
                        enabled = !feedbackSending,
                        onClick = {
                            showFeedbackDialog = false
                            feedbackMessage = ""
                            feedbackEmail = ""
                            feedbackError = ""
                        },
                    ) { Text("Cancel") }
                }
            },
        )
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Settings") }) },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding(),
        ) {
            SectionHeader("Account")

            SettingsActionRow(title = "Profile", subtitle = "Edit your name, avatar and categories", onClick = onNavigateToProfile)
            SettingsActionRow(title = "Saved pages", subtitle = "Pages you bookmarked", onClick = onNavigateToSaved)

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Discovery")

            SettingsToggleRow(
                title = "Skip paywalled sites",
                subtitle = "Hide NYT, WSJ, and similar sites",
                checked = skipPaywalled,
                onCheckedChange = { vm.setSkipPaywalled(it) },
            )

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Languages")

            val allLanguages = listOf(
                "en" to "English",
                "fr" to "Français",
                "de" to "Deutsch",
                "it" to "Italiano",
                "es" to "Español",
                "pt" to "Português",
                "nl" to "Nederlands",
                "pl" to "Polski",
                "ja" to "日本語",
                "zh" to "中文",
                "ru" to "Русский",
                "ko" to "한국어",
            )

            allLanguages.forEach { (code, label) ->
                val selected = code in preferredLanguages
                SettingsToggleRow(
                    title = label,
                    subtitle = null,
                    checked = selected,
                    onCheckedChange = { checked ->
                        val updated = if (checked) preferredLanguages + code
                                      else preferredLanguages - code
                        vm.setPreferredLanguages(updated.ifEmpty { listOf("en") })
                    },
                )
            }

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Feedback")

            SettingsActionRow(
                title = "Send feedback",
                subtitle = "Bug, suggestion, or just saying hi",
                onClick = {
                    feedbackMessage = ""
                    feedbackEmail = ""
                    feedbackSent = false
                    feedbackError = ""
                    feedbackSending = false
                    showFeedbackDialog = true
                },
            )

            SettingsActionRow(
                title = "Report dead link",
                subtitle = currentUrl ?: "No page loaded",
                onClick = { vm.reportBrokenLink() },
            )

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Sign out")

            SettingsActionRow(
                title = "Sign out",
                subtitle = null,
                tint = MaterialTheme.colorScheme.error,
                onClick = { showSignOutDialog = true },
            )

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("About")

            SettingsActionRow(
                title = "Privacy policy",
                subtitle = null,
                onClick = {
                    CustomTabsIntent.Builder().build()
                        .launchUrl(context, Uri.parse("https://roamtheweb.app/privacy"))
                },
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Version",
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = BuildConfig.VERSION_NAME,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
    )
}

@Composable
private fun SettingsToggleRow(
    title: String,
    subtitle: String?,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun SettingsActionRow(
    title: String,
    subtitle: String?,
    onClick: () -> Unit,
    tint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, color = tint, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}


