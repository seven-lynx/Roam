package app.roam.android.ui.screen

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import app.roam.android.ui.component.CategoryIconLabel
import app.roam.android.ui.component.SettingsFlavorText
import app.roam.android.ui.component.SettingsToggleRow
import app.roam.android.ui.component.SettingsTopBar
import app.roam.android.viewmodel.MainViewModel

@Composable
fun DiscoveryScreen(
    vm: MainViewModel,
    roamOs: Boolean,
    onNavigateBack: () -> Unit,
) {
    val categories by vm.categories.collectAsState()
    val subcategories by vm.subcategories.collectAsState()
    val focusModeEnabled by vm.focusModeEnabled.collectAsState()
    val focusCategoryId by vm.focusCategoryId.collectAsState()
    val focusSubcategoryId by vm.focusSubcategoryId.collectAsState()
    val skipPaywalled by vm.skipPaywalled.collectAsState()

    var focusCategoryDropdownExpanded by remember { mutableStateOf(false) }
    var focusSubcategoryDropdownExpanded by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            SettingsTopBar(
                title = if (roamOs) "SCAN // DISCOVERY" else "Discovery",
                roamOs = roamOs,
                onNavigateBack = onNavigateBack,
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(innerPadding).verticalScroll(rememberScrollState()).navigationBarsPadding(),
        ) {
            if (roamOs) {
                SettingsFlavorText("Configure the roam-scanner's search and focus parameters.")
            }

            SettingsToggleRow("Focus mode", "Roam within a specific topic", focusModeEnabled) { vm.setFocusMode(it) }

            if (focusModeEnabled) {
                val focusCategory = categories.firstOrNull { it.id == focusCategoryId }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Category", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    Box {
                        OutlinedButton(onClick = { focusCategoryDropdownExpanded = true }) {
                            if (focusCategory != null) CategoryIconLabel(focusCategory.icon, focusCategory.name) else Text("Pick one...")
                        }
                        DropdownMenu(expanded = focusCategoryDropdownExpanded, onDismissRequest = { focusCategoryDropdownExpanded = false }) {
                            categories.forEach { cat ->
                                DropdownMenuItem(text = { CategoryIconLabel(cat.icon, cat.name) }, onClick = { vm.setFocusCategory(cat.id); focusCategoryDropdownExpanded = false })
                            }
                        }
                    }
                }

                if (focusCategoryId != null) {
                    val filteredSubcats = subcategories.filter { it.categoryId == focusCategoryId }
                    val focusSubcat = filteredSubcats.firstOrNull { it.id == focusSubcategoryId }
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Topic", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                        Box {
                            OutlinedButton(onClick = { focusSubcategoryDropdownExpanded = true }) { Text(focusSubcat?.name ?: "All") }
                            DropdownMenu(expanded = focusSubcategoryDropdownExpanded, onDismissRequest = { focusSubcategoryDropdownExpanded = false }) {
                                DropdownMenuItem(text = { Text("All") }, onClick = { vm.setFocusSubcategory(null); focusSubcategoryDropdownExpanded = false })
                                filteredSubcats.forEach { sub ->
                                    DropdownMenuItem(text = { Text(sub.name) }, onClick = { vm.setFocusSubcategory(sub.id); focusSubcategoryDropdownExpanded = false })
                                }
                            }
                        }
                    }
                }
            }

            SettingsToggleRow("Skip paywalled sites", "Hide NYT, WSJ, and similar sites", skipPaywalled) { vm.setSkipPaywalled(it) }
        }
    }
}
