package app.roam.android.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CollectionsBookmark
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.filled.TravelExplore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.vector.ImageVector
import app.roam.android.model.Collection
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Oxide3
import app.roam.android.ui.theme.Panel2
import app.roam.android.ui.theme.TealBright

@Composable
fun ProgramLauncher(
    collections: List<Collection>,
    isTranslated: Boolean,
    onToggleTranslation: () -> Unit,
    onTranslate: (String) -> Unit,
    onSaveForLater: () -> Unit,
    onShare: () -> Unit,
    onShareWithFriend: () -> Unit,
    onAddToCollection: (String) -> Unit,
    onCreateCollectionAndAdd: (String) -> Unit,
    onRoamWithinCategory: () -> Unit,
    onRoamCollection: (String) -> Unit,
    onManageCollections: () -> Unit,
    onNavBack: () -> Unit,
    onNavForward: () -> Unit,
    onNavReload: () -> Unit,
    onReportBrokenLink: () -> Unit,
    title: String?,
    description: String?,
    domain: String?,
    category: String?,
    subcategory: String?,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var collectionPickerOpen by remember { mutableStateOf(false) }
    var collectionPickerMode by remember { mutableStateOf("add") }
    var newCollectionDialogOpen by remember { mutableStateOf(false) }
    var newCollectionName by remember { mutableStateOf("") }
    var translateDialogOpen by remember { mutableStateOf(false) }
    var shareDialogOpen by remember { mutableStateOf(false) }

    RoamOsWindow(title = "/USR/BIN", onClose = onClose, modifier = modifier) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(12.dp)) {
            UrlInfoCard(title = title, domain = domain, category = category, subcategory = subcategory, description = description)
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProgramNavKey(Icons.AutoMirrored.Filled.ArrowBack, "BACK", { onNavBack(); onClose() }, Modifier.weight(1f))
                ProgramNavKey(Icons.Filled.Refresh, "RELOAD", { onNavReload(); onClose() }, Modifier.weight(1f))
                ProgramNavKey(Icons.AutoMirrored.Filled.ArrowForward, "FWD", { onNavForward(); onClose() }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProgramTile(Icons.Filled.Save, "Save", { onSaveForLater(); onClose() }, Modifier.weight(1f))
                ProgramTile(Icons.Filled.Translate, if (isTranslated) "Original" else "Translate", {
                    if (isTranslated) { onToggleTranslation(); onClose() } else translateDialogOpen = true
                }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProgramTile(Icons.Filled.Share, "Share", { shareDialogOpen = true }, Modifier.weight(1f))
                ProgramTile(Icons.Filled.CreateNewFolder, "Collect", { collectionPickerMode = "add"; collectionPickerOpen = true }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProgramTile(Icons.Filled.TravelExplore, "Roam cat", { onRoamWithinCategory(); onClose() }, Modifier.weight(1f))
                ProgramTile(Icons.Filled.CollectionsBookmark, "Roam col", {
                    if (collections.isNotEmpty()) { collectionPickerMode = "roam"; collectionPickerOpen = true }
                }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProgramTile(Icons.Filled.Folder, "Collections", { onManageCollections(); onClose() }, Modifier.weight(1f))
                ProgramTile(Icons.Filled.Flag, "Report", { onReportBrokenLink(); onClose() }, Modifier.weight(1f))
            }
        }
    }

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
                                if (collectionPickerMode == "roam") { onRoamCollection(col.id); onClose() }
                                else { onAddToCollection(col.id); onClose() }
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(col.name, modifier = Modifier.fillMaxWidth()) }
                    }
                    if (collectionPickerMode == "add") {
                        TextButton(
                            onClick = { collectionPickerOpen = false; newCollectionDialogOpen = true },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("+ New collection", modifier = Modifier.fillMaxWidth()) }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { collectionPickerOpen = false }) { Text("Cancel") } },
        )
    }

    if (translateDialogOpen) {
        AlertDialog(
            onDismissRequest = { translateDialogOpen = false },
            title = { Text("Translate to\u2026") },
            text = {
                Column {
                    listOf(
                        "en" to "English", "fr" to "Fran\u00e7ais", "de" to "Deutsch", "it" to "Italiano",
                        "es" to "Espa\u00f1ol", "pt" to "Portugu\u00eas", "nl" to "Nederlands", "pl" to "Polski",
                        "ja" to "\u65e5\u672c\u8a9e", "zh" to "\u4e2d\u6587", "ru" to "\u0420\u0443\u0441\u0441\u043a\u0438\u0439", "ko" to "\ud55c\uad6d\uc5b4",
                    ).forEach { (code, label) ->
                        TextButton(
                            onClick = { translateDialogOpen = false; onTranslate(code); onClose() },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(label, modifier = Modifier.fillMaxWidth()) }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { translateDialogOpen = false }) { Text("Cancel") } },
        )
    }

    if (shareDialogOpen) {
        AlertDialog(
            onDismissRequest = { shareDialogOpen = false },
            title = { Text("Share this page") },
            text = {
                Column {
                    TextButton(
                        onClick = { shareDialogOpen = false; onShare(); onClose() },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Share via\u2026", modifier = Modifier.fillMaxWidth()) }
                    TextButton(
                        onClick = { shareDialogOpen = false; onShareWithFriend(); onClose() },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Send to a Roam user", modifier = Modifier.fillMaxWidth()) }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { shareDialogOpen = false }) { Text("Cancel") } },
        )
    }

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
                            onClose()
                        }
                    },
                ) { Text("Create & add") }
            },
            dismissButton = {
                TextButton(onClick = { newCollectionDialogOpen = false; newCollectionName = "" }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun UrlInfoCard(
    title: String?,
    domain: String?,
    category: String?,
    subcategory: String?,
    description: String?,
) {
    var expanded by remember { mutableStateOf(false) }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(Panel2)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { expanded = !expanded }
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    title ?: "UNKNOWN SIGNAL",
                    style = MaterialTheme.typography.labelLarge,
                    color = Bone,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                domain?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.labelSmall,
                        color = TealBright,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                val meta = listOfNotNull(category, subcategory)
                if (meta.isNotEmpty()) {
                    Text(
                        meta.joinToString(" · "),
                        style = MaterialTheme.typography.labelSmall,
                        color = Fog,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Text(if (expanded) "\u25B4" else "\u25BE", style = MaterialTheme.typography.labelMedium, color = Fog)
        }
        AnimatedVisibility(visible = expanded) {
            Column {
                Spacer(Modifier.height(8.dp))
                Text(
                    description ?: "No description available.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ProgramTile(icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Panel2)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(vertical = 10.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = label, tint = TealBright, modifier = Modifier.size(22.dp))
        Spacer(Modifier.height(4.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun ProgramNavKey(icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Oxide3)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = label, tint = TealBright, modifier = Modifier.size(20.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}



