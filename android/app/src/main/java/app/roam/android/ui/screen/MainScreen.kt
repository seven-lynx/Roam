package app.roam.android.ui.screen

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import app.roam.android.MainActivity
import app.roam.android.ui.component.BottomBar
import app.roam.android.ui.component.ConfigBottomSheet
import app.roam.android.ui.component.DiscoverCard
import app.roam.android.ui.component.DiscoverCardSkeleton
import app.roam.android.ui.component.RoamTab
import app.roam.android.ui.component.RoamWebView
import app.roam.android.ui.component.SubmitBottomSheet
import app.roam.android.viewmodel.MainViewModel
import app.roam.android.viewmodel.RoamState
import app.roam.android.util.resolveSwipeAction
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt
/** No local constant needed — threshold lives in util/SwipeDirection.kt */

@Composable
fun MainScreen(
    vm: MainViewModel,
    activity: MainActivity,
    onSignOut: () -> Unit = {},
) {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            BottomBar(navController = navController)
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = RoamTab.Discover.route,
            modifier = Modifier.padding(innerPadding),
            enterTransition = { fadeIn(animationSpec = spring()) },
            exitTransition = { fadeOut(animationSpec = spring()) },
            popEnterTransition = { fadeIn(animationSpec = spring()) },
            popExitTransition = { fadeOut(animationSpec = spring()) },
        ) {
            composable(RoamTab.Discover.route) {
                DiscoverTab(vm = vm, activity = activity)
            }
            composable(RoamTab.Saved.route) {
                SavedScreen(
                    vm = vm,
                    onNavigateToDiscover = {
                        navController.navigate(RoamTab.Discover.route) {
                            popUpTo(RoamTab.Discover.route) { inclusive = false }
                            launchSingleTop = true
                        }
                    },
                )
            }
            composable(RoamTab.Profile.route) {
                ProfileScreen(vm = vm, onSignOut = onSignOut)
            }
            composable(RoamTab.Settings.route) {
                SettingsScreen(vm = vm, onSignOut = onSignOut)
            }
        }
    }
}

// ── Discover tab ──────────────────────────────────────────────────────────────

