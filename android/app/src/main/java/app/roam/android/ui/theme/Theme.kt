package app.roam.android.ui.theme

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

private fun Context.findActivity(): Activity? {
    var ctx: Context? = this
    while (ctx is ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}

private val DarkColors = darkColorScheme(
    background = Zinc900,
    surface = Zinc800,
    surfaceVariant = Zinc800,
    surfaceContainer = Zinc800,
    onBackground = White,
    onSurface = White,
    primary = White,
    onPrimary = Zinc900,
    outline = Zinc700,
)

private val LightColors = lightColorScheme(
    background = White,
    surface = Zinc50,
    onBackground = Zinc900,
    onSurface = Zinc900,
    primary = Zinc900,
    onPrimary = White,
    outline = Zinc200,
)

@Composable
fun RoamTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = view.context.findActivity()?.window ?: return@SideEffect

            val controller = WindowCompat.getInsetsController(window, view)
            // Always keep the status and navigation bars visible. WebView page loads
            // (theme-color, viewport-fit, fullscreen requests) can otherwise briefly
            // hide the status bar during the loading → page transition.
            controller.show(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
            controller.isAppearanceLightStatusBars = !darkTheme
            controller.isAppearanceLightNavigationBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = RoamTypography,
        content = content,
    )
}
