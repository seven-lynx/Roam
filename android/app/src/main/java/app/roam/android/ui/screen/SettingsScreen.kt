package app.roam.android.ui.screen

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.OutlinedButton
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
    val webDarkMode by vm.webDarkMode.collectAsState()
    val autoTranslate by vm.autoTranslate.collectAsState()
    val translateLanguage by vm.translateLanguage.collectAsState()
    val currentUrl by vm.currentUrl.collectAsState()
    val savedConfirmation by vm.savedConfirmation.collectAsState()
    val jsEnabled by vm.jsEnabled.collectAsState()
    val context = LocalContext.current
    var showSignOutDialog by remember { mutableStateOf(false) }
    var translateDropdownExpanded by remember { mutableStateOf(false) }
    val translateLanguages = listOf(
        "en" to "English", "fr" to "Français", "de" to "Deutsch",
        "it" to "Italiano", "es" to "Español", "pt" to "Português",
        "nl" to "Nederlands", "pl" to "Polski", "ja" to "日本語",
        "zh" to "中文", "ru" to "Русский", "ko" to "한국어",
    )
    val translateLanguageLabel = translateLanguages.firstOrNull { it.first == translateLanguage }?.second ?: "English"

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
            SettingsActionRow(
                title = "Bookmark this page",
                subtitle = if (savedConfirmation) "Saved!" else currentUrl ?: "No page loaded",
                onClick = { vm.saveForLater() },
            )

            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Navigation")

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(onClick = { vm.webNavBack() },    modifier = Modifier.weight(1f)) { Text("← Back") }
                OutlinedButton(onClick = { vm.webNavForward() }, modifier = Modifier.weight(1f)) { Text("Forward →") }
                OutlinedButton(onClick = { vm.webNavReload() },  modifier = Modifier.weight(1f)) { Text("↻ Reload") }
            }

            Spacer(Modifier.height(8.dp))
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))

            SectionHeader("Browser")

            SettingsToggleRow(
                title = "Dark mode",
                subtitle = "Apply dark theme to web pages",
                checked = webDarkMode,
                onCheckedChange = { vm.setWebDarkMode(it) },
            )

            SettingsToggleRow(
                title = "Auto-translate",
                subtitle = "Translate pages via Google Translate",
                checked = autoTranslate,
                onCheckedChange = { vm.setAutoTranslate(it) },
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Translate to", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                Box {
                    OutlinedButton(onClick = { translateDropdownExpanded = !translateDropdownExpanded }) {
                        Text(translateLanguageLabel)
                    }
                    DropdownMenu(
                        expanded = translateDropdownExpanded,
                        onDismissRequest = { translateDropdownExpanded = false },
                    ) {
                        translateLanguages.forEach { (code, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    vm.setTranslateLanguage(code)
                                    translateDropdownExpanded = false
                                },
                            )
                        }
                    }
                }
            }

            SettingsToggleRow(
                title = "JavaScript",
                subtitle = "Disable to reduce tracking on sites you browse",
                checked = jsEnabled,
                onCheckedChange = { vm.setJsEnabled(it) },
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Delete cookies", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        "Clear all cookies and site data",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                }
                OutlinedButton(onClick = { vm.clearCookies() }) { Text("Clear") }
            }

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

            SectionHeader("Feedback")

            SettingsActionRow(
                title = "Send feedback",
                subtitle = "Tell us what you think",
                onClick = {
                    val intent = Intent(Intent.ACTION_SENDTO).apply {
                        data = Uri.parse("mailto:hello@roamtheweb.app")
                        putExtra(Intent.EXTRA_SUBJECT, "Roam feedback")
                    }
                    context.startActivity(Intent.createChooser(intent, "Send feedback"))
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


