package app.roam.android.ui.component
import android.content.res.Configuration
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
    LaunchedEffect(url) { urlRef.value = url }
    // Scroll position saved on pause, restored after the page reloads
    val savedScrollY = rememberSaveable { mutableIntStateOf(0) }
    // Bumped to force AndroidView to recreate the WebView after renderer process death.
    var webViewKey by remember { mutableIntStateOf(0) }
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
                        if (!savedState.isEmpty) {
                            wv.restoreState(savedState)
                        } else {
                            urlRef.value?.let { wv.loadUrl(it) }
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

    // key(webViewKey) forces Compose to destroy and recreate AndroidView when the
    // WebView renderer is killed (onRenderProcessGone). The saved Bundle is preserved
    // across recreation so navigation history is restored.
    Box(modifier = modifier) {
    key(webViewKey) {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            // createConfigurationContext with UI_MODE_NIGHT_YES makes the WebView renderer
            // treat this as a dark-mode app, activating algorithmic darkening on all API levels.
            val webContext = if (darkMode) {
                val nightConfig = Configuration(context.resources.configuration)
                nightConfig.uiMode = (nightConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
                                      Configuration.UI_MODE_NIGHT_YES
                context.createConfigurationContext(nightConfig)
            } else context
            WebView(webContext).apply {
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
                webChromeClient = object : WebChromeClient() {
                    override fun onProgressChanged(view: WebView, newProgress: Int) {
                        // Hide loading overlay early once the page is 60% loaded
                        if (newProgress >= 60) {
                            onLoadingChanged(false)
                        }
                    }
                }
                webViewClient = object : WebViewClient() {
                    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                        onLoadingChanged(true)
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
                    // The renderer process was killed (screen lock + memory pressure is the
                    // common trigger). Return true to prevent a crash. Bump webViewKey so
                    // Compose tears down this AndroidView and rebuilds a fresh WebView;
                    // the factory block will restore state from savedState on the new instance.
                    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                        showSnapshot = true
                        Handler(Looper.getMainLooper()).post { webViewKey++ }
                        return true
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
        },
        update = { webView ->
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
        },
    )
    } // end key(webViewKey)
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
                val webContext = if (darkMode) {
                    val nightConfig = android.content.res.Configuration(context.resources.configuration)
                    nightConfig.uiMode = (nightConfig.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK.inv()) or
                                          android.content.res.Configuration.UI_MODE_NIGHT_YES
                    context.createConfigurationContext(nightConfig)
                } else context
                WebView(webContext).apply {
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
            },
            update = { wv ->
                if (wv.url != url) wv.loadUrl(url)
            },
        )
    }
}