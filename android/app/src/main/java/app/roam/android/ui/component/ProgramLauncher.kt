package app.roam.android.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import kotlin.math.roundToInt

@Composable
fun ProgramLauncher(
    collections: List<Collection>,
    isTranslated: Boolean,
    onToggleTranslation: () -> Unit,
    onTranslate: (String) -> Unit,
    onOpenTranslatePicker: () -> Unit,
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
    wilsonScore: Double = 0.0,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var collectionPickerOpen by remember { mutableStateOf(false) }
    var collectionPickerMode by remember { mutableStateOf("add") }
    var newCollectionDialogOpen by remember { mutableStateOf(false) }
    var newCollectionName by remember { mutableStateOf("") }
    var shareDialogOpen by remember { mutableStateOf(false) }

    Box(modifier) {
        RoamOsWindow(title = "PROGRAMS", onClose = onClose, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize()) {
                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(12.dp),
                ) {
                    UrlInfoCard(title = title, domain = domain, category = category, subcategory = subcategory, description = description, wilsonScore = wilsonScore)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProgramNavKey(Icons.AutoMirrored.Filled.ArrowBack, "back", { onNavBack(); onClose() }, Modifier.weight(1f))
                        ProgramNavKey(Icons.Filled.Refresh, "reload", { onNavReload(); onClose() }, Modifier.weight(1f))
                        ProgramNavKey(Icons.AutoMirrored.Filled.ArrowForward, "fwd", { onNavForward(); onClose() }, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(10.dp))
                    Text("// select a program to launch", style = MaterialTheme.typography.labelSmall, color = Fog)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProgramTile(Icons.Filled.Save, "save", { onSaveForLater(); onClose() }, Modifier.weight(1f))
                        ProgramTile(Icons.Filled.Translate, if (isTranslated) "original" else "translate", {
                            if (isTranslated) { onToggleTranslation(); onClose() } else onOpenTranslatePicker()
                        }, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProgramTile(Icons.Filled.Share, "share", { shareDialogOpen = true }, Modifier.weight(1f))
                        ProgramTile(Icons.Filled.CreateNewFolder, "collect", { collectionPickerMode = "add"; collectionPickerOpen = true }, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProgramTile(Icons.Filled.TravelExplore, "roam-cat", { onRoamWithinCategory(); onClose() }, Modifier.weight(1f))
                        ProgramTile(Icons.Filled.CollectionsBookmark, "roam-col", {
                            if (collections.isNotEmpty()) { collectionPickerMode = "roam"; collectionPickerOpen = true }
                        }, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProgramTile(Icons.Filled.Folder, "collections", { onManageCollections(); onClose() }, Modifier.weight(1f))
                        ProgramTile(Icons.Filled.Flag, "report", { onReportBrokenLink(); onClose() }, Modifier.weight(1f))
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(LineColor))
                Text(
                    "pkgs: 8 · uid: wanderer · daemon: idle",
                    style = MaterialTheme.typography.labelSmall,
                    color = Fog,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }

    if (collectionPickerOpen) {
        RoamOsWindow(title = if (collectionPickerMode == "roam") "COLLECT // ROAM" else "COLLECT // ADD", onClose = { collectionPickerOpen = false }, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize()) {
                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(12.dp),
                ) {
                    Text("// select a collection", style = MaterialTheme.typography.labelSmall, color = Fog)
                    Spacer(Modifier.height(8.dp))
                    collections.forEach { col ->
                        Row(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(Panel2)
                                .clickable {
                                    collectionPickerOpen = false
                                    if (collectionPickerMode == "roam") { onRoamCollection(col.id); onClose() }
                                    else { onAddToCollection(col.id); onClose() }
                                }
                                .padding(horizontal = 12.dp, vertical = 12.dp),
                        ) { Text(col.name, color = Bone, style = MaterialTheme.typography.bodyMedium) }
                        Spacer(Modifier.height(6.dp))
                    }
                    if (collectionPickerMode == "add") {
                        Row(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(Panel2)
                                .clickable { collectionPickerOpen = false; newCollectionDialogOpen = true }
                                .padding(horizontal = 12.dp, vertical = 12.dp),
                        ) { Text("+ new collection", color = TealBright, style = MaterialTheme.typography.bodyMedium) }
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(LineColor))
                Text(
                    "dir: /collections · mode: $collectionPickerMode",
                    style = MaterialTheme.typography.labelSmall,
                    color = Fog,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }
    }

    if (shareDialogOpen) {
        RoamOsWindow(title = "SHARE", onClose = { shareDialogOpen = false }, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize()) {
                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(12.dp),
                ) {
                    Text("// route this page", style = MaterialTheme.typography.labelSmall, color = Fog)
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(Panel2)
                            .clickable { shareDialogOpen = false; onShare(); onClose() }
                            .padding(horizontal = 12.dp, vertical = 12.dp),
                    ) { Text("share via...", color = Bone, style = MaterialTheme.typography.bodyMedium) }
                    Spacer(Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(Panel2)
                            .clickable { shareDialogOpen = false; onShareWithFriend(); onClose() }
                            .padding(horizontal = 12.dp, vertical = 12.dp),
                    ) { Text("send to a wanderer", color = Bone, style = MaterialTheme.typography.bodyMedium) }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(LineColor))
                Text(
                    "uplink: ready · payload: 1 page",
                    style = MaterialTheme.typography.labelSmall,
                    color = Fog,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }
    }

    if (newCollectionDialogOpen) {
        RoamOsWindow(title = "COLLECT // NEW", onClose = { newCollectionDialogOpen = false; newCollectionName = "" }, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxWidth().padding(12.dp)) {
                Text("// name the collection", style = MaterialTheme.typography.labelSmall, color = Fog)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = newCollectionName,
                    onValueChange = { newCollectionName = it },
                    label = { Text("name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { newCollectionDialogOpen = false; newCollectionName = "" }) { Text("cancel", color = Fog) }
                    TextButton(
                        onClick = {
                            if (newCollectionName.isNotBlank()) {
                                onCreateCollectionAndAdd(newCollectionName.trim())
                                newCollectionName = ""
                                newCollectionDialogOpen = false
                                onClose()
                            }
                        },
                    ) { Text("create & add", color = TealBright) }
                }
                Spacer(Modifier.height(10.dp))
                Text("alloc: new dir · label: pending", style = MaterialTheme.typography.labelSmall, color = Fog)
            }
        }
    }
    }
}

@Composable
private fun UrlInfoCard(
    title: String?,
    domain: String?,
    category: String?,
    subcategory: String?,
    description: String?,
    wilsonScore: Double = 0.0,
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
        Text("// SIGNAL", style = MaterialTheme.typography.labelSmall, color = Fog)
        Spacer(Modifier.height(6.dp))
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
        Spacer(Modifier.height(8.dp))
        WilsonScoreMeter(wilsonScore)
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
private fun WilsonScoreMeter(score: Double) {
    val clamped = score.coerceIn(0.0, 1.0)
    val filledSegments = (clamped * 10).roundToInt().coerceIn(0, 10)
    val pct = (clamped * 100).roundToInt()
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text("CONF", style = MaterialTheme.typography.labelSmall, color = Fog)
        Spacer(Modifier.width(8.dp))
        Row(
            modifier = Modifier.weight(1f).height(10.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            repeat(10) { i ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(2.dp))
                        .background(if (i < filledSegments) TealBright else Oxide3.copy(alpha = 0.35f)),
                )
            }
        }
        Spacer(Modifier.width(8.dp))
        Text("$pct%", style = MaterialTheme.typography.labelSmall, color = Bone)
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



