package app.roam.android.ui.component
import android.content.res.Configuration
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
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
    var loadError by remember { mutableStateOf(false) }
    // Persists WebView back/forward history + current URL across process death
    val savedState = rememberSaveable { Bundle() }
    // Hold a stable reference so lifecycle observer can reach it
    val webViewRef = remember { mutableStateOf<WebView?>(null) }
    // Keep a stable url reference for use inside the lifecycle observer
    val urlRef = remember { mutableStateOf(url) }
    LaunchedEffect(url) { urlRef.value = url }
    // Scroll position saved on pause, restored after the page reloads
    val savedScrollY = rememberSaveable { mutableIntStateOf(0) }

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
                        if (!savedState.isEmpty) {
                            wv.restoreState(savedState)
                        } else {
                            urlRef.value?.let { wv.loadUrl(it) }
                        }
                    }
                }
                Lifecycle.Event.ON_PAUSE -> {
                    webViewRef.value?.let {
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

    AndroidView(
        modifier = modifier.fillMaxSize(),
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
                    javaScriptEnabled = jsEnabled
                    domStorageEnabled = jsEnabled
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
                webViewClient = object : WebViewClient() {
                    override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                        onLoadingChanged(true)
                    }
                    override fun onPageFinished(view: WebView, loadedUrl: String) {
                        onUrlChanged(loadedUrl)
                        loadError = false
                        onLoadingChanged(false)
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
                    // common trigger). Return true to prevent a crash; reload immediately.
                    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                        Handler(Looper.getMainLooper()).post {
                            if (!savedState.isEmpty) {
                                view.restoreState(savedState)
                            } else {
                                urlRef.value?.let { view.loadUrl(it) }
                            }
                        }
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
            } else if (webView.url != url) {
                loadError = false
                webView.loadUrl(url)
            }
        },
    )
}