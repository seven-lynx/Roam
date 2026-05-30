package app.roam.android.ui.screen

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
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
import androidx.compose.material.icons.filled.Collections
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
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
import app.roam.android.model.Collection
import app.roam.android.model.CollectionItem
import app.roam.android.viewmodel.MainViewModel
import app.roam.android.viewmodel.SavedUrl

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedScreen(
    vm: MainViewModel,
    onNavigateToDiscover: () -> Unit,
) {
    val savedUrls by vm.savedUrls.collectAsState()
    val collections by vm.collections.collectAsState()
    val selectedCollection by vm.selectedCollection.collectAsState()
    val collectionItems by vm.collectionItems.collectAsState()
    val collectionItemsLoading by vm.collectionItemsLoading.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }
    val context = LocalContext.current

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
                TopAppBar(title = { Text("Saved") })
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
                    0 -> SavedTab(savedUrls = savedUrls, collections = collections, vm = vm)
                    1 -> CollectionsTab(
                        collections = collections,
                        onOpenCollection = { vm.openCollection(it) },
                        onManageCollections = {
                            vm.navigateTo("https://roamtheweb.app/profile")
                            onNavigateToDiscover()
                        },
                    )
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
) {
    val context = LocalContext.current
    var selectedUrls by remember { mutableStateOf(emptySet<String>()) }
    var collectionPickerOpen by remember { mutableStateOf(false) }
    var newCollectionDialogOpen by remember { mutableStateOf(false) }
    var newCollectionName by remember { mutableStateOf("") }
    val isSelectionMode = selectedUrls.isNotEmpty()

    // Keep selection consistent if items are removed while in selection mode
    LaunchedEffect(savedUrls) {
        val validUrls = savedUrls.map { it.url }.toSet()
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
                                onClick = {
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(item.url))
                                    context.startActivity(intent)
                                },
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
            onDismissRequest = { collectionPickerOpen = false },
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
    onManageCollections: () -> Unit,
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
                    "Create collections on roamtheweb.app to organise your discoveries.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                )
                TextButton(onClick = onManageCollections) {
                    Text("Manage collections ↗")
                }
            }
        }
    } else {
        LazyColumn(modifier = Modifier.fillMaxSize()) {
            item {
                TextButton(
                    onClick = onManageCollections,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(
                        "Manage collections ↗",
                        modifier = Modifier.fillMaxWidth(),
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                HorizontalDivider()
            }
            items(collections, key = { it.id }) { collection ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenCollection(collection) }
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = collection.name,
                            style = MaterialTheme.typography.bodyLarge,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = "${collection.itemCount} items",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                        )
                    }
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun CollectionDetailTab(
    items: List<CollectionItem>,
    isLoading: Boolean,
) {
    val context = LocalContext.current

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
                            .clickable {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(item.urls.url))
                                context.startActivity(intent)
                            }
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
                                text = Uri.parse(item.urls.url).host ?: item.urls.url,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}

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
                text = Uri.parse(item.url).host ?: item.url,
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
                text = Uri.parse(item.url).host ?: item.url,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
