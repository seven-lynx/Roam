package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
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
import app.roam.android.model.Collection
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
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var collectionPickerOpen by remember { mutableStateOf(false) }
    var collectionPickerMode by remember { mutableStateOf("add") }
    var newCollectionDialogOpen by remember { mutableStateOf(false) }
    var newCollectionName by remember { mutableStateOf("") }
    var translateDialogOpen by remember { mutableStateOf(false) }
    var shareDialogOpen by remember { mutableStateOf(false) }

    RoamOsWindow(title = "PROGRAMS", onClose = onClose, modifier = modifier) {
        Column(Modifier.padding(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProgramNavKey("\u25C0", "BACK", { onNavBack(); onClose() }, Modifier.weight(1f))
                ProgramNavKey("\u21BB", "RELOAD", { onNavReload(); onClose() }, Modifier.weight(1f))
                ProgramNavKey("\u25B6", "FWD", { onNavForward(); onClose() }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProgramTile("\uD83D\uDCBE", "Save", { onSaveForLater(); onClose() }, Modifier.weight(1f))
                ProgramTile("\uD83C\uDF10", if (isTranslated) "Original" else "Translate", {
                    if (isTranslated) { onToggleTranslation(); onClose() } else translateDialogOpen = true
                }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProgramTile("\uD83D\uDCE4", "Share", { shareDialogOpen = true }, Modifier.weight(1f))
                ProgramTile("\uD83D\uDCC1", "Collect", { collectionPickerMode = "add"; collectionPickerOpen = true }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProgramTile("\uD83C\uDFAF", "Roam cat", { onRoamWithinCategory(); onClose() }, Modifier.weight(1f))
                ProgramTile("\uD83D\uDCDA", "Roam col", {
                    if (collections.isNotEmpty()) { collectionPickerMode = "roam"; collectionPickerOpen = true }
                }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProgramTile("\uD83D\uDDC2\uFE0F", "Collections", { onManageCollections(); onClose() }, Modifier.weight(1f))
                ProgramTile("\u26A0\uFE0F", "Report", { onReportBrokenLink(); onClose() }, Modifier.weight(1f))
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
private fun ProgramTile(emoji: String, label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Panel2)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(vertical = 10.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(emoji, style = MaterialTheme.typography.titleLarge)
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
private fun ProgramNavKey(symbol: String, label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Oxide3)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(symbol, style = MaterialTheme.typography.titleMedium, color = TealBright)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}



