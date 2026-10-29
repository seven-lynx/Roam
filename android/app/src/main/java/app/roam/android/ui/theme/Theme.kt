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

enum class RoamThemeVariant { CLASSIC, ROAM_OS }

private fun Context.findActivity(): Activity? {
    var ctx: Context? = this
    while (ctx is ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}

private val ClassicDarkColors = darkColorScheme(
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

private val ClassicLightColors = lightColorScheme(
    background = White,
    surface = Zinc50,
    onBackground = Zinc900,
    onSurface = Zinc900,
    primary = Zinc900,
    onPrimary = White,
    outline = Zinc200,
)

private val RoamOsColors = darkColorScheme(
    primary = Gold,
    onPrimary = AccentInk,
    primaryContainer = Brass,
    onPrimaryContainer = Bone,
    secondary = TealBright,
    onSecondary = ScreenDeep,
    secondaryContainer = Verdigris,
    onSecondaryContainer = Bone,
    tertiary = NeonPink,
    onTertiary = Bone,
    tertiaryContainer = Oxide3,
    onTertiaryContainer = Bone,
    background = ScreenBg,
    onBackground = Bone,
    surface = Panel,
    onSurface = Bone,
    surfaceVariant = Panel2,
    onSurfaceVariant = Fog,
    surfaceContainer = Panel,
    surfaceContainerHigh = Panel3,
    surfaceContainerHighest = Oxide3,
    surfaceContainerLow = Panel2,
    surfaceContainerLowest = Abyss,
    inverseSurface = Bone,
    inverseOnSurface = Abyss,
    inversePrimary = Brass,
    outline = LineColor,
    outlineVariant = Oxide2,
    error = Danger,
    onError = Bone,
    errorContainer = Oxide3,
    onErrorContainer = Danger,
)

@Composable
fun RoamTheme(
    variant: RoamThemeVariant = RoamThemeVariant.CLASSIC,
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    // ROAM-OS is night-only; Classic honours the light/dark/system choice.
    val effectiveDark = variant == RoamThemeVariant.ROAM_OS || darkTheme

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
            controller.isAppearanceLightStatusBars = !effectiveDark
            controller.isAppearanceLightNavigationBars = !effectiveDark
        }
    }

    val colorScheme = when (variant) {
        RoamThemeVariant.ROAM_OS -> RoamOsColors
        RoamThemeVariant.CLASSIC -> if (effectiveDark) ClassicDarkColors else ClassicLightColors
    }
    val typography = if (variant == RoamThemeVariant.ROAM_OS) RoamOsTypography else RoamTypography

    MaterialTheme(
        colorScheme = colorScheme,
        typography = typography,
        content = content,
    )
}