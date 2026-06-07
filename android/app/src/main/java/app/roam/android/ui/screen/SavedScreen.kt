package app.roam.android.ui.screen

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Collections
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import app.roam.android.model.Collection
import app.roam.android.model.CollectionItem
import app.roam.android.model.SavedUrl
import app.roam.android.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedScreen(
    vm: MainViewModel,
    onNavigateBack: () -> Unit = {},
    onNavigateToUrl: (String) -> Unit = {},
) {
    val savedUrls by vm.savedUrls.collectAsState()
    val collections by vm.collections.collectAsState()
    val selectedCollection by vm.selectedCollection.collectAsState()
    val collectionItems by vm.collectionItems.collectAsState()
    val collectionItemsLoading by vm.collectionItemsLoading.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }

    // Load collections when the screen first appears
    LaunchedEffect(Unit) { vm.loadCollections() }

    // Android back closes collection detail before leaving the screen
    BackHandler(enabled = selectedCollection != null) { vm.closeCollection() }

    Scaffold(
        topBar = {
            if (selectedCollection != null) {
                TopAppBar(
                    title = {
                        Text(
                            selectedCollection!!.name,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = { vm.closeCollection() }) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                            )
                        }
                    },
                )
            } else {
                TopAppBar(
                    title = { Text("Saved") },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    },
                )
            }
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            if (selectedCollection != null) {
                CollectionDetailTab(
                    items = collectionItems,
                    isLoading = collectionItemsLoading,
                    onRemoveItem = { urlId -> vm.removeItemFromCollection(selectedCollection!!.id, urlId) },
                    onNavigateToUrl = onNavigateToUrl,
                )
            } else {
                TabRow(selectedTabIndex = selectedTab) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = { Text("Saved (${savedUrls.size})") },
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = {
                            selectedTab = 1
                            vm.loadCollections()
                        },
                        text = { Text("Collections") },
                    )
                }

                when (selectedTab) {
                    0 -> SavedTab(savedUrls = savedUrls, collections = collections, vm = vm, onNavigateToUrl = onNavigateToUrl)
                    1 -> {
                        val context = LocalContext.current
                        CollectionsTab(
                            collections = collections,
                            onOpenCollection = { vm.openCollection(it) },
                            onRenameCollection = { id, name -> vm.renameCollection(id, name) },
                            onDeleteCollection = { id -> vm.deleteCollection(id) },
                            onUpdateCollectionPublic = { id, isPublic -> vm.updateCollectionPublic(id, isPublic) },
                            onShareCollection = { slug ->
                                val url = "https://roamtheweb.app/c/$slug"
                                val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Collection URL", url))
                                vm.showTransientToast("Link copied to clipboard")
                            },
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SavedTab(
    savedUrls: List<SavedUrl>,
    collections: List<Collection>,
    vm: MainViewModel,
    onNavigateToUrl: (String) -> Unit = {},
) {
    val context = LocalContext.current
    var selectedUrls by remember { mutableStateOf(emptySet<String>()) }
    var collectionPickerOpen by remember { mutableStateOf(value = false) }
    var newCollectionDialogOpen by remember { mutableStateOf(false) }
    var newCollectionName by remember { mutableStateOf("") }
    val isSelectionMode = selectedUrls.isNotEmpty()

    // Keep selection consistent if items are removed while in selection mode
    LaunchedEffect(savedUrls) {
        val validUrls = savedUrls.asSequence().map { it.url }.toSet()
        selectedUrls = selectedUrls.intersect(validUrls)
    }

    if (savedUrls.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(32.dp),
            ) {
                Text("Nothing saved yet", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Tap the bookmark icon while browsing to save pages for later.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                )
            }
        }
    } else {
        Column(modifier = Modifier.fillMaxSize()) {
            // Selection action bar
            if (isSelectionMode) {
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconButton(onClick = { selectedUrls = emptySet() }) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Cancel selection",
                                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                            )
                        }
                        Text(
                            "${selectedUrls.size} selected",
                            modifier = Modifier.weight(1f),
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                        IconButton(
                            onClick = {
                                selectedUrls.forEach { vm.removeSavedUrl(it) }
                                selectedUrls = emptySet()
                            },
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Delete,
                                contentDescription = "Delete selected",
                                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                            )
                        }
                        TextButton(
                            onClick = {
                                vm.loadCollections()
                                collectionPickerOpen = true
                            },
                        ) {
                            Text(
                                "Add to collection",
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                            )
                        }
                    }
                }
            }

            LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth()) {
                items(savedUrls, key = { it.url }) { item ->
                    val isSelected = item.url in selectedUrls
                    if (isSelectionMode) {
                        SelectableUrlRow(
                            item = item,
                            isSelected = isSelected,
                            onToggle = {
                                selectedUrls = if (isSelected) selectedUrls - item.url
                                              else selectedUrls + item.url
                            },
                        )
                    } else {
                        val dismissState = rememberSwipeToDismissBoxState(
                            confirmValueChange = { value ->
                                if (value == SwipeToDismissBoxValue.EndToStart) {
                                    vm.removeSavedUrl(item.url)
                                    true
                                } else false
                            },
                        )
                        SwipeToDismissBox(
                            state = dismissState,
                            backgroundContent = {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(MaterialTheme.colorScheme.errorContainer)
                                        .padding(end = 24.dp),
                                    contentAlignment = Alignment.CenterEnd,
                                ) {
                                    Icon(
                                        imageVector = Icons.Filled.Delete,
                                        contentDescription = "Delete",
                                        tint = MaterialTheme.colorScheme.onErrorContainer,
                                    )
                                }
                            },
                            enableDismissFromStartToEnd = false,
                        ) {
                            SavedUrlRow(
                                item = item,
                                onClick = { onNavigateToUrl(item.url) },
                                onLongClick = { selectedUrls = setOf(item.url) },
                            )
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }

    // Collection picker
    if (collectionPickerOpen) {
        AlertDialog(
            onDismissRequest = { /* ignored */ },
            title = { Text("Add to collection") },
            text = {
                Column {
                    collections.forEach { col ->
                        TextButton(
                            onClick = {
                                collectionPickerOpen = false
                                vm.addSavedUrlsToCollection(col.id, selectedUrls.toList())
                                selectedUrls = emptySet()
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(col.name, modifier = Modifier.fillMaxWidth())
                        }
                    }
                    TextButton(
                        onClick = {
                            collectionPickerOpen = false
                            newCollectionDialogOpen = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("New collection…", modifier = Modifier.fillMaxWidth())
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { collectionPickerOpen = false }) { Text("Cancel") }
            },
        )
    }

    // New collection dialog
    if (newCollectionDialogOpen) {
        AlertDialog(
            onDismissRequest = { newCollectionDialogOpen = false; newCollectionName = "" },
            title = { Text("New collection") },
            text = {
                OutlinedTextField(
                    value = newCollectionName,
                    onValueChange = { newCollectionName = it },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newCollectionName.isNotBlank()) {
                            vm.createCollectionAndAddSaved(newCollectionName.trim(), selectedUrls.toList())
                            selectedUrls = emptySet()
                            newCollectionDialogOpen = false
                            newCollectionName = ""
                        }
                    },
                    enabled = newCollectionName.isNotBlank(),
                ) { Text("Create") }
            },
            dismissButton = {
                TextButton(
                    onClick = { newCollectionDialogOpen = false; newCollectionName = "" },
                ) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun CollectionsTab(
    collections: List<Collection>,
    onOpenCollection: (Collection) -> Unit,
    onRenameCollection: (id: String, name: String) -> Unit,
    onDeleteCollection: (id: String) -> Unit,
    onUpdateCollectionPublic: (id: String, isPublic: Boolean) -> Unit,
    onShareCollection: (slug: String) -> Unit,
) {
    if (collections.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(32.dp),
            ) {
                Icon(
                    imageVector = Icons.Filled.Collections,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
                )
                Text("No collections yet", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Use the ⚙ menu while browsing to create your first collection.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                )
            }
        }
    } else {
        var menuCollection by remember { mutableStateOf<Collection?>(null) }
        var renameTarget by remember { mutableStateOf<Collection?>(null) }
        var renameText by remember { mutableStateOf("") }
        var deleteTarget by remember { mutableStateOf<Collection?>(null) }
        var copiedCollectionId by remember { mutableStateOf<String?>(null) }

        LazyColumn(modifier = Modifier.fillMaxSize()) {
            items(collections, key = { it.id }) { collection ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenCollection(collection) }
                        .padding(start = 16.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f).padding(vertical = 8.dp)) {
                        Text(
                            text = collection.name,
                            style = MaterialTheme.typography.bodyLarge,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = "${collection.itemCount} items${if (collection.isPublic) " • Public" else ""}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                        )
                    }
                    if (collection.isPublic) {
                        IconButton(onClick = { onShareCollection(collection.slug); copiedCollectionId = collection.id }) {
                            Icon(
                                imageVector = Icons.Filled.Share,
                                contentDescription = "Share collection",
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                    Box {
                        IconButton(onClick = { menuCollection = collection }) {
                            Icon(
                                imageVector = Icons.Filled.MoreVert,
                                contentDescription = "Collection options",
                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            )
                        }
                        DropdownMenu(
                            expanded = menuCollection?.id == collection.id,
                            onDismissRequest = { menuCollection = null },
                        ) {
                            if (collection.isPublic) {
                                DropdownMenuItem(
                                    text = { Text("Make private") },
                                    onClick = {
                                        onUpdateCollectionPublic(collection.id, false)
                                        menuCollection = null
                                    },
                                )
                            } else {
                                DropdownMenuItem(
                                    text = { Text("Make public") },
                                    onClick = {
                                        onUpdateCollectionPublic(collection.id, true)
                                        menuCollection = null
                                    },
                                )
                            }
                            DropdownMenuItem(
                                text = { Text("Rename") },
                                onClick = {
                                    renameTarget = collection
                                    renameText = collection.name
                                    menuCollection = null
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                                onClick = {
                                    deleteTarget = collection
                                    menuCollection = null
                                },
                            )
                        }
                    }
                }
                HorizontalDivider()
            }
        }

        // Rename dialog
        renameTarget?.let { target ->
            AlertDialog(
                onDismissRequest = { renameTarget = null },
                title = { Text("Rename collection") },
                text = {
                    OutlinedTextField(
                        value = renameText,
                        onValueChange = { renameText = it },
                        label = { Text("Name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            if (renameText.isNotBlank()) {
                                onRenameCollection(target.id, renameText.trim())
                                renameTarget = null
                            }
                        },
                        enabled = renameText.isNotBlank(),
                    ) { Text("Rename") }
                },
                dismissButton = {
                    TextButton(onClick = { renameTarget = null }) { Text("Cancel") }
                },
            )
        }

        // Delete confirmation dialog
        deleteTarget?.let { target ->
            AlertDialog(
                onDismissRequest = { deleteTarget = null },
                title = { Text("Delete collection?") },
                text = { Text("\"${target.name}\" and all its items will be permanently deleted.") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            onDeleteCollection(target.id)
                            deleteTarget = null
                        },
                    ) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                },
                dismissButton = {
                    TextButton(onClick = { deleteTarget = null }) { Text("Cancel") }
                },
            )
        }
    }
}

@Composable
private fun CollectionDetailTab(
    items: List<CollectionItem>,
    isLoading: Boolean,
    onRemoveItem: (urlId: String) -> Unit = {},
    onNavigateToUrl: (String) -> Unit = {},
) {
    when {
        isLoading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        items.isEmpty() -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(32.dp),
                ) {
                    Text("No URLs in this collection yet", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Add pages from the discovery view or via roamtheweb.app.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                }
            }
        }
        else -> {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(items, key = { it.urls.id }) { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigateToUrl(item.urls.url) }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.urls.title?.ifBlank { null } ?: item.urls.url,
                                style = MaterialTheme.typography.bodyMedium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                text = item.urls.url.toUri().host ?: item.urls.url,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        IconButton(
                            onClick = { onRemoveItem(item.urls.id) },
                            modifier = Modifier.padding(start = 8.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Close,
                                contentDescription = "Remove from collection",
                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                            )
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun SavedUrlRow(
    item: SavedUrl,
    onClick: () -> Unit,
    onLongClick: () -> Unit = {},
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .combinedClickable(onClick = onClick, onLongClick = onLongClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.title.ifBlank { item.url },
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = item.url.toUri().host ?: item.url,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun SelectableUrlRow(
    item: SavedUrl,
    isSelected: Boolean,
    onToggle: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (isSelected) MaterialTheme.colorScheme.secondaryContainer
                else MaterialTheme.colorScheme.surface,
            )
            .clickable(onClick = onToggle)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(
            checked = isSelected,
            onCheckedChange = null,
            modifier = Modifier.padding(end = 8.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.title.ifBlank { item.url },
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = item.url.toUri().host ?: item.url,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}