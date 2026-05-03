package app.roam.android.ui.screen

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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.roam.android.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: MainViewModel) {
    val skipPaywalled by vm.skipPaywalled.collectAsState()
    val preferredLanguages by vm.preferredLanguages.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Settings") })
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding(),
        ) {
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
                        val updated = if (checked) {
                            preferredLanguages + code
                        } else {
                            preferredLanguages - code
                        }
                        // Always keep at least English
                        vm.setPreferredLanguages(updated.ifEmpty { listOf("en") })
                    },
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
            Text(title, style = MaterialTheme.typography.bodyLarge)
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                )
            }
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}
