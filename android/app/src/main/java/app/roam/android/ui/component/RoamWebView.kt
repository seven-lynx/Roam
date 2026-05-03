package app.roam.android.ui.component
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.ContextThemeWrapper
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
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
@Composable
fun RoamWebView(
    url: String?,
    modifier: Modifier = Modifier,
    darkMode: Boolean = true,
    onUrlChanged: (String) -> Unit = {},
    onLoadError: () -> Unit = {},
    onLoadingChanged: (Boolean) -> Unit = {},
) {
    var loadError by remember { mutableStateOf(false) }
    // Persists WebView back/forward history + current URL across process death
    val savedState = rememberSaveable { Bundle() }
    // Hold a stable reference so lifecycle observer can reach it
    val webViewRef = remember { mutableStateOf<WebView?>(null) }
    // Pause / resume the WebView with the activity lifecycle to prevent blank screen
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> {
                    webViewRef.value?.onResume()
                    webViewRef.value?.resumeTimers()
                }
                Lifecycle.Event.ON_PAUSE -> {
                    webViewRef.value?.let {
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
    if (url == null) {
        Box(modifier = modifier.fillMaxSize())
        return
    }
    if (loadError) {
        Box(
            modifier = modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            androidx.compose.foundation.layout.Column(
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
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
            // Wrap context in night mode so the WebView renderer treats the app as dark,
            // which is required for isAlgorithmicDarkeningAllowed to activate on API 33+.
            val webContext = if (darkMode) {
                ContextThemeWrapper(context, 0).also { wrapper ->
                    val nightConfig = Configuration(context.resources.configuration)
                    nightConfig.uiMode = (nightConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
                                         Configuration.UI_MODE_NIGHT_YES
                    wrapper.applyOverrideConfiguration(nightConfig)
                }
            } else context
            WebView(webContext).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    setSupportZoom(true)
                    builtInZoomControls = true
                    displayZoomControls = false
                    userAgentString = "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
                    allowFileAccess = false
                    allowContentAccess = false
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        @Suppress("DEPRECATION")
                        forceDark = if (darkMode) android.webkit.WebSettings.FORCE_DARK_ON
                                    else android.webkit.WebSettings.FORCE_DARK_OFF
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        isAlgorithmicDarkeningAllowed = darkMode
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
            // Save state on every update so onPause always has the latest
            webView.saveState(savedState)
            // Reload only when the ViewModel has moved to a genuinely new URL
            if (webView.url != url) {
                loadError = false
                webView.loadUrl(url)
            }
        },
    )
}