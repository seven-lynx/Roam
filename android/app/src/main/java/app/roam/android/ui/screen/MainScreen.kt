package app.roam.android.ui.screen

import android.content.Intent
import androidx.browser.customtabs.CustomTabsIntent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.BottomSheetScaffold
import androidx.compose.material3.SheetValue
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.rememberBottomSheetScaffoldState
import androidx.compose.material3.rememberStandardBottomSheetState
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Icon
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import app.roam.android.MainActivity
import app.roam.android.ui.component.BottomBar
import app.roam.android.ui.component.BackgroundPrefetchWebView
import app.roam.android.ui.component.ConfigBottomSheet
import app.roam.android.ui.component.pickRandomMessage
import app.roam.android.ui.component.RoamTab
import app.roam.android.ui.component.RoamWebView
import app.roam.android.ui.screen.HistoryScreen
import app.roam.android.ui.component.SubmitBottomSheet
import app.roam.android.viewmodel.MainViewModel
import app.roam.android.viewmodel.RoamState
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun MainScreen(
    vm: MainViewModel,
    activity: MainActivity,
    onSignOut: () -> Unit = {},
) {
    val context = LocalContext.current
    // Track the active tab without NavController so DiscoverTab is never destroyed
    var currentTab by rememberSaveable { mutableStateOf(RoamTab.Roam.route) }
    val focusModeEnabled by vm.focusModeEnabled.collectAsState()
    val hasRatedUp by vm.hasRatedUp.collectAsState()

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            BottomBar(
                currentRoute = currentTab,
                onThumbsDown = { vm.thumbsDown(context) },
                onThumbsUp = { vm.thumbsUp(context) },
                onRoam = { vm.roam() },
                onNavigate = { currentTab = it },
                focusModeEnabled = focusModeEnabled,
                hasRatedUp = hasRatedUp,
            )
        },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            // System back button navigation between tabs
            BackHandler(enabled = currentTab == RoamTab.Settings.route) { currentTab = RoamTab.Roam.route }
            BackHandler(enabled = currentTab == RoamTab.Profile.route) { currentTab = RoamTab.Settings.route }
            // SavedScreen's own BackHandler fires first when a collection is open;
            // this one fires when at the top-level saved list.
            BackHandler(enabled = currentTab == RoamTab.Saved.route) { currentTab = RoamTab.Settings.route }
            BackHandler(enabled = currentTab == RoamTab.History.route) { currentTab = RoamTab.Settings.route }

            // DiscoverTab is always in the composition tree — WebView is never destroyed
            DiscoverTab(vm = vm, activity = activity, onSignOut = {
                onSignOut()
                currentTab = RoamTab.Roam.route
            }, onNavigateToSaved = { currentTab = RoamTab.Saved.route })

            // Other tabs slide in as full-screen overlays on top of the WebView
            AnimatedVisibility(
                visible = currentTab == RoamTab.Settings.route,
                enter = fadeIn(animationSpec = spring()),
                exit = fadeOut(animationSpec = spring()),
            ) {
                SettingsScreen(
                    vm = vm,
                    onSignOut = {
                        onSignOut()
                        currentTab = RoamTab.Roam.route
                    },
                    onNavigateToSaved = { currentTab = RoamTab.Saved.route },
                    onNavigateToProfile = { currentTab = RoamTab.Profile.route },
                    onNavigateToHistory = { currentTab = RoamTab.History.route },
                    onNavigateToNotifications = { currentTab = "notifications" },
                    onNavigateToRoam = { currentTab = RoamTab.Roam.route },
                )
            }


            AnimatedVisibility(
                visible = currentTab == RoamTab.Saved.route,
                enter = fadeIn(animationSpec = spring()),
                exit = fadeOut(animationSpec = spring()),
            ) {
                SavedScreen(
                    vm = vm,
                    onNavigateBack = { currentTab = RoamTab.Settings.route },
                    onNavigateToUrl = { url ->
                        vm.navigateTo(url)
                        currentTab = RoamTab.Roam.route
                    },
                )
            }

            AnimatedVisibility(
                visible = currentTab == RoamTab.Profile.route,
                enter = fadeIn(animationSpec = spring()),
                exit = fadeOut(animationSpec = spring()),
            ) {
                ProfileScreen(
                    vm = vm,
                    onNavigateBack = { currentTab = RoamTab.Settings.route },
                    onSignOut = {
                        onSignOut()
                        currentTab = RoamTab.Roam.route
                    },
                )
            }

            AnimatedVisibility(
                visible = currentTab == RoamTab.History.route,
                enter = fadeIn(animationSpec = spring()),
                exit = fadeOut(animationSpec = spring()),
            ) {
                HistoryScreen(
                    vm = vm,
                    onNavigateBack = { currentTab = RoamTab.Settings.route },
                    onNavigateToUrl = { url ->
                        vm.navigateTo(url)
                        currentTab = RoamTab.Roam.route
                    },
                )
            }

            AnimatedVisibility(
                visible = currentTab == "notifications",
                enter = fadeIn(animationSpec = spring()),
                exit = fadeOut(animationSpec = spring()),
            ) {
                NotificationsScreen(
                    vm = vm,
                    onNavigateBack = { currentTab = RoamTab.Settings.route },
                )
            }
        }
    }
}

