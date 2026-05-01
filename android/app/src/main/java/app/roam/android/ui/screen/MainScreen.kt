package app.roam.android.ui.screen

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.roam.android.MainActivity
import app.roam.android.viewmodel.MainViewModel
import app.roam.android.viewmodel.RoamState
import app.roam.android.ui.component.BottomBar
import app.roam.android.ui.component.ConfigBottomSheet
import app.roam.android.ui.component.RoamWebView
import app.roam.android.ui.component.SubmitBottomSheet
import kotlin.math.abs

/** Minimum drag distance (px) required to trigger a gesture action */
private const val SWIPE_THRESHOLD = 80f
private const val PULL_DOWN_THRESHOLD = 100f

@Composable
fun MainScreen(
    vm: MainViewModel,
    activity: MainActivity,
    onSignOut: () -> Unit = {},
) {
    val context = LocalContext.current
    val state by vm.state.collectAsState()
    val currentUrl by vm.currentUrl.collectAsState()
    val showSubmitSheet by vm.showSubmitSheet.collectAsState()
    val showConfigSheet by vm.showConfigSheet.collectAsState()
    val skipPaywalled by vm.skipPaywalled.collectAsState()
    val preferredLanguages by vm.preferredLanguages.collectAsState()
    val savedConfirmation by vm.savedConfirmation.collectAsState()
    val collections by vm.collections.collectAsState()
    val categories by vm.categories.collectAsState()

    // Auto-load the first page when the screen appears
    LaunchedEffect(Unit) {
        vm.roam()
    }

    Scaffold(
        bottomBar = {
            BottomBar(
                onRoam = { vm.roam() },
                onThumbsUp = { vm.thumbsUp(context) },
                onThumbsDown = { vm.thumbsDown(context) },
                onConfig = { vm.openConfigSheet() },
            )
        },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            // WebView
            RoamWebView(
                url = currentUrl,
                modifier = Modifier.fillMaxSize(),
                onUrlChanged = { vm.onWebViewUrlChanged(it) },
                onLoadError = { vm.roam() },
            )

            // Gesture overlay — transparent layer on top for swipe/pull detection.
            // Buttons underneath remain fully tappable; gestures are shortcuts only.
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        detectDragGestures { change, dragAmount ->
                            change.consume()
                            val dx = dragAmount.x
                            val dy = dragAmount.y
                            when {
                                // Pull down → Roam
                                dy > PULL_DOWN_THRESHOLD && abs(dy) > abs(dx) -> vm.roam()
                                // Swipe right → 👍
                                dx > SWIPE_THRESHOLD && abs(dx) > abs(dy) -> vm.thumbsUp(context)
                                // Swipe left → 👎
                                dx < -SWIPE_THRESHOLD && abs(dx) > abs(dy) -> vm.thumbsDown(context)
                            }
                        }
                    },
            )

            // Loading indicator
            if (state is RoamState.Loading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter))
            }

            // API error banner — persistent, shown until user retries
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
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = { vm.roam() }) {
                        Text(
                            text = "Retry",
                            color = MaterialTheme.colorScheme.onErrorContainer,
                        )
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
                        modifier = Modifier.weight(1f),
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
                        text = "Add more categories in Settings",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    TextButton(onClick = { vm.openConfigSheet() }) {
                        Text("Open Settings")
                    }
                }
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
            skipPaywalled = skipPaywalled,
            preferredLanguages = preferredLanguages,
            collections = collections,
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
            onAddToCollection = { collectionId ->
                vm.addCurrentUrlToCollection(collectionId)
            },
            onCreateCollectionAndAdd = { name ->
                vm.createCollectionAndAdd(name)
            },
            onRoamWithinCategory = {
                vm.roamWithinCategory()
            },
            onRoamCollection = { collectionId ->
                vm.roamCollection(collectionId)
            },
            onManageCollections = {
                CustomTabsIntent.Builder().build()
                    .launchUrl(context, Uri.parse("https://roamtheweb.app/u/me"))
                vm.closeConfigSheet()
            },
            onCategoryPrefs = {
                CustomTabsIntent.Builder().build()
                    .launchUrl(context, Uri.parse("https://roamtheweb.app/join"))
                vm.closeConfigSheet()
            },
            onSkipPaywalledChange = { vm.setSkipPaywalled(it) },
            onLanguagesChange = { vm.setPreferredLanguages(it) },
            onSignOut = {
                vm.closeConfigSheet()
                onSignOut()
            },
        )
    }
}