@Composable
private fun DiscoverTab(
    vm: MainViewModel,
    activity: MainActivity,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val state by vm.state.collectAsState()
    val currentUrl by vm.currentUrl.collectAsState()
    val showSubmitSheet by vm.showSubmitSheet.collectAsState()
    val showConfigSheet by vm.showConfigSheet.collectAsState()
    val savedConfirmation by vm.savedConfirmation.collectAsState()
    val collections by vm.collections.collectAsState()
    val categories by vm.categories.collectAsState()
    val savedUrls by vm.savedUrls.collectAsState()
    val isOnline by vm.isOnline.collectAsState()

    // Physics-based drag state for swipe gesture feedback (14.2)
    val offsetX = remember { Animatable(0f) }
    val offsetY = remember { Animatable(0f) }

    LaunchedEffect(Unit) { vm.roam() }

    Box(modifier = Modifier.fillMaxSize()) {
        // ── Content layer: card when loaded, skeleton when loading, WebView otherwise ──
        val loaded = state as? RoamState.Loaded
        if (state is RoamState.Loading) {
            DiscoverCardSkeleton()
        } else if (loaded != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .offset { IntOffset(offsetX.value.roundToInt(), offsetY.value.roundToInt()) },
            ) {
                DiscoverCard(
                    roamUrl = loaded.roamUrl,
                    onThumbsUp = { vm.thumbsUp(context) },
                    onThumbsDown = { vm.thumbsDown(context) },
                    onOpen = {
                        CustomTabsIntent.Builder().build()
                            .launchUrl(activity, Uri.parse(loaded.roamUrl.url))
                    },
                )
            }
        } else {
            // Idle / Loading — keep WebView so the previous page stays visible
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .offset { IntOffset(offsetX.value.roundToInt(), offsetY.value.roundToInt()) },
            ) {
                RoamWebView(
                    url = currentUrl,
                    modifier = Modifier.fillMaxSize(),
                    onUrlChanged = { vm.onWebViewUrlChanged(it) },
                    onLoadError = { vm.roam() },
                )
            }
        }

        // ── Gesture overlay (14.2) ───────────────────────────────────────────
        Box(
            modifier = Modifier
                .fillMaxSize()
                .semantics { contentDescription = "Swipe down to discover, right to like, left to skip" }
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDrag = { change, dragAmount ->
                            change.consume()
                            scope.launch {
                                offsetX.snapTo(offsetX.value + dragAmount.x)
                                offsetY.snapTo(offsetY.value + dragAmount.y)
                            }
                        },
                        onDragEnd = {
                            val dx = offsetX.value
                            val dy = offsetY.value
                            val action = resolveSwipeAction(dx, dy)
                            scope.launch {
                                // Spring back to zero regardless
                                launch { offsetX.animateTo(0f, spring()) }
                                launch { offsetY.animateTo(0f, spring()) }
                            }
                            when (action) {
                                "roam" -> vm.roam()
                                "like" -> vm.thumbsUp(context)
                                "skip" -> vm.thumbsDown(context)
                            }
                        },
                        onDragCancel = {
                            scope.launch {
                                launch { offsetX.animateTo(0f, spring()) }
                                launch { offsetY.animateTo(0f, spring()) }
                            }
                        },
                    )
                },
        )

        // Offline banner (14.9)
        if (!isOnline) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .background(MaterialTheme.colorScheme.tertiaryContainer)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "You're offline — ratings will be sent when you reconnect.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        // Persistent error banner
        if (state is RoamState.Error) {
            val errorMsg = (state as RoamState.Error).message
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .background(MaterialTheme.colorScheme.errorContainer)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = errorMsg,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { vm.roam() }) {
                    Text("Retry", color = MaterialTheme.colorScheme.onErrorContainer)
                }
            }
        }

        // "Saved!" confirmation banner — auto-dismisses after 2 s
        if (savedConfirmation) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .background(MaterialTheme.colorScheme.secondaryContainer)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Saved for later",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                )
            }
        }

        // Exhausted state
        if (state is RoamState.Exhausted) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
            ) {
                Text(
                    text = "You've explored everything here",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    text = "Adjust your categories in Settings",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }

    // Bottom sheets
    if (showSubmitSheet) {
        SubmitBottomSheet(
            url = currentUrl,
            categories = categories,
            onSubmit = { categoryId -> vm.submitUrl(currentUrl ?: "", categoryId) },
            onDismiss = { vm.closeSubmitSheet() },
        )
    }

    if (showConfigSheet) {
        ConfigBottomSheet(
            currentUrl = currentUrl,
            skipPaywalled = vm.skipPaywalled.collectAsState().value,
            preferredLanguages = vm.preferredLanguages.collectAsState().value,
            collections = collections,
            savedUrls = savedUrls,
            onDismiss = { vm.closeConfigSheet() },
            onSaveForLater = {
                vm.saveForLater()
                vm.closeConfigSheet()
            },
            onShare = {
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, currentUrl ?: "")
                }
                activity.startActivity(Intent.createChooser(shareIntent, null))
                vm.closeConfigSheet()
            },
            onAddToCollection = { collectionId -> vm.addCurrentUrlToCollection(collectionId) },
            onCreateCollectionAndAdd = { name -> vm.createCollectionAndAdd(name) },
            onRoamWithinCategory = { vm.roamWithinCategory() },
            onRoamCollection = { collectionId -> vm.roamCollection(collectionId) },
            onManageCollections = {
                CustomTabsIntent.Builder().build()
                    .launchUrl(activity, Uri.parse("https://roamtheweb.app/u/me"))
                vm.closeConfigSheet()
            },
            onCategoryPrefs = {
                CustomTabsIntent.Builder().build()
                    .launchUrl(activity, Uri.parse("https://roamtheweb.app/profile"))
                vm.closeConfigSheet()
            },
            onSkipPaywalledChange = { vm.setSkipPaywalled(it) },
            onLanguagesChange = { vm.setPreferredLanguages(it) },
            onRemoveSavedUrl = { url -> vm.removeSavedUrl(url) },
            onReportBrokenLink = { vm.reportBrokenLink() },
            onSignOut = {
                vm.closeConfigSheet()
            },
        )
    }
}
