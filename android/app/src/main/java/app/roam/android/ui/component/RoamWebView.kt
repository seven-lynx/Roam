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
    onPageVisible: () -> Unit = {},
    onRecovering: (Boolean) -> Unit = {},
    onPageFinishedForPrefetch: () -> Unit = {},
    navCommandsFlow: Flow<WebNavCommand>? = null,
    clearCookiesFlow: Flow<Unit>? = null,
) {
    var loadError by remember { mutableStateOf(value = false) }
    // Non-persisted Bundle for live session recovery only (renderer death while app
    // is alive). Previously rememberSaveable restored stale URLs across process
    // death recreation, causing the WebView to navigate away from the ViewModel's
    // current URL on resume.
    val savedState = remember { Bundle() }
    // Hold a stable reference so lifecycle observer can reach it
    val webViewRef = remember { mutableStateOf<WebView?>(null) }
    // Keep a stable url reference for use inside the lifecycle observer
    val urlRef = remember { mutableStateOf(url) }
    // The last URL we commanded the WebView to load. Used to detect silent URL
    // drift after process death (when restoreState brings back a stale page).
    var lastCommittedUrl by remember { mutableStateOf<String?>(null) }
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
                    wv.onResume()
                    wv.resumeTimers()
                    // If the renderer was killed while backgrounded, the WebView url is null.
                    // Restore saved state first; fall back to reloading the current url.
                    if (wv.url.isNullOrEmpty()) {
                        showSnapshot = true
                        onRecovering(true)
                        if (!savedState.isEmpty) {
                            wv.restoreState(savedState)
                        } else {
                            urlRef.value?.let { wv.loadUrl(it) }
                        }
                    } else {
                        // WebView is alive — restore scroll position saved during ON_PAUSE.
                        // restoreState is the WebView's native mechanism for restoring nav
                        // history + scroll, and handles internal timing correctly.
                        if (!savedState.isEmpty) {
                            wv.restoreState(savedState)
                        }
                        // Fallback: manual scroll restoration via postDelayed. We capture
                        // savedScrollY as a local val BEFORE resetting so the lambda uses
                        // the correct value (not the zero it gets reset to on the next line).
                        // The 300ms delay gives the WebView time to finish its internal
                        // resume/layout cycle triggered by resumeTimers().
                        val sy = savedScrollY.intValue
                        savedScrollY.intValue = 0
                        if (sy > 0) {
                            wv.postDelayed({
                                wv.scrollTo(0, sy)
                            }, 300)
                        }
                    }
                }
                Lifecycle.Event.ON_PAUSE -> {
                    webViewRef.value?.let {
                        if ((it.width > 0) && (it.height > 0)) {
                            val bmp = createBitmap(it.width, it.height, Bitmap.Config.ARGB_8888)
                            it.draw(Canvas(bmp))
                            snapshotBitmap = bmp
                        }
                        savedScrollY.intValue = it.scrollY
                        it.saveState(savedState)
                        it.onPause()
                        it.pauseTimers()
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
                    webChromeClient = object : WebChromeClient() {
                        // When a page calls window.open() or a link has target="_blank",
                        // Android calls onCreateWindow. The default implementation returns
                        // false, which fires an ACTION_VIEW intent and opens the URL in
                        // the system browser. We override it to reuse the same WebView,
                        // keeping all navigation inside Roam.
                        override fun onCreateWindow(
                            view: WebView,
                            isDialog: Boolean,
                            isUserGesture: Boolean,
                            resultMsg: android.os.Message,
                        ): Boolean {
                            val transport = resultMsg.obj as? WebView.WebViewTransport
                            if (transport != null) {
                                transport.webView = view
                                resultMsg.sendToTarget()
                            }
                            return true
                        }
                    }
                    webViewClient = object : WebViewClient() {
                        // Track redirect count per page load to break infinite redirect loops.
                        // Some sites (Outside, Bloomberg, etc.) detect mismatched or old
                        // User-Agents and bounce between mobile/desktop subdomains or
                        // consent walls, creating chains of 20+ redirects that the WebView
                        // would otherwise faithfully follow until hitting its internal limit.
                        private var redirectCount = 0
                        private var lastRedirectHost: String? = null

                        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                            // Reset redirect tracking on each new top-level navigation
                            if (favicon != null || redirectCount == 0) {
                                redirectCount = 0
                                lastRedirectHost = null
                            }
                            onLoadingChanged(true)
                        }
                        override fun onPageFinished(view: WebView, loadedUrl: String) {
                            // Page loaded successfully — reset the counter
                            redirectCount = 0
                            lastRedirectHost = null
                            onUrlChanged(loadedUrl)
                            loadError = false
                            onLoadingChanged(false)
                            showSnapshot = false
                            snapshotBitmap = null
                            onPageVisible()
                            onRecovering(false)
                            onPageFinishedForPrefetch()
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
                                redirectCount = 0
                                lastRedirectHost = null
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
                        // Keep all URL navigation within the WebView. Block non-http
                        // schemes (intent://, market://, tel:, sms:, etc.) that would
                        // launch external apps. All http/https URLs load normally inside
                        // the WebView without ever delegating to the system browser.
                        override fun shouldOverrideUrlLoading(
                            view: WebView,
                            request: WebResourceRequest,
                        ): Boolean {
                            val scheme = request.url.scheme
                            if (scheme != null && scheme !in setOf("http", "https", "about", "data", "blob")) {
                                return true // Block external app schemes
                            }
                            // Break redirect loops: if the same host is targeted 10+ times
                            // in a row, abort the load so the WebView doesn't exhaust its
                            // internal redirect budget and show a cryptic error page.
                            val host = request.url.host
                            if (host != null && host == lastRedirectHost) {
                                redirectCount++
                                if (redirectCount >= 10) {
                                    android.util.Log.w("RoamWebView", "Redirect loop detected on $host — aborting")
                                    loadError = true
                                    onLoadingChanged(false)
                                    return true // Cancel the navigation
                                }
                            } else {
                                lastRedirectHost = host
                                redirectCount = 1
                            }
                            return false // Load normally in WebView
                        }

                        // Deprecated overload — some OEM WebView implementations (Samsung,
                        // Huawei) and server-side redirects still route through this path.
                        // Without this override, non-http schemes can fire ACTION_VIEW
                        // intents that open the system browser or other apps.
                        @Deprecated("Deprecated in Java", ReplaceWith("shouldOverrideUrlLoading(view, request)"))
                        @Suppress("DEPRECATION")
                        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                            val scheme = try { android.net.Uri.parse(url).scheme } catch (_: Exception) { null }
                            if (scheme != null && scheme !in setOf("http", "https", "about", "data", "blob")) {
                                return true
                            }
                            // Also check redirect loops on the deprecated path
                            val host = try { android.net.Uri.parse(url).host } catch (_: Exception) { null }
                            if (host != null && host == lastRedirectHost) {
                                redirectCount++
                                if (redirectCount >= 10) {
                                    android.util.Log.w("RoamWebView", "Redirect loop detected on $host (legacy path) — aborting")
                                    loadError = true
                                    onLoadingChanged(false)
                                    return true
                                }
                            } else {
                                lastRedirectHost = host
                                redirectCount = 1
                            }
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
                        // Block all navigation — this WebView only exists to warm the
                        // disk cache. Any window.open(), target="_blank", or navigation
                        // must be suppressed so it never opens the system browser.
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView,
                                request: WebResourceRequest,
                            ): Boolean = true // Block all navigation

                            @Deprecated("Deprecated in Java", ReplaceWith("shouldOverrideUrlLoading(view, request)"))
                            @Suppress("DEPRECATION")
                            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = true
                        }
                        webChromeClient = object : WebChromeClient() {
                            override fun onCreateWindow(
                                view: WebView,
                                isDialog: Boolean,
                                isUserGesture: Boolean,
                                resultMsg: android.os.Message,
                            ): Boolean = true // Suppress window.open()
                        }
                        settings.apply {
                            @Suppress("SetJavaScriptEnabled")
                            javaScriptEnabled = jsEnabled
                            domStorageEnabled = jsEnabled
                            cacheMode = android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK
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