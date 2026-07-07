package app.roam.android.ui.component

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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

@Composable
fun ConfigBottomSheet(
    currentUrl: String?,
    collections: List<Collection>,
    savedUrls: List<SavedUrl>,
    isTranslated: Boolean,
    onToggleTranslation: () -> Unit,
    onTranslate: (language: String) -> Unit,
    onSaveForLater: () -> Unit,
    onShare: () -> Unit,
    onShareWithFriend: () -> Unit = {},
    onAddToCollection: (collectionId: String) -> Unit,
    onCreateCollectionAndAdd: (name: String) -> Unit,
    onRoamWithinCategory: () -> Unit,
    onRoamCollection: (collectionId: String) -> Unit,
    onManageCollections: () -> Unit,
    onCategoryPrefs: () -> Unit,
    onNavBack: () -> Unit,
    onNavForward: () -> Unit,
    onNavReload: () -> Unit,
    onRemoveSavedUrl: (url: String) -> Unit,
    onReportBrokenLink: () -> Unit,
    onNavigateSavedUrl: (url: String) -> Unit,
    adminModeEnabled: Boolean = false,
    isModerator: Boolean = false,
    moderatorModeEnabled: Boolean = false,
    onAdminNavigateToUrl: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var collectionPickerOpen by remember { mutableStateOf(false) }
    var collectionPickerMode by remember { mutableStateOf("add") } // "add" or "roam"
    var newCollectionDialogOpen by remember { mutableStateOf(false) }
    var newCollectionName by remember { mutableStateOf("") }
    var translateDialogOpen by remember { mutableStateOf(false) }
    var adminUrlInput by remember { mutableStateOf("") }

    // Language list for the translate picker
    val translateLanguages = listOf(
        "en" to "English", "fr" to "Français", "de" to "Deutsch",
        "it" to "Italiano", "es" to "Español", "pt" to "Português",
        "nl" to "Nederlands", "pl" to "Polski", "ja" to "日本語",
        "zh" to "中文", "ru" to "Русский", "ko" to "한국어",
    )

    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
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
                onClick = {
                    if (isTranslated) {
                        onToggleTranslation()
                    } else {
                        translateDialogOpen = true
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text(
                    if (isTranslated) "Show original" else "Translate this page",
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            TextButton(
                onClick = onShare,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text("Share", modifier = Modifier.fillMaxWidth())
            }

            TextButton(
                onClick = onShareWithFriend,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text("Share with a friend", modifier = Modifier.fillMaxWidth())
            }

            TextButton(
                onClick = { collectionPickerMode = "add"; collectionPickerOpen = true },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            ) {
                Text("Add to collection…", modifier = Modifier.fillMaxWidth())
            }

            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(onClick = onNavBack,    modifier = Modifier.weight(1f)) { Text("← Back") }
                OutlinedButton(onClick = onNavReload,  modifier = Modifier.weight(1f)) { Text("↻ Reload") }
                OutlinedButton(onClick = onNavForward, modifier = Modifier.weight(1f)) { Text("Forward →") }
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

            // ── Section 3: Admin / Moderator (unlocked via JWT role or Settings → tap version 5×) ──
            if (adminModeEnabled || (moderatorModeEnabled && !adminModeEnabled)) {
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (adminModeEnabled) "\uD83D\uDD12 Admin" else "\uD83D\uDEE1\uFE0F Moderator",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (adminModeEnabled) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )

                // URL loader (admin only)
                if (adminModeEnabled) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        OutlinedTextField(
                            value = adminUrlInput,
                            onValueChange = { adminUrlInput = it },
                            label = { Text("Load URL in Roam") },
                            placeholder = { Text("https://example.com") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedButton(
                            onClick = {
                                val trimmed = adminUrlInput.trim()
                                if (trimmed.isNotBlank()) {
                                    onAdminNavigateToUrl(trimmed)
                                    adminUrlInput = ""
                                }
                            },
                            enabled = adminUrlInput.isNotBlank(),
                        ) {
                            Text("Go")
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                }

                // Quick links to web admin panels (all use /admin paths, not /moderator)
                TextButton(
                    onClick = { onAdminNavigateToUrl("https://roamtheweb.app/admin?view=queue") },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                ) {
                    Text("\uD83D\uDEC3 Moderation Queue ↗", modifier = Modifier.fillMaxWidth())
                }
                TextButton(
                    onClick = { onAdminNavigateToUrl("https://roamtheweb.app/admin?view=analytics") },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                ) {
                    Text("\uD83D\uDCCA Analytics ↗", modifier = Modifier.fillMaxWidth())
                }
                TextButton(
                    onClick = { onAdminNavigateToUrl("https://roamtheweb.app/admin?view=badges") },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                ) {
                    Text("\uD83C\uDFC5 Badges ↗", modifier = Modifier.fillMaxWidth())
                }
                TextButton(
                    onClick = { onAdminNavigateToUrl("https://roamtheweb.app/admin?view=reports") },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                ) {
                    Text("\uD83D\uDEAB Dead Links ↗", modifier = Modifier.fillMaxWidth())
                }
                if (adminModeEnabled) {
                    TextButton(
                        onClick = { onAdminNavigateToUrl("https://roamtheweb.app/admin?view=email") },
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                    ) {
                        Text("\uD83D\uDCE7 Email ↗", modifier = Modifier.fillMaxWidth())
                    }
                    TextButton(
                        onClick = { onAdminNavigateToUrl("https://roamtheweb.app/admin?view=beta") },
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                    ) {
                        Text("\uD83D\uDD0C Beta Signups ↗", modifier = Modifier.fillMaxWidth())
                    }
                }
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
                            .clickable { onNavigateSavedUrl(saved.url) }
                            .padding(horizontal = 16.dp, vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
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

    // ── Translate language picker dialog ─────────────────────────────────
    if (translateDialogOpen) {
        AlertDialog(
            onDismissRequest = { translateDialogOpen = false },
            title = { Text("Translate to…") },
            text = {
                Column {
                    translateLanguages.forEach { (code, label) ->
                        TextButton(
                            onClick = {
                                translateDialogOpen = false
                                onTranslate(code)
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(label, modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { translateDialogOpen = false }) { Text("Cancel") }
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