// ── Discover tab ──────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DiscoverTab(
    vm: MainViewModel,
    activity: MainActivity,
    onSignOut: () -> Unit = {},
    onNavigateToSaved: () -> Unit = {},
) {
    val context = LocalContext.current

    val state by vm.state.collectAsState()
    val currentUrl by vm.currentUrl.collectAsState()
    val rawUrl by vm.rawUrl.collectAsState()
    val showSubmitSheet by vm.showSubmitSheet.collectAsState()
    val savedConfirmation by vm.savedConfirmation.collectAsState()
    val reportConfirmation by vm.reportConfirmation.collectAsState()
    val submitToast by vm.submitToast.collectAsState()
    val collections by vm.collections.collectAsState()
    val categories by vm.categories.collectAsState()
    val subcategories by vm.subcategories.collectAsState()
    val savedUrls by vm.savedUrls.collectAsState()
    val isOnline by vm.isOnline.collectAsState()
    val webDarkMode by vm.webDarkMode.collectAsState()
    val jsEnabled by vm.jsEnabled.collectAsState()
    val sheetGestureMode by vm.sheetGestureMode.collectAsState()
    val showConfigSheet by vm.showConfigSheet.collectAsState()
    val prefetchWebView by vm.prefetchWebView.collectAsState()
    val nextPrefetchUrl by vm.nextPrefetchUrl.collectAsState()

    // Only auto-roam on first entry (Idle = fresh app launch).
    LaunchedEffect(Unit) { if (vm.state.value is RoamState.Idle) vm.roam() }

    // skipHiddenState must be false so that the sheet can animate to Hidden when the
    // BottomSheetScaffold is recomposed. With skipHiddenState=true, Compose throws
    // IllegalStateException: "Attempted to animate to hidden when skipHiddenState
    // was enabled" if any event (back press, configuration change) triggers hiding.
    val scaffoldState = rememberBottomSheetScaffoldState(
        bottomSheetState = rememberStandardBottomSheetState(
            skipHiddenState = false
        )
    )
    val scope = rememberCoroutineScope()

    // lastLoadedUrl tracks what the WebView has actually finished rendering (or reached 70% progress).
    // When currentUrl advances ahead of it (new URL set by ViewModel), the overlay stays up immediately
    // without waiting for onPageStarted to fire in the next frame.
    var webViewLoading by rememberSaveable { mutableStateOf(value = false) }
    var lastLoadedUrl by remember { mutableStateOf<String?>(null) }
    var loadingMessage by remember { mutableStateOf(pickRandomMessage()) }
    // Cycle the loading message with individual random durations while the overlay is visible
    val showOverlay = rawUrl == null || (state is RoamState.Loading)
    LaunchedEffect(showOverlay) {
        if (showOverlay) {
            loadingMessage = pickRandomMessage()
            while (true) {
                delay(loadingMessage.displayDurationMs)
                loadingMessage = pickRandomMessage()
            }
        }
    }

    // Only show the loading overlay when loading the roam URL. If the user navigates to a different URL
    // (by clicking a link), don't show the overlay — they're exploring, not waiting for a new roam.
    val loaded = state as? RoamState.Loaded
    val isRoaming = state is RoamState.Loading || 
                    (currentUrl == loaded?.roamUrl?.url && (webViewLoading || (currentUrl != lastLoadedUrl)))
    val categoryName: String? = loaded?.roamUrl?.categoryId
        ?.let { catId -> categories.firstOrNull { it.id == catId }?.let { "${it.icon} ${it.name}" } }
    val subcategoryName: String? = loaded?.roamUrl?.subcategoryId
        ?.let { subId -> subcategories.firstOrNull { it.id == subId }?.name }
    val domain: String? = rawUrl?.let { it.toUri().host?.removePrefix("www.") }

    // Persist last-known values so they stay visible between roams
    var lastCategoryName by remember { mutableStateOf<String?>(null) }
    var lastSubcategoryName by remember { mutableStateOf<String?>(null) }
    var lastDomain by remember { mutableStateOf<String?>(null) }

    if (!isRoaming) {
        categoryName?.let { lastCategoryName = it }
        subcategoryName?.let { lastSubcategoryName = it }
        domain?.let { lastDomain = it }
    } else {
        lastCategoryName = null
        lastSubcategoryName = null
        lastDomain = null
    }
    val displayCategory    = if (!isRoaming) categoryName    ?: lastCategoryName    else null
    val displaySubcategory = if (!isRoaming) subcategoryName ?: lastSubcategoryName else null
    val displayDomain      = if (!isRoaming) domain          ?: lastDomain          else null

    // Sync sheet expansion when ViewModel state changes.
    // Catch IllegalStateException specifically: when a configuration change or back press
    // causes the scaffold to hide the sheet while we're still trying to animate, the
    // IllegalStateException "Attempted to animate to hidden when skipHiddenState was enabled"
    // would otherwise crash the app (ROAM-ANDROID-J).
    LaunchedEffect(showConfigSheet) {
        try {
            if (showConfigSheet) {
                scaffoldState.bottomSheetState.expand()
            } else {
                // Collapse to peek height (can't fully hide with sheetPeekHeight enabled)
                scaffoldState.bottomSheetState.partialExpand()
            }
        } catch (_: IllegalStateException) {
            // State transition conflict — sheet was already being hidden by the scaffold.
            // Harmless; the visual state will resolve on the next recomposition.
        } catch (_: Exception) {
            // Silently handle any other unexpected state transition errors
        }
    }

    BottomSheetScaffold(
        modifier = Modifier,
        scaffoldState = scaffoldState,
        sheetContainerColor = Color.Transparent,
        sheetShadowElevation = 0.dp,
        sheetTonalElevation = 0.dp,
        sheetSwipeEnabled = sheetGestureMode == "slide",
        sheetDragHandle = {
            // Full-width invisible hit area so drag works everywhere across the bump
            if (sheetGestureMode == "tap") {
                // Tap mode: clickable handle to toggle sheet
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            if (showConfigSheet) {
                                vm.closeConfigSheet()
                            } else {
                                vm.openConfigSheet()
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier = Modifier
                            .width(44.dp)
                            .background(
                                color = MaterialTheme.colorScheme.surfaceContainer,
                                shape = RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp),
                            )
                            .padding(top = 4.dp, bottom = 2.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.KeyboardArrowUp,
                            contentDescription = "Open menu",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(12.dp),
                        )
                    }
                }
            } else {
                // Slide mode: default drag handle behavior
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier = Modifier
                            .width(44.dp)
                            .background(
                                color = MaterialTheme.colorScheme.surfaceContainer,
                                shape = RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp),
                            )
                            .padding(top = 4.dp, bottom = 2.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.KeyboardArrowUp,
                            contentDescription = "Open menu",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(12.dp),
                        )
                    }
                }
            }
        },
        sheetContent = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(0.dp),
            ) {
            ConfigBottomSheet(
                currentUrl = currentUrl,
                collections = collections,
                savedUrls = savedUrls,
                isTranslated = vm.isTranslated,
                onToggleTranslation = { vm.toggleTranslation() },
                onTranslate = { lang -> vm.translateTo(lang) },
                onSaveForLater = { vm.saveForLater() },
                onShare = {
                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, currentUrl ?: "")
                    }
                    activity.startActivity(Intent.createChooser(shareIntent, null))
                },
                onAddToCollection = { collectionId -> vm.addCurrentUrlToCollection(collectionId) },
                onCreateCollectionAndAdd = { name -> vm.createCollectionAndAdd(name) },
                onRoamWithinCategory = {
                    vm.roamWithinCategory()
                    scope.launch { scaffoldState.bottomSheetState.partialExpand() }
                },
                onRoamCollection = { collectionId ->
                    vm.roamCollection(collectionId)
                    scope.launch { scaffoldState.bottomSheetState.partialExpand() }
                },
                onManageCollections = {
                    onNavigateToSaved()
                    scope.launch { scaffoldState.bottomSheetState.partialExpand() }
                },
                onCategoryPrefs = {
                    CustomTabsIntent.Builder().build()
                        .launchUrl(activity, "https://roamtheweb.app/profile".toUri())
                    scope.launch { scaffoldState.bottomSheetState.partialExpand() }
                },
                onNavBack = {
                    vm.webNavBack()
                    scope.launch { scaffoldState.bottomSheetState.partialExpand() }
                },
                onNavForward = {
                    vm.webNavForward()
                    scope.launch { scaffoldState.bottomSheetState.partialExpand() }
                },
                onNavReload = {
                    vm.webNavReload()
                    scope.launch { scaffoldState.bottomSheetState.partialExpand() }
                },
                onRemoveSavedUrl = { url -> vm.removeSavedUrl(url) },
                onNavigateSavedUrl = { url ->
                    vm.navigateTo(url)
                    scope.launch { scaffoldState.bottomSheetState.partialExpand() }
                },
                onReportBrokenLink = {
                    vm.reportBrokenLink()
                    scope.launch { scaffoldState.bottomSheetState.partialExpand() }
                },
            )
            } // Surface
        },
        sheetPeekHeight = 15.dp,
    ) { contentPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding())) {

            // ── Status bar ───────────────────────────────────────────────────────
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.surfaceVariant,
            tonalElevation = 2.dp,
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                when {
                    state is RoamState.Error -> {
                        Text(
                            "\u26A0 ${(state as RoamState.Error).message}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.error,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(onClick = { vm.roam() }) {
                            Text("Retry", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                    state is RoamState.Exhausted -> {
                        Text(
                            "You've seen everything \u2014 adjust categories in Settings",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    !isOnline -> {
                        Text(
                            "\u26A0 Offline \u2014 ratings queued",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    else -> {
                        if (isRoaming) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(14.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "Roaming\u2026",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        } else {
                            val parts = listOfNotNull(displayCategory, displayDomain)
                            Text(
                                text = if (parts.isEmpty()) "Roam" else parts.joinToString(" \u00B7 "),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                            )
                            displaySubcategory?.let {
                                Text(
                                    text = it,
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    }
                }
            }
        }

        // ── Status messages (top) ─────────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceContainer),
        ) {
            // "Saved!" confirmation message
            if (savedConfirmation) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.secondaryContainer)
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Saved for later",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                }
            }

            // "Reported" confirmation message
            if (reportConfirmation) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.secondaryContainer)
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Dead link reported \u2014 loading next page",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                }
            }

            // Submit result message
            submitToast?.let { msg ->
                val isError = msg.startsWith("Couldn't")
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (isError) MaterialTheme.colorScheme.errorContainer
                            else MaterialTheme.colorScheme.secondaryContainer
                        )
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        msg,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (isError) MaterialTheme.colorScheme.onErrorContainer
                                else MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                }
            }
        }

        // ── WebView area ─────────────────────────────────────────────────────
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
        ) {
            RoamWebView(
                url = currentUrl,
                modifier = Modifier.fillMaxSize(),
                darkMode = webDarkMode,
                jsEnabled = jsEnabled,
                onUrlChanged = { vm.onWebViewUrlChanged(it) },
                onLoadError = { vm.roam() },
                onLoadingChanged = { loading ->
                    webViewLoading = loading
                    if (!loading) lastLoadedUrl = currentUrl
                },
                // Hide the loading overlay as soon as the first frame paints
                // (onPageCommitVisible), not when all JS finishes (onPageFinished).
                onPageVisible = {
                    webViewLoading = false
                    lastLoadedUrl = currentUrl
                },
                // Trigger proactive cache warming: as soon as the current page
                // finishes loading, tell the ViewModel to expose the next URL
                // so the hidden prefetch WebView can start warming it now,
                // while the user is still reading.
                onPageFinishedForPrefetch = {
                    vm.onPageFinishedForPrefetch()
                },
                navCommandsFlow = vm.webNavFlow,
                clearCookiesFlow = vm.clearCookiesFlow,
            )

            // Loading overlay — shown while fetching a URL or the WebView is rendering it
            if (rawUrl == null || isRoaming) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(40.dp),
                            strokeWidth = 3.dp,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.size(16.dp))
                        Text(
                            text = loadingMessage.text,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            // Background cache-warmer — only active when the user has enabled the setting.
            // Loads the next queued URL in a hidden 1×1dp WebView so it's already cached
            // when the user taps Roam, eliminating most of the visible overlay delay.
            if (prefetchWebView && nextPrefetchUrl != null) {
                BackgroundPrefetchWebView(
                    url = nextPrefetchUrl!!,
                    jsEnabled = jsEnabled,
                    darkMode = webDarkMode,
                )
            }


        }
    }
}

    if (showSubmitSheet) {
        SubmitBottomSheet(
            url = rawUrl ?: currentUrl,
            categories = categories,
            onSubmit = { submittedUrl, categoryId -> vm.submitUrl(submittedUrl, categoryId) },
            onDismiss = { vm.closeSubmitSheet() },
        )
    }
}