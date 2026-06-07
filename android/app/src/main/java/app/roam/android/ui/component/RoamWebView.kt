package app.roam.android.ui.component
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.core.graphics.createBitmap
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import app.roam.android.viewmodel.WebNavCommand
import kotlinx.coroutines.flow.Flow

@Composable
fun RoamWebView(
    url: String?,
    modifier: Modifier = Modifier,
    darkMode: Boolean = true,
    jsEnabled: Boolean = true,
    onUrlChanged: (String) -> Unit = {},
    onLoadError: () -> Unit = {},
    onLoadingChanged: (Boolean) -> Unit = {},
    navCommandsFlow: Flow<WebNavCommand>? = null,
    clearCookiesFlow: Flow<Unit>? = null,
) {
    var loadError by remember { mutableStateOf(value = false) }
    // Persists WebView back/forward history + current URL across process death
    val savedState = rememberSaveable { Bundle() }
    // Hold a stable reference so lifecycle observer can reach it
    val webViewRef = remember { mutableStateOf<WebView?>(null) }
    // Keep a stable url reference for use inside the lifecycle observer
    val urlRef = remember { mutableStateOf(url) }
    LaunchedEffect(url) {
        urlRef.value = url
        // Reset the error state whenever we get a new URL to try.
        // This ensures that "Try next page" can actually escape the error screen.
        loadError = false
    }
    // Scroll position saved on pause, restored after the page reloads
    val savedScrollY = rememberSaveable { mutableIntStateOf(0) }
    // Snapshot of the last visible viewport — shown as an overlay while the page reloads
    // after renderer death, eliminating the white-screen flash.
    var snapshotBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var showSnapshot by remember { mutableStateOf(false) }

    LaunchedEffect(navCommandsFlow) {
        navCommandsFlow?.collect { cmd ->
            val wv = webViewRef.value ?: return@collect
            when (cmd) {
                WebNavCommand.Back    -> wv.goBack()
                WebNavCommand.Forward -> wv.goForward()
                WebNavCommand.Reload  -> wv.reload()
            }
        }
    }

    LaunchedEffect(clearCookiesFlow) {
        clearCookiesFlow?.collect {
            CookieManager.getInstance().removeAllCookies(null)
            CookieManager.getInstance().flush()
            WebStorage.getInstance().deleteAllData()
            webViewRef.value?.reload()
        }
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> {
                    val wv = webViewRef.value ?: return@LifecycleEventObserver
                    // If the renderer was killed while backgrounded, the WebView url is null.
                    if (wv.url.isNullOrEmpty()) {
                        showSnapshot = true
                        if (!savedState.isEmpty) {
                            wv.restoreState(savedState)
                        } else {
                            urlRef.value?.let { wv.loadUrl(it) }
                        }
                    } else {
                        // WebView is alive — restore the page's scroll position using
                        // JavaScript. We use evaluateJavascript("window.scrollTo") rather
                        // than wv.scrollTo() because the latter operates on the Android
                        // View's scroll, not the web page content's scroll position.
                        // Do NOT call onPause()/onResume() or pauseTimers()/resumeTimers()
                        // — they interfere with the WebView's internal state and can reset
                        // scroll to 0.
                        val sy = savedScrollY.intValue
                        savedScrollY.intValue = 0
                        if (sy > 0) {
                            wv.post {
                                wv.evaluateJavascript(
                                    "window.scrollTo(0, $sy);",
                                    null,
                                )
                            }
                        }
                    }
                }
                Lifecycle.Event.ON_PAUSE -> {
                    webViewRef.value?.let { wv ->
                        if ((wv.width > 0) && (wv.height > 0)) {
                            val bmp = createBitmap(wv.width, wv.height, Bitmap.Config.ARGB_8888)
                            wv.draw(Canvas(bmp))
                            snapshotBitmap = bmp
                        }
                        // Capture the page's actual scroll position via JavaScript.
                        // wv.scrollY returns the Android View's scroll offset, which on
                        // many devices does not track the DOM scroll position.
                        wv.evaluateJavascript(
                            "(function(){var d=document.documentElement;var b=document.body;return d.scrollTop||b.scrollTop||window.pageYOffset||0;})()",
                        ) { result ->
                            val parsed = result?.removeSurrounding("\"")?.toIntOrNull() ?: 0
                            savedScrollY.intValue = parsed
                        }
                        wv.saveState(savedState)
                    }
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // url == null means we're waiting for the first roam — keep the WebView out of the
    // tree until we have something to load. The loading overlay is handled by DiscoverTab.
    if (url == null) {
        Box(modifier = modifier.fillMaxSize())
        return
    }

    if (loadError) {
        Box(
            modifier = modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "This page couldn't load.",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                TextButton(onClick = onLoadError) {
                    Text("Try next page")
                }
            }
        }
        return
    }

    Box(modifier = modifier) {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            try {
                WebView(context).apply {
                    settings.apply {
                        @Suppress("SetJavaScriptEnabled")
                        javaScriptEnabled = jsEnabled
                        domStorageEnabled = jsEnabled
                        cacheMode = android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK
                        setSupportZoom(true)
                        builtInZoomControls = true
                        displayZoomControls = false
                        userAgentString = "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
                        allowFileAccess = false
                        allowContentAccess = false
                    }
                    if (darkMode) {
                        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, true)
                        } else if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
                            @Suppress("DEPRECATION")
                            WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_ON)
                        }
                    }
                    webChromeClient = WebChromeClient()
                    webViewClient = object : WebViewClient() {
                        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                            onLoadingChanged(true)
                            // Reset saved scroll when navigating to a new page so we don't
                            // accidentally scroll a new roam to the previous page's position.
                            savedScrollY.intValue = 0
                        }
                        override fun onPageFinished(view: WebView, loadedUrl: String) {
                            onUrlChanged(loadedUrl)
                            loadError = false
                            onLoadingChanged(false)
                            showSnapshot = false
                            snapshotBitmap = null
                            val sy = savedScrollY.intValue
                            if (sy > 0) {
                                view.post { view.scrollTo(0, sy) }
                                savedScrollY.intValue = 0
                            }
                        }
                        override fun onReceivedError(
                            view: WebView,
                            request: WebResourceRequest,
                            error: WebResourceError,
                        ) {
                            if (request.isForMainFrame) {
                                loadError = true
                                onLoadingChanged(false)
                            }
                        }
                        // The renderer process was killed. On some devices (Samsung One UI 6),
                        // constructing a new WebView after renderer death throws
                        // AndroidRuntimeException. Show the error UI instead of trying to
                        // recreate the WebView — it recovers after a fresh roam.
                        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                            Handler(Looper.getMainLooper()).post {
                                webViewRef.value = null
                                showSnapshot = false
                                snapshotBitmap = null
                                loadError = true
                            }
                            return true
                        }
                        // Keep all URL navigation within the WebView, including links with
                        // target="_blank" or window.open(). This ensures history and discovered URLs
                        // always open inside Roam, never in an external browser.
                        override fun shouldOverrideUrlLoading(
                            view: WebView,
                            request: WebResourceRequest,
                        ): Boolean {
                            // Return false to let the WebView load all URLs normally.
                            // This prevents delegation to the system browser.
                            return false
                        }
                    }
                    // Restore saved session (back/forward stack + scroll) or load fresh
                    if (!savedState.isEmpty) {
                        restoreState(savedState)
                    } else {
                        loadUrl(url)
                    }
                    webViewRef.value = this
                }
            } catch (t: Throwable) {
                // If WebView creation fails (e.g. System WebView is missing or disabled),
                // show an error in the UI instead of crashing. Catch Throwable to include
                // fatal Errors like NoClassDefFoundError if the provider is missing.
                android.util.Log.e("RoamWebView", "Failed to create WebView", t)
                loadError = true
                onLoadingChanged(false) // Clear the loading overlay so the error box is visible
                // Return a dummy view so Compose doesn't crash on null return from factory
                android.view.View(context)
            }
        },
        update = { webView ->
            if (webView is WebView) {
                webViewRef.value = webView
                webView.saveState(savedState)
                if (webView.settings.javaScriptEnabled != jsEnabled) {
                    webView.settings.javaScriptEnabled = jsEnabled
                    webView.settings.domStorageEnabled = jsEnabled
                    webView.reload()
                } else if (webView.url != url || loadError) {
                    loadError = false
                    onLoadingChanged(true)
                    webView.loadUrl(url)
                }
            }
        },
    )
    if (showSnapshot) {
        snapshotBitmap?.let { bmp ->
            Image(
                bitmap = bmp.asImageBitmap(),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.FillBounds,
            )
        }
    }
    } // end Box
}

