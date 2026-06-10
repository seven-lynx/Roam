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

// Schemes the WebView is allowed to load. Everything else (intent://, market://,
// tel:, etc.) is blocked to prevent escaping into external apps.
private val ALLOWED_SCHEMES = setOf("http", "https", "about", "data", "blob")

// Self-contained JavaScript that saves and restores scroll position per-URL using
// localStorage. Runs entirely in the WebView's JS context with no Android lifecycle
// dependencies — eliminates the async race conditions of the old evaluateJavascript +
// rememberSaveable approach.
//
// Mechanism:
//  1. On page load, check localStorage for a saved scroll anchor for this URL. If
//     found, poll requestAnimationFrame until the document height reaches the saved
//     value, then scrollTo(0, savedY). This prevents the script from scrolling to a
//     position the page hasn't reached yet (dynamic content, lazy images, etc.).
//  2. On every scroll event, save { y, height, url } to localStorage immediately
//     (skipped only when y hasn't changed — eliminates the 200ms debounce race
//     condition where the user could background the app before the debounce fired,
//     causing the 1st scroll position to be restored instead of the 2nd).
//  3. On beforeunload, immediately save the final scroll position.
//
// localStorage is disk-backed and survives WebView renderer process death — unlike
// sessionStorage which is wiped when Android kills the renderer in the background.
// It is scoped to origin — no cross-site leaks.
private const val ROAM_SCROLL_MEMORY_SCRIPT = """
(function(){
  'use strict';
  var STORAGE_KEY = '__roam_scroll__';
  var MAX_POLL_ATTEMPTS = 60; // 60 * ~100ms = 6s max wait
  var _lastSavedY = -1; // guard: skip redundant writes when y hasn't changed

  function getScrollData() {
    return { y: window.scrollY || window.pageYOffset || 0,
             height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 0) };
  }

  function saveScroll() {
    try {
      var data = getScrollData();
      // Skip write if scroll position hasn't changed since last save
      if (data.y === _lastSavedY) return;
      _lastSavedY = data.y;
      data.url = location.href;
      var store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      store[data.url] = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch(e) { /* localStorage may be unavailable in some contexts */ }
  }

  function loadAndRestore() {
    try {
      var store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      var entry = store[location.href];
      if (!entry || !entry.y) return;
      var targetY = entry.y;
      var targetHeight = entry.height;
      var pollCount = 0;

      function tryScroll() {
        var currentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 0);
        // Page has grown to at least the saved height, or we've polled long enough
        if (currentHeight >= targetHeight || pollCount >= MAX_POLL_ATTEMPTS) {
          window.scrollTo(0, Math.min(targetY, currentHeight));
        } else {
          pollCount++;
          requestAnimationFrame(tryScroll);
        }
      }

      // Delay first attempt by one frame so initial layout completes
      requestAnimationFrame(tryScroll);
    } catch(e) { /* no-op */ }
  }

  // Expose save/restore globally so Android can call them via evaluateJavascript
  // when the app is backgrounded/foregrounded and no native load event fires.
  window.__roam_saveScroll = saveScroll;
  window.__roam_restoreScroll = loadAndRestore;

  // Save immediately on every scroll (no debounce) so the latest position is
  // always persisted before Android can suspend the JS thread on backgrounding.
  // The _lastSavedY guard prevents redundant localStorage writes on events
  // where scrollY hasn't changed (e.g. scrollend/overscroll rubber-banding).
  window.addEventListener('scroll', saveScroll, { passive: true });

  // Final save before navigating away
  window.addEventListener('beforeunload', saveScroll);

  // Also save on pagehide — some browsers fire this instead of beforeunload
  // when the page enters the back-forward cache, and it fires synchronously
  // on app backgrounding in WebView contexts that support it.
  window.addEventListener('pagehide', saveScroll);

  // Restore on load
  if (document.readyState === 'complete') {
    loadAndRestore();
  } else {
    window.addEventListener('load', loadAndRestore, { once: true });
  }

  // Belt-and-suspenders: if the page is restored from the back-forward cache
  // (e.g. after app backgrounding on some OEM WebViews), pageshow fires but
  // load does not. The persisted property indicates a bfcache restore.
  window.addEventListener('pageshow', function(e) {
    if (e.persisted) loadAndRestore();
  });
})();
"""

