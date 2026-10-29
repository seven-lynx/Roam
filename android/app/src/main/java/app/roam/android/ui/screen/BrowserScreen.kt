package app.roam.android.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.roam.android.ui.component.AVAILABLE_LANGUAGES
import app.roam.android.ui.component.SettingsFlavorText
import app.roam.android.ui.component.SettingsToggleRow
import app.roam.android.ui.component.SettingsTopBar
import app.roam.android.ui.component.TRANSLATE_LANGUAGES
import app.roam.android.viewmodel.MainViewModel

@Composable
fun BrowserScreen(
    vm: MainViewModel,
    roamOs: Boolean,
    onNavigateBack: () -> Unit,
) {
    val preferredLanguages by vm.preferredLanguages.collectAsState()
    val webDarkMode by vm.webDarkMode.collectAsState()
    val autoTranslate by vm.autoTranslate.collectAsState()
    val translateLanguage by vm.translateLanguage.collectAsState()
    val jsEnabled by vm.jsEnabled.collectAsState()
    val prefetchWebView by vm.prefetchWebView.collectAsState()
    val sheetGestureMode by vm.sheetGestureMode.collectAsState()

    var languageFilterDropdownExpanded by remember { mutableStateOf(false) }
    var translateDropdownExpanded by remember { mutableStateOf(false) }
    var sheetGestureDropdownExpanded by remember { mutableStateOf(false) }

    val translateLanguageLabel = TRANSLATE_LANGUAGES.firstOrNull { it.first == translateLanguage }?.second ?: "English"

    Scaffold(
        topBar = {
            SettingsTopBar(
                title = if (roamOs) "NET // BROWSER" else "Browser",
                roamOs = roamOs,
                onNavigateBack = onNavigateBack,
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(innerPadding).verticalScroll(rememberScrollState()).navigationBarsPadding(),
        ) {
            if (roamOs) {
                SettingsFlavorText("Tune the data-fetch layer: language filters, rendering, gateways.")
            }

            // Preferred languages for discovery filtering
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Preferred languages", style = MaterialTheme.typography.bodyLarge)
                    Text("Select which languages you want to see", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                }
                Box {
                    val selectedLabel = if (preferredLanguages.size == AVAILABLE_LANGUAGES.size) "All"
                        else if (preferredLanguages.isEmpty()) "None" else "${preferredLanguages.size}"
                    OutlinedButton(onClick = { languageFilterDropdownExpanded = !languageFilterDropdownExpanded }) { Text(selectedLabel) }
                    DropdownMenu(expanded = languageFilterDropdownExpanded, onDismissRequest = { languageFilterDropdownExpanded = false }) {
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable {
                                val newLangs = if (preferredLanguages.size == AVAILABLE_LANGUAGES.size) listOf("en") else AVAILABLE_LANGUAGES.map { it.first }
                                vm.setPreferredLanguages(newLangs)
                            }.padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(
                                checked = preferredLanguages.size == AVAILABLE_LANGUAGES.size,
                                onCheckedChange = { isChecked ->
                                    val newLangs = if (isChecked) AVAILABLE_LANGUAGES.map { it.first } else listOf("en")
                                    vm.setPreferredLanguages(newLangs)
                                },
                            )
                            Text("All languages", modifier = Modifier.padding(start = 8.dp))
                        }
                        HorizontalDivider()
                        AVAILABLE_LANGUAGES.forEach { (code, label) ->
                            Row(
                                modifier = Modifier.fillMaxWidth().clickable {
                                    val newLangs = if (preferredLanguages.contains(code)) preferredLanguages - code else preferredLanguages + code
                                    vm.setPreferredLanguages(newLangs)
                                }.padding(horizontal = 16.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Checkbox(
                                    checked = preferredLanguages.contains(code),
                                    onCheckedChange = { isChecked ->
                                        val newLangs = if (isChecked) preferredLanguages + code else preferredLanguages - code
                                        vm.setPreferredLanguages(newLangs)
                                    },
                                )
                                Text(label, modifier = Modifier.padding(start = 8.dp))
                            }
                        }
                    }
                }
            }

            SettingsToggleRow("Dark mode", "Apply dark theme to web pages", webDarkMode) { vm.setWebDarkMode(it) }

            SettingsToggleRow("Auto-translate", "Translate pages via Google Translate", autoTranslate) {
                vm.setAutoTranslate(it)
                translateDropdownExpanded = false
            }

            if (autoTranslate) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Translate to", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    Box {
                        OutlinedButton(onClick = { translateDropdownExpanded = !translateDropdownExpanded }) { Text(translateLanguageLabel) }
                        DropdownMenu(expanded = translateDropdownExpanded, onDismissRequest = { translateDropdownExpanded = false }) {
                            TRANSLATE_LANGUAGES.forEach { (code, label) ->
                                DropdownMenuItem(text = { Text(label) }, onClick = { vm.setTranslateLanguage(code); translateDropdownExpanded = false })
                            }
                        }
                    }
                }
            }

            SettingsToggleRow("JavaScript", "Disable to reduce tracking on sites you browse", jsEnabled) { vm.setJsEnabled(it) }
            SettingsToggleRow("Preload next page", "Loads the next URL in the background - uses more data", prefetchWebView) { vm.setPrefetchWebView(it) }

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Menu gesture", style = MaterialTheme.typography.bodyLarge)
                    Text("How to open the menu", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                }
                Box {
                    OutlinedButton(onClick = { sheetGestureDropdownExpanded = true }) { Text(if (sheetGestureMode == "slide") "Slide up" else "Tap handle") }
                    DropdownMenu(expanded = sheetGestureDropdownExpanded, onDismissRequest = { sheetGestureDropdownExpanded = false }) {
                        DropdownMenuItem(text = { Text("Slide up") }, onClick = { vm.setSheetGestureMode("slide"); sheetGestureDropdownExpanded = false })
                        DropdownMenuItem(text = { Text("Tap handle") }, onClick = { vm.setSheetGestureMode("tap"); sheetGestureDropdownExpanded = false })
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Delete cookies", style = MaterialTheme.typography.bodyLarge)
                    Text("Clear all cookies and site data", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                }
                OutlinedButton(onClick = { vm.clearCookies() }) { Text("Clear") }
            }
        }
    }
}