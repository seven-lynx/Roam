package app.roam.android.ui.screen

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.roam.android.MainActivity
import app.roam.android.ui.component.BottomBar
import app.roam.android.ui.component.ConfigBottomSheet
import app.roam.android.ui.component.RoamTab
import app.roam.android.ui.component.RoamWebView
import app.roam.android.ui.component.SubmitBottomSheet
import app.roam.android.viewmodel.MainViewModel
import app.roam.android.viewmodel.RoamState

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
            )
        },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            // DiscoverTab is always in the composition tree — WebView is never destroyed
            DiscoverTab(vm = vm, activity = activity, onSignOut = {
                onSignOut()
                currentTab = RoamTab.Roam.route
            })

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
                )
            }

            AnimatedVisibility(
                visible = currentTab == RoamTab.Saved.route,
                enter = fadeIn(animationSpec = spring()),
                exit = fadeOut(animationSpec = spring()),
            ) {
                SavedScreen(
                    vm = vm,
                    onNavigateToDiscover = { currentTab = RoamTab.Roam.route },
                )
            }

            AnimatedVisibility(
                visible = currentTab == RoamTab.Profile.route,
                enter = fadeIn(animationSpec = spring()),
                exit = fadeOut(animationSpec = spring()),
            ) {
                ProfileScreen(vm = vm, onSignOut = {
                    onSignOut()
                    currentTab = RoamTab.Roam.route
                })
            }
        }
    }
}

// ── Discover tab ──────────────────────────────────────────────────────────────

@Composable
private fun DiscoverTab(
    vm: MainViewModel,
    activity: MainActivity,
    onSignOut: () -> Unit = {},
) {
    val context = LocalContext.current

    val state by vm.state.collectAsState()
    val currentUrl by vm.currentUrl.collectAsState()
    val rawUrl by vm.rawUrl.collectAsState()
    val showSubmitSheet by vm.showSubmitSheet.collectAsState()
    val showConfigSheet by vm.showConfigSheet.collectAsState()
    val savedConfirmation by vm.savedConfirmation.collectAsState()
    val submitToast by vm.submitToast.collectAsState()
    val collections by vm.collections.collectAsState()
    val categories by vm.categories.collectAsState()
    val savedUrls by vm.savedUrls.collectAsState()
    val isOnline by vm.isOnline.collectAsState()
    val webDarkMode by vm.webDarkMode.collectAsState()
    val jsEnabled by vm.jsEnabled.collectAsState()

    // Only auto-roam on first entry (Idle = fresh app launch).
    LaunchedEffect(Unit) { if (vm.state.value is RoamState.Idle) vm.roam() }

    // True while either the edge function is fetching OR the WebView is loading the page
    var webViewLoading by rememberSaveable { mutableStateOf(false) }
    val isRoaming = state is RoamState.Loading || webViewLoading

    // Derive category name and domain from the loaded result / current URL
    val loaded = state as? RoamState.Loaded
    val categoryName: String? = loaded?.roamUrl?.categoryId
        ?.let { catId -> categories.firstOrNull { it.id == catId }?.let { "${it.icon} ${it.name}" } }
    val domain: String? = rawUrl?.let { Uri.parse(it).host?.removePrefix("www.") }

    // Persist last-known values so they stay visible between roams
    var lastCategoryName by remember { mutableStateOf<String?>(null) }
    var lastDomain by remember { mutableStateOf<String?>(null) }
    if (!isRoaming) {
        if (categoryName != null) lastCategoryName = categoryName
        if (domain != null) lastDomain = domain
    } else {
        lastCategoryName = null
        lastDomain = null
    }
    val displayCategory = if (!isRoaming) categoryName ?: lastCategoryName else null
    val displayDomain   = if (!isRoaming) domain ?: lastDomain else null

    Column(modifier = Modifier.fillMaxSize()) {

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
                            "⚠ ${(state as RoamState.Error).message}",
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
                            "You've seen everything — adjust categories in Settings",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    !isOnline -> {
                        Text(
                            "⚠ Offline — ratings queued",
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
                                "Roaming…",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        } else {
                            val parts = listOfNotNull(displayCategory, displayDomain)
                            Text(
                                text = if (parts.isEmpty()) "Roam" else parts.joinToString(" · "),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
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
                onLoadingChanged = { webViewLoading = it },
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
                            text = if (rawUrl == null) "Finding something great…" else "Loading…",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            // "Saved!" confirmation snackbar
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
                        "Saved for later",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                }
            }

            // Submit result toast
            submitToast?.let { msg ->
                val isError = msg.startsWith("Couldn't")
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
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
    }

    if (showSubmitSheet) {
        SubmitBottomSheet(
            url = rawUrl ?: currentUrl,
            categories = categories,
            onSubmit = { submittedUrl, categoryId -> vm.submitUrl(submittedUrl, categoryId) },
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
            onSaveForLater = { vm.saveForLater(); vm.closeConfigSheet() },
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
                vm.navigateTo("https://roamtheweb.app/profile")
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
                onSignOut()
            },
        )
    }
}
