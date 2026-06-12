package app.roam.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

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
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = RoamTypography,
        content = content,
    )
}
