package app.roam.android.ui.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ElevatedFilterChip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.roam.android.model.Collection
import app.roam.android.model.SavedUrl

private data class Language(val code: String, val label: String)

private val LANGUAGES = listOf(
    Language("en", "English"),
    Language("fr", "Français"),
    Language("de", "Deutsch"),
    Language("it", "Italiano"),
    Language("es", "Español"),
    Language("pt", "Português"),
    Language("nl", "Nederlands"),
    Language("pl", "Polski"),
    Language("ja", "日本語"),
    Language("zh", "中文"),
    Language("ru", "Русский"),
    Language("ko", "한국어"),
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ConfigBottomSheet(
    currentUrl: String?,
    skipPaywalled: Boolean,
    preferredLanguages: List<String>,
    collections: List<Collection>,
    savedUrls: List<SavedUrl>,
    onDismiss: () -> Unit,
    onSaveForLater: () -> Unit,
    onShare: () -> Unit,
    onAddToCollection: (collectionId: String) -> Unit,
    onCreateCollectionAndAdd: (name: String) -> Unit,
    onRoamWithinCategory: () -> Unit,
    onRoamCollection: (collectionId: String) -> Unit,
    onManageCollections: () -> Unit,
    onCategoryPrefs: () -> Unit,
    onSkipPaywalledChange: (Boolean) -> Unit,
    onLanguagesChange: (List<String>) -> Unit,
    onRemoveSavedUrl: (url: String) -> Unit,
    onReportBrokenLink: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var langPickerOpen by remember { mutableStateOf(false) }
    var collectionPickerOpen by remember { mutableStateOf(false) }
    var collectionPickerMode by remember { mutableStateOf("add") } // "add" or "roam"
    var newCollectionDialogOpen by remember { mutableStateOf(false) }
    var newCollectionName by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(bottom = 16.dp),
        ) {
            // ── Section 1: Current page ──────────────────────────────────────
            Text(
                text = "Current page",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )

            TextButton(
                onClick = onSaveForLater,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text("Save for later", modifier = Modifier.fillMaxWidth())
            }

            TextButton(
                onClick = onShare,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text("Share", modifier = Modifier.fillMaxWidth())
            }

            TextButton(
                onClick = { collectionPickerMode = "add"; collectionPickerOpen = true },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text("Add to collection…", modifier = Modifier.fillMaxWidth())
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(modifier = Modifier.height(8.dp))

            // ── Section 2: Roam mode ─────────────────────────────────────────
            Text(
                text = "Roam mode",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )

            // Roam scope actions
            TextButton(
                onClick = onRoamWithinCategory,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text("Roam within this category", modifier = Modifier.fillMaxWidth())
            }

            TextButton(
                onClick = {
                    if (collections.isEmpty()) Unit
                    else { collectionPickerMode = "roam"; collectionPickerOpen = true }
                },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text("Roam a collection…", modifier = Modifier.fillMaxWidth())
            }

            TextButton(
                onClick = onManageCollections,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text("Manage collections ↗", modifier = Modifier.fillMaxWidth())
            }

            TextButton(
                onClick = onCategoryPrefs,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text("Category preferences ↗", modifier = Modifier.fillMaxWidth())
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Skip paywalled sites toggle
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Skip paywalled sites",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        "Hide NYT, WSJ, and similar",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    )
                }
                Switch(
                    checked = skipPaywalled,
                    onCheckedChange = onSkipPaywalledChange,
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Languages row — tap to expand chip picker
            TextButton(
                onClick = { langPickerOpen = !langPickerOpen },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Languages")
                    val summary = preferredLanguages
                        .mapNotNull { code -> LANGUAGES.find { it.code == code }?.label }
                        .joinToString(", ")
                        .ifEmpty { "English" }
                    Text(
                        summary,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                }
            }

            if (langPickerOpen) {
                FlowRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    LANGUAGES.forEach { lang ->
                        val selected = preferredLanguages.contains(lang.code)
                        ElevatedFilterChip(
                            selected = selected,
                            onClick = {
                                val updated = if (selected) {
                                    // Never allow deselecting the last language
                                    if (preferredLanguages.size > 1) {
                                        preferredLanguages - lang.code
                                    } else {
                                        preferredLanguages
                                    }
                                } else {
                                    preferredLanguages + lang.code
                                }
                                onLanguagesChange(updated)
                            },
                            label = { Text(lang.label, style = MaterialTheme.typography.bodySmall) },
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            TextButton(
                onClick = onReportBrokenLink,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text(
                    "Report broken link",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            TextButton(
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text(
                    "Sign out",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            // ── Section 4: Saved for later ───────────────────────────────────
            if (savedUrls.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Saved for later",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
                savedUrls.forEach { saved ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = saved.title,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                            )
                            Text(
                                text = saved.url,
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                                maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                            )
                        }
                        IconButton(onClick = { onRemoveSavedUrl(saved.url) }) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Remove",
                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                            )
                        }
                    }
                }
            }
        }
    }

    // ── Collection picker dialog (Add to collection OR Roam a collection) ──
    if (collectionPickerOpen) {
        AlertDialog(
            onDismissRequest = { collectionPickerOpen = false },
            title = { Text(if (collectionPickerMode == "roam") "Roam a collection" else "Choose a collection") },
            text = {
                Column {
                    collections.forEach { col ->
                        TextButton(
                            onClick = {
                                collectionPickerOpen = false
                                if (collectionPickerMode == "roam") onRoamCollection(col.id)
                                else onAddToCollection(col.id)
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(col.name, modifier = Modifier.fillMaxWidth())
                        }
                    }
                    if (collectionPickerMode == "add") {
                        TextButton(
                            onClick = {
                                collectionPickerOpen = false
                                newCollectionDialogOpen = true
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("+ New collection", modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { collectionPickerOpen = false }) { Text("Cancel") }
            },
        )
    }

    // ── New-collection dialog ──────────────────────────────────────────────
    if (newCollectionDialogOpen) {
        AlertDialog(
            onDismissRequest = { newCollectionDialogOpen = false },
            title = { Text("New collection") },
            text = {
                OutlinedTextField(
                    value = newCollectionName,
                    onValueChange = { newCollectionName = it },
                    label = { Text("Name") },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newCollectionName.isNotBlank()) {
                            onCreateCollectionAndAdd(newCollectionName.trim())
                            newCollectionName = ""
                            newCollectionDialogOpen = false
                        }
                    },
                ) { Text("Create & add") }
            },
            dismissButton = {
                TextButton(onClick = { newCollectionDialogOpen = false; newCollectionName = "" }) {
                    Text("Cancel")
                }
            },
        )
    }
}