@Composable
fun RoamWebView(
    url: String?,
    modifier: Modifier = Modifier,
    darkMode: Boolean = true,
    jsEnabled: Boolean = true,
    onUrlChanged: (String) -> Unit = {},
    onLoadError: () -> Unit = {},
    onLoadingChanged: (Boolean) -> Unit = {},
    onPageVisible: () -> Unit = {},  // Fires at first paint (onPageCommitVisible)
    onPageFinishedForPrefetch: () -> Unit = {},  // Fires on go page finish so cache-warmer can start
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
    // Track the URL we've told the WebView to load so the update block doesn't
    // re-issue loadUrl() on every recomposition while the WebView is still loading
    // the old page (webView.url lags behind during navigation, causing an infinite
    // load loop).
    var commandedUrl by remember { mutableStateOf(url) }
    LaunchedEffect(url) {
        urlRef.value = url
        // Reset the error state whenever we get a new URL to try.
        // This ensures that "Try next page" can actually escape the error screen.
        loadError = false
    }
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
                    }
                    // Force-restore scroll position for the surviving-renderer case.
                    // The JS script only restores on load/pageshow — neither of which
                    // fire when the renderer survives backgrounding. Calling the exposed
                    // global __roam_restoreScroll forces an immediate restore from
                    // localStorage, regardless of whether a native load event occurred.
                    //
                    // Issue a delayed second restore ~150ms later to catch cases where
                    // the WebView hasn't finished its internal resume layout dance
                    // (window inset animations, renderer thaw, etc.) when the first
                    // attempt fires. The restore is idempotent — if the first call
                    // already succeeded, the second is a no-op.
                    if (jsEnabled) {
                        wv.evaluateJavascript("window.__roam_restoreScroll && window.__roam_restoreScroll()", null)
                        Handler(Looper.getMainLooper()).postDelayed({
                            wv.evaluateJavascript("window.__roam_restoreScroll && window.__roam_restoreScroll()", null)
                        }, 150L)
                    }
                }
                Lifecycle.Event.ON_PAUSE -> {
                    webViewRef.value?.let { wv ->
                        // Belt-and-suspenders: force-save the current scroll position.
                        // The injected script saves on every scroll event immediately,
                        // but if the user backgrounds mid-scroll the last scroll event
                        // may have already fired. This call guarantees the absolute final
                        // position is persisted before Android suspends the WebView.
                        if (jsEnabled) {
                            wv.evaluateJavascript("window.__roam_saveScroll && window.__roam_saveScroll()", null)
                        }
                        if ((wv.width > 0) && (wv.height > 0)) {
                            val bmp = createBitmap(wv.width, wv.height, Bitmap.Config.ARGB_8888)
                            wv.draw(Canvas(bmp))
                            snapshotBitmap = bmp
                        }
                        // Native saveState covers the back/forward stack when JS is disabled.
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
                        @Suppress("DEPRECATION")
                        setOffscreenPreRaster(true)
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
                        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                            onLoadingChanged(true)
                        }
                        // Fires when the first frame is rendered — the page is visually
                        // present even if JS/CSS hasn't finished. This lets the loading
                        // overlay disappear ~0.5-2s earlier than waiting for onPageFinished.
                        override fun onPageCommitVisible(view: WebView, url: String) {
                            if (url == commandedUrl || commandedUrl == null) {
                                onPageVisible()
                            }
                        }
                        override fun onPageFinished(view: WebView, loadedUrl: String) {
                            commandedUrl = loadedUrl
                            onUrlChanged(loadedUrl)
                            loadError = false
                            onLoadingChanged(false)
                            showSnapshot = false
                            snapshotBitmap = null
                            // Inject a self-contained scroll-memory script that saves/restores
                            // scroll position from localStorage. This runs entirely in the
                            // JS context with zero Android lifecycle race conditions.
                            // When jsEnabled is false, the script is not injected and
                            // restoreState/saveState (native Android WebView session) handles
                            // scroll via the lifecycle observers instead.
                            if (jsEnabled) {
                                view.evaluateJavascript(ROAM_SCROLL_MEMORY_SCRIPT, null)
                            }
                            // Tell the ViewModel the page finished so it can start warming
                            // the cache for the next URL while the user reads.
                            onPageFinishedForPrefetch()
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
                        val scheme = request.url.scheme
                        // Block Android intent:// and other non-http schemes that would
                        // launch external apps (e.g. market://, tel:, mailto: via intent).
                        if (scheme != null && scheme !in ALLOWED_SCHEMES) {
                            return true
                        }
                        // Return false to let the WebView load all http/https URLs normally.
                        // This prevents delegation to the system browser.
                        return false
                    }

                    // Deprecated overload — some OEM WebView implementations (Samsung,
                    // Huawei) and server-side redirects still route through this path.
                    // Without this override, non-http schemes can fire ACTION_VIEW intents
                    // that open the system browser or other apps.
                    @Suppress("DEPRECATION")
                    override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                        val scheme = try { android.net.Uri.parse(url).scheme } catch (_: Exception) { null }
                        if (scheme != null && scheme !in ALLOWED_SCHEMES) {
                            return true
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
                if (webView.settings.javaScriptEnabled != jsEnabled) {
                    webView.settings.javaScriptEnabled = jsEnabled
                    webView.settings.domStorageEnabled = jsEnabled
                    webView.reload()
                } else if (commandedUrl != url || loadError) {
                    commandedUrl = url
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
                        // Prevent the prefetch WebView from navigating to other URLs or
                        // opening the system browser. This WebView only exists to warm the
                        // disk cache for a single URL.
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView,
                                request: WebResourceRequest,
                            ): Boolean {
                                // Block all navigation — this is a cache warmer, not a browser.
                                return true
                            }

                            // Deprecated overload — OEM WebView implementations may route
                            // server-side redirects through this path.
                            @Suppress("DEPRECATION")
                            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                                return true
                            }
                        }
                        webChromeClient = object : WebChromeClient() {
                            override fun onCreateWindow(
                                view: WebView,
                                isDialog: Boolean,
                                isUserGesture: Boolean,
                                resultMsg: android.os.Message,
                            ): Boolean {
                                // Suppress window.open() — don't let the prefetch WebView
                                // fire intents or open the system browser.
                                return true
                            }
                        }
                        settings.apply {
                            @Suppress("SetJavaScriptEnabled")
                            javaScriptEnabled = jsEnabled
                            domStorageEnabled = jsEnabled
                            cacheMode = android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK
                            userAgentString = "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
                            allowFileAccess = false
                        allowContentAccess = false
                        // Tell the Chromium renderer to raster tiles even while the
                        // WebView is offscreen, so the page is fully painted when it
                        // becomes visible. Small GPU cost for a meaningful visual win.
                        @Suppress("DEPRECATION")
                        setOffscreenPreRaster(true)
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