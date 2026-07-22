package app.roam.android.ui.screen

import android.Manifest
import android.content.Intent
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.BottomSheetScaffold
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberBottomSheetScaffoldState
import androidx.compose.material3.rememberStandardBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.roam.android.MainActivity
import app.roam.android.ui.component.BackgroundPrefetchWebView
import app.roam.android.ui.component.BottomBar
import app.roam.android.ui.component.ConfigBottomSheet
import app.roam.android.ui.component.RoamTab
import app.roam.android.ui.component.Tour
import app.roam.android.ui.component.RoamWebView
import app.roam.android.ui.component.ShareUrlBottomSheet
import app.roam.android.ui.component.SubmitBottomSheet
import app.roam.android.ui.component.UserSearchSheet
import app.roam.android.ui.component.pickRandomMessage
import app.roam.android.viewmodel.MainViewModel
import app.roam.android.viewmodel.RoamState
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.milliseconds


@Composable
fun MainScreen(
    vm: MainViewModel,
    activity: MainActivity,
    onSignOut: () -> Unit = {},
    onNavigateToInterests: () -> Unit = {},
) {
    val context = LocalContext.current
    var currentTab by rememberSaveable { mutableStateOf(RoamTab.Roam.route) }
    var viewedUsername by rememberSaveable { mutableStateOf<String?>(null) }
    var showUserSearch by remember { mutableStateOf(false) }
    val focusModeEnabled by vm.focusModeEnabled.collectAsState()
    val hasRatedUp by vm.hasRatedUp.collectAsState()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val launcher = rememberLauncherForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { isGranted ->
            if (isGranted) android.util.Log.d("MainScreen", "Notification permission granted")
            else android.util.Log.d("MainScreen", "Notification permission denied")
        }
        LaunchedEffect(Unit) {
            if (androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    // Sign out handler
    val doSignOut: () -> Unit = {
        vm.resetForNewSession()
        onSignOut()
        currentTab = RoamTab.Roam.route
    }

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
        Box(Modifier.fillMaxSize().padding(innerPadding)) {
            BackHandler(enabled = currentTab != RoamTab.Roam.route) {
                currentTab = RoamTab.Roam.route
            }

            // DiscoverTab always alive
            DiscoverTab(
                vm = vm,
                activity = activity,
                onNavigate = { currentTab = it },
                onNavigateToSaved = { currentTab = RoamTab.Saved.route },
                onNavigateToInterests = onNavigateToInterests,
            )

            // ── You tab (hub) ──────────────────────────────────────
            AnimatedVisibility(
                visible = currentTab == RoamTab.You.route,
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                YouScreen(
                    vm = vm,
                    onSignOut = doSignOut,
                    onNavigateToProfile = { currentTab = RoamTab.Profile.route },
                    onNavigateToSaved = { currentTab = RoamTab.Saved.route },
                    onNavigateToHistory = { currentTab = RoamTab.History.route },
                    onNavigateToNotifications = { currentTab = RoamTab.Notifications.route },
                    onNavigateToBadges = { currentTab = RoamTab.Badges.route },
                    onNavigateToLeaderboard = { currentTab = RoamTab.Leaderboard.route },
                    onNavigateToActivityFeed = { currentTab = RoamTab.ActivityFeed.route },
                    onNavigateToSettings = { currentTab = RoamTab.Settings.route },
                    onNavigateToPublicProfile = { username ->
                        viewedUsername = username
                        currentTab = RoamTab.PublicProfile.route
                    },
                    onNavigateToRoam = { currentTab = RoamTab.Roam.route },
                    onOpenUserSearch = { showUserSearch = true },
                    onNavigateToAdmin = { currentTab = RoamTab.Admin.route },
                )
            }

            // ── Settings ───────────────────────────────────────────
            AnimatedVisibility(
                visible = currentTab == RoamTab.Settings.route,
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                SettingsScreen(
                    vm = vm,
                    onSignOut = doSignOut,
                    onNavigateToSaved = { currentTab = RoamTab.Saved.route },
                    onNavigateToProfile = { currentTab = RoamTab.Profile.route },
                    onNavigateToHistory = { currentTab = RoamTab.History.route },
                    onNavigateToNotifications = { currentTab = RoamTab.Notifications.route },
                    onNavigateToRoam = { currentTab = RoamTab.Roam.route },
                )
            }

            // ── Saved ──────────────────────────────────────────────
            AnimatedVisibility(
                visible = currentTab == RoamTab.Saved.route,
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                SavedScreen(
                    vm = vm,
                    onNavigateBack = { currentTab = RoamTab.You.route },
                    onNavigateToUrl = { url ->
                        vm.navigateToWeb(url)
                        currentTab = RoamTab.Roam.route
                    },
                )
            }

            // ── Profile ────────────────────────────────────────────
            AnimatedVisibility(
                visible = currentTab == RoamTab.Profile.route,
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                ProfileScreen(
                    vm = vm,
                    onNavigateBack = { currentTab = RoamTab.You.route },
                    onSignOut = doSignOut,
                    onNavigateToBadges = { currentTab = RoamTab.Badges.route },
                )
            }

            // ── History ────────────────────────────────────────────
            AnimatedVisibility(
                visible = currentTab == RoamTab.History.route,
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                HistoryScreen(
                    vm = vm,
                    onNavigateBack = { currentTab = RoamTab.You.route },
                    onNavigateToUrl = { url ->
                        vm.navigateTo(url)
                        currentTab = RoamTab.Roam.route
                    },
                )
            }

            // ── Notifications ──────────────────────────────────────
            AnimatedVisibility(
                visible = currentTab == RoamTab.Notifications.route,
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                NotificationsScreen(
                    vm = vm,
                    onNavigateBack = { currentTab = RoamTab.You.route },
                    onNavigateToUrl = { url ->
                        vm.navigateTo(url)
                        currentTab = RoamTab.Roam.route
                    },
                )
            }

            // ── Activity Feed ──────────────────────────────────────
            AnimatedVisibility(
                visible = currentTab == RoamTab.ActivityFeed.route,
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                ActivityFeedScreen(
                    vm = vm,
                    onNavigateBack = { currentTab = RoamTab.You.route },
                    onNavigateToProfile = { username ->
                        viewedUsername = username
                        currentTab = RoamTab.PublicProfile.route
                    },
                    onNavigateToUrl = { url ->
                        vm.navigateToWeb(url)
                        currentTab = RoamTab.Roam.route
                    },
                )
            }

            // ── Badges ─────────────────────────────────────────────
            AnimatedVisibility(
                visible = currentTab == RoamTab.Badges.route,
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                BadgesScreen(vm = vm, onNavigateBack = { currentTab = RoamTab.You.route })
            }

            // ── Leaderboard ────────────────────────────────────────
            AnimatedVisibility(
                visible = currentTab == RoamTab.Leaderboard.route,
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                LeaderboardScreen(
                    vm = vm,
                    onNavigateBack = { currentTab = RoamTab.You.route },
                    onNavigateToProfile = { username ->
                        viewedUsername = username
                        currentTab = RoamTab.PublicProfile.route
                    },
                )
            }

            // ── Public Profile ─────────────────────────────────────
            AnimatedVisibility(
                visible = currentTab == RoamTab.PublicProfile.route && viewedUsername != null,
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                PublicProfileScreen(
                    vm = vm,
                    username = viewedUsername!!,
                    onNavigateBack = { currentTab = RoamTab.You.route },
                    onNavigateToUrl = { url ->
                        vm.navigateTo(url)
                        currentTab = RoamTab.Roam.route
                    },
                )
            }

            // ── Admin / Moderator Panel ─────────────────────────────
            val adminModeEnabled by vm.adminModeEnabled.collectAsState()
            val moderatorModeEnabled by vm.moderatorModeEnabled.collectAsState()
            val openInBrowser: (String) -> Unit = { url ->
                val intent = Intent(Intent.ACTION_VIEW, url.toUri())
                activity.startActivity(intent)
            }
            AnimatedVisibility(
                visible = currentTab == RoamTab.Admin.route && (adminModeEnabled || moderatorModeEnabled),
                enter = fadeIn(spring()),
                exit = fadeOut(spring()),
            ) {
                AdminScreen(
                    vm = vm,
                    isAdmin = adminModeEnabled,
                    onNavigateToRoam = { currentTab = RoamTab.Roam.route },
                    onNavigateToWeb = { url ->
                        vm.navigateToWeb(url)
                        currentTab = RoamTab.Roam.route
                    },
                    onOpenInBrowser = openInBrowser,
                )
            }

            // ── User Search Sheet ──────────────────────────────────
            if (showUserSearch) {
                UserSearchSheet(
                    vm = vm,
                    onDismiss = { showUserSearch = false },
                    onSelectUser = { username ->
                        showUserSearch = false
                        viewedUsername = username
                        currentTab = RoamTab.PublicProfile.route
                    },
                )
            }

            // ── Interactive Tour (top-level, survives tab switches) ──
            if (!vm.hasSeenWalkthrough()) {
                Tour(
                    onDismiss = { vm.markWalkthroughSeen() },
                    onNavigateToYouTab = { currentTab = RoamTab.You.route },
                    onOpenConfigSheet = { vm.openConfigSheet() },
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
    onNavigate: (String) -> Unit,
    onNavigateToSaved: () -> Unit = {},
    onNavigateToInterests: () -> Unit = {},
) {
    // No-op usage to suppress unused parameter warning while keeping the API consistent
    LaunchedEffect(onNavigate) { /* no-op */ }
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
    val adminModeEnabled by vm.adminModeEnabled.collectAsState()
    val prefetchWebView by vm.prefetchWebView.collectAsState()
    val nextPrefetchUrl by vm.nextPrefetchUrl.collectAsState()
    val showShareUrlSheet by vm.showShareUrlSheet.collectAsState()

    var initialRoamDone by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (!initialRoamDone) {
            initialRoamDone = true
            if (state is RoamState.Idle || currentUrl == null) {
                vm.roam()
            }
        }
    }

    val scaffoldState = rememberBottomSheetScaffoldState(
        bottomSheetState = rememberStandardBottomSheetState(
            initialValue = SheetValue.PartiallyExpanded,
            skipHiddenState = true,
        )
    )
    val scope = rememberCoroutineScope()

    var webViewLoading by rememberSaveable { mutableStateOf(false) }
    var lastLoadedUrl by remember { mutableStateOf<String?>(null) }
    var loadingMessage by remember { mutableStateOf(pickRandomMessage()) }
    var webViewRecovering by remember { mutableStateOf(false) }
    val loaded = state as? RoamState.Loaded
    val isRoaming = state is RoamState.Loading ||
            (currentUrl == loaded?.roamUrl?.url && (webViewLoading || (currentUrl != lastLoadedUrl)))
    val showOverlay = rawUrl == null || isRoaming || webViewRecovering
    LaunchedEffect(showOverlay) {
        if (showOverlay) {
            loadingMessage = pickRandomMessage()
            while (true) {
                delay(loadingMessage.displayDurationMs.milliseconds)
                loadingMessage = pickRandomMessage()
            }
        }
    }
    val categoryName: String? = loaded?.roamUrl?.categoryId
        ?.let { catId -> categories.firstOrNull { it.id == catId }?.let { "${it.icon} ${it.name}" } }
    val subcategoryName: String? = loaded?.roamUrl?.subcategoryId
        ?.let { subId -> subcategories.firstOrNull { it.id == subId }?.name }
    val domain: String? = rawUrl?.let { it.toUri().host?.removePrefix("www.") }

    var lastCategoryName by remember { mutableStateOf<String?>(null) }
    var lastSubcategoryName by remember { mutableStateOf<String?>(null) }
    var lastDomain by remember { mutableStateOf<String?>(null) }

    if (!isRoaming) { categoryName?.let { lastCategoryName = it }; subcategoryName?.let { lastSubcategoryName = it }; domain?.let { lastDomain = it } }
    else { lastCategoryName = null; lastSubcategoryName = null; lastDomain = null }
    val displayCategory = if (!isRoaming) categoryName ?: lastCategoryName else null
    val displaySubcategory = if (!isRoaming) subcategoryName ?: lastSubcategoryName else null
    val displayDomain = if (!isRoaming) domain ?: lastDomain else null

    // While true, ignore sheet→VM reverse sync (used during resume re-assert so a
    // stale Expanded value cannot flip showConfigSheet back to true).
    var suppressSheetToVm by remember { mutableStateOf(false) }
    val showConfigSheetLatest = rememberUpdatedState(showConfigSheet)

    // VM flag → physical sheet (open/close from tap handle, Tour, etc.)
    LaunchedEffect(showConfigSheet) {
        try {
            if (showConfigSheet) scaffoldState.bottomSheetState.expand()
            else scaffoldState.bottomSheetState.partialExpand()
        } catch (_: Exception) { }
    }

    // On first composition, Material3 may render the sheet expanded before it
    // settles into PartiallyExpanded. Force-collapse after a short delay so the
    // config sheet always starts closed on fresh app launches.
    LaunchedEffect(Unit) {
        delay(200)
        try {
            scaffoldState.bottomSheetState.partialExpand()
        } catch (_: Exception) { }
    }

    // User swipe (slide mode) can expand/collapse without touching the VM.
    // Mirror settled sheet state back so the flag stays accurate.
    // drop(1) skips the initial emission (PartiallyExpanded) so we don't
    // flip showConfigSheet to false on first composition before the sheet
    // settles — that would create a feedback loop locking the sheet open.
    LaunchedEffect(scaffoldState.bottomSheetState) {
        snapshotFlow { scaffoldState.bottomSheetState.currentValue }
            .drop(1)
            .collect { value ->
                if (suppressSheetToVm) return@collect
                when (value) {
                    SheetValue.Expanded -> vm.openConfigSheet()
                    SheetValue.PartiallyExpanded -> vm.closeConfigSheet()
                    else -> { /* Hidden not used (skipHiddenState) */ }
                }
            }
    }

    // After background→foreground, Material3 often remeasures and leaves the sheet
    // Expanded even though showConfigSheet is still false. Re-apply the VM flag on
    // every resume (after a short settle delay for insets / WebView restore).
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event != Lifecycle.Event.ON_RESUME) return@LifecycleEventObserver
            scope.launch {
                suppressSheetToVm = true
                try {
                    delay(80)
                    if (showConfigSheetLatest.value) {
                        scaffoldState.bottomSheetState.expand()
                    } else {
                        scaffoldState.bottomSheetState.partialExpand()
                    }
                    // Let the sheet settle before accepting swipe→VM updates again.
                    delay(120)
                } catch (_: Exception) {
                } finally {
                    suppressSheetToVm = false
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }


    BottomSheetScaffold(
        modifier = Modifier,
        scaffoldState = scaffoldState,
        sheetContainerColor = Color.Transparent,
        sheetShadowElevation = 0.dp,
        sheetTonalElevation = 0.dp,
        sheetSwipeEnabled = sheetGestureMode == "slide",
        sheetDragHandle = {
            if (sheetGestureMode == "tap") {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clickable {
                            if (showConfigSheet) vm.closeConfigSheet() else vm.openConfigSheet()
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        Modifier
                            .width(56.dp)
                            .background(
                                MaterialTheme.colorScheme.surfaceContainer,
                                RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp)
                            )
                            .padding(top = 6.dp, bottom = 4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Filled.KeyboardArrowUp,
                            "Open menu",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            } else {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Box(
                        Modifier
                            .width(56.dp)
                            .background(
                                MaterialTheme.colorScheme.surfaceContainer,
                                RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp)
                            )
                            .padding(top = 6.dp, bottom = 4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Filled.KeyboardArrowUp,
                            "Open menu",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        },
        sheetContent = {
            Surface(
                Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(0.dp)
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
                        val si = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, currentUrl ?: "") }
                        activity.startActivity(Intent.createChooser(si, null))
                    },
                    onShareWithFriend = { vm.openShareUrlSheet() },
                    onAddToCollection = { cid -> vm.addCurrentUrlToCollection(cid) },
                    onCreateCollectionAndAdd = { name -> vm.createCollectionAndAdd(name) },
                    onRoamWithinCategory = { vm.roamWithinCategory(); scope.launch { scaffoldState.bottomSheetState.partialExpand() } },
                    onRoamCollection = { cid -> vm.roamCollection(cid); scope.launch { scaffoldState.bottomSheetState.partialExpand() } },
                    onManageCollections = { onNavigateToSaved(); scope.launch { scaffoldState.bottomSheetState.partialExpand() } },
                    onCategoryPrefs = { onNavigateToInterests(); scope.launch { scaffoldState.bottomSheetState.partialExpand() } },
                    onNavBack = { vm.webNavBack(); scope.launch { scaffoldState.bottomSheetState.partialExpand() } },
                    onNavForward = { vm.webNavForward(); scope.launch { scaffoldState.bottomSheetState.partialExpand() } },
                    onNavReload = { vm.webNavReload(); scope.launch { scaffoldState.bottomSheetState.partialExpand() } },
                    onRemoveSavedUrl = { url -> vm.removeSavedUrl(url) },
                    onNavigateSavedUrl = { url -> vm.navigateTo(url); scope.launch { scaffoldState.bottomSheetState.partialExpand() } },
                    onReportBrokenLink = { vm.reportBrokenLink(); scope.launch { scaffoldState.bottomSheetState.partialExpand() } },
                    adminModeEnabled = adminModeEnabled,
                    isModerator = vm.isModerator.collectAsState().value,
                    moderatorModeEnabled = vm.moderatorModeEnabled.collectAsState().value,
                    onAdminNavigateToUrl = { url ->
                        // Open admin panels in the system browser instead of the
                        // WebView — avoids Google OAuth "Use secure browsers" block.
                        val intent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url))
                        activity.startActivity(intent)
                        scope.launch { scaffoldState.bottomSheetState.partialExpand() }
                    },
                )
            }
        },
        sheetPeekHeight = 28.dp,
    ) { contentPadding ->
        Column(Modifier.fillMaxSize().padding(top = contentPadding.calculateTopPadding())) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surfaceVariant,
                tonalElevation = 2.dp,
            ) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    when {
                        state is RoamState.Error -> {
                            Text("\u26A0 ${(state as RoamState.Error).message}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                            TextButton(onClick = { vm.roam() }) { Text("Retry", style = MaterialTheme.typography.labelMedium) }
                        }
                        state is RoamState.Exhausted -> Text("You've seen everything \u2014 adjust categories in Settings", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        !isOnline -> Text("\u26A0 Offline \u2014 ratings queued", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        else -> {
                            if (isRoaming) {
                                CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.primary)
                                Spacer(Modifier.width(8.dp))
                                Text("Roaming\u2026", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            } else {
                                val parts = listOfNotNull(displayCategory, displayDomain)
                                Text(if (parts.isEmpty()) "Roam" else parts.joinToString(" \u00B7 "), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                displaySubcategory?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f), maxLines = 1, overflow = TextOverflow.Ellipsis) }
                            }
                        }
                    }
                }
            }

            Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceContainer)) {
                if (savedConfirmation) Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.secondaryContainer).padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) { Text("Saved for later", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSecondaryContainer) }
                if (reportConfirmation) Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.secondaryContainer).padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) { Text("Dead link reported \u2014 loading next page", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSecondaryContainer) }
            }

            Box(Modifier.weight(1f).fillMaxWidth()) {
                RoamWebView(
                    url = currentUrl,
                    modifier = Modifier.fillMaxSize(),
                    darkMode = webDarkMode,
                    jsEnabled = jsEnabled,
                    onUrlChanged = { vm.onWebViewUrlChanged(it) },
                    onLoadError = { vm.roam() },
                    onLoadingChanged = { loading -> webViewLoading = loading; if (!loading) lastLoadedUrl = currentUrl },
                    onPageVisible = { webViewLoading = false; lastLoadedUrl = currentUrl },
                    onRecovering = { recovering -> webViewRecovering = recovering },
                    onPageFinishedForPrefetch = { vm.onPageFinishedForPrefetch() },
                    navCommandsFlow = vm.webNavFlow,
                    clearCookiesFlow = vm.clearCookiesFlow,
                )

                if (showOverlay) {
                    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(Modifier.size(40.dp), strokeWidth = 3.dp, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.size(16.dp))
                            Text(loadingMessage.text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }

                if (prefetchWebView && nextPrefetchUrl != null) {
                    BackgroundPrefetchWebView(url = nextPrefetchUrl!!, jsEnabled = jsEnabled, darkMode = webDarkMode)
                }
            }
        }
    }

    if (showSubmitSheet) {
        SubmitBottomSheet(url = rawUrl ?: currentUrl, categories = categories, onSubmit = { submittedUrl, categoryId -> vm.submitUrl(submittedUrl, categoryId) }, onDismiss = { vm.closeSubmitSheet() })
    }

    // Share URL with friend sheet
    if (showShareUrlSheet) {
        ShareUrlBottomSheet(vm = vm, onDismiss = { vm.closeShareUrlSheet() })
    }

    // Global toast — rendered last so it always sits above sheets, dialogs, and overlays.
    // When submitToast fires from inside the submit bottom sheet or SettingsScreen's dialog,
    // the sheet/dialog is dismissed, but this toast continues to display over everything.
    submitToast?.let { msg ->
        val isErr = msg.startsWith("Couldn't")
        Box(
            Modifier
                .fillMaxSize(),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(if (isErr) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.secondaryContainer)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    msg,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isErr) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSecondaryContainer,
                )
            }
        }
    }
}