/**
 * Invisible 1×1dp WebView that loads [url] in the background, warming the shared WebView
 * disk cache so the main WebView displays it near-instantly when the user taps Roam.
 *
 * Uses [key] so a fresh instance is created whenever the URL changes. The composable is
 * only rendered when the user has enabled the "Preload next page" setting.
 */
@Composable
fun BackgroundPrefetchWebView(
    url: String,
    jsEnabled: Boolean = true,
    darkMode: Boolean = true,
) {
    key(url) {
        AndroidView(
            modifier = Modifier
                .size(1.dp)
                .alpha(0f),
            factory = { context ->
                try {
                    WebView(context).apply {
                        settings.apply {
                            @Suppress("SetJavaScriptEnabled")
                            javaScriptEnabled = jsEnabled
                            domStorageEnabled = jsEnabled
                            cacheMode = android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK
                            userAgentString = "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
                            allowFileAccess = false
                            allowContentAccess = false
                        }
                        if (darkMode) {
                            if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                                WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, true)
                            } else if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
                                @Suppress("DEPRECATION")
                                WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_ON)
                            }
                        }
                        loadUrl(url)
                    }
                } catch (t: Throwable) {
                    android.util.Log.e("RoamWebView", "Failed to create prefetch WebView", t)
                    android.view.View(context)
                }
            },
            update = { wv ->
                if (wv is WebView && wv.url != url) wv.loadUrl(url)
            },
        )
    }
}