package app.roam.android.ui.theme

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * A ROAM-OS accent palette. The same set of presets drives both the OS display
 * colour (MaterialTheme primary/secondary/tertiary + terminal text) and the
 * hardware chrome (deck keys, LEDs, antenna/nixie glow), selected independently.
 */
data class RoamOsPalette(
    val key: String,
    val label: String,
    val primary: Color,
    val primaryBright: Color,
    val secondary: Color,
    val tertiary: Color,
    val led: Color,
    val ember: Color,
    val emberBright: Color,
)

// Default — matches the original ROAM-OS teal/gold/phosphor look.
val PHOSPHOR = RoamOsPalette(
    key = "phosphor",
    label = "Phosphor Teal",
    primary = Color(0xFFC9A24B),
    primaryBright = Color(0xFFE0B45F),
    secondary = Color(0xFF59B3AE),
    tertiary = Color(0xFFFF2E88),
    led = Color(0xFF39FF14),
    ember = Color(0xFFC97B3A),
    emberBright = Color(0xFFE08A4A),
)

val AMBER = RoamOsPalette(
    key = "amber",
    label = "Amber",
    primary = Color(0xFFD98E2B),
    primaryBright = Color(0xFFF0B04A),
    secondary = Color(0xFFE8A93F),
    tertiary = Color(0xFFFF6A3C),
    led = Color(0xFFFFB84D),
    ember = Color(0xFFB96A1E),
    emberBright = Color(0xFFE08A3C),
)

val MAGENTA = RoamOsPalette(
    key = "magenta",
    label = "Magenta",
    primary = Color(0xFFE05AAE),
    primaryBright = Color(0xFFFF7AC8),
    secondary = Color(0xFFFF5CD0),
    tertiary = Color(0xFFFF2E88),
    led = Color(0xFFFF6BB5),
    ember = Color(0xFFC24086),
    emberBright = Color(0xFFE05AAE),
)

val TERMINAL_GREEN = RoamOsPalette(
    key = "terminal_green",
    label = "Terminal Green",
    primary = Color(0xFF3FBF6F),
    primaryBright = Color(0xFF59E07E),
    secondary = Color(0xFF4CE08A),
    tertiary = Color(0xFF6BFF8A),
    led = Color(0xFF39FF14),
    ember = Color(0xFF2F9E5A),
    emberBright = Color(0xFF48C977),
)

val ARCTIC_CYAN = RoamOsPalette(
    key = "arctic_cyan",
    label = "Arctic Cyan",
    primary = Color(0xFF3FA7C9),
    primaryBright = Color(0xFF5CD0F0),
    secondary = Color(0xFF5CE0F0),
    tertiary = Color(0xFF4A9BFF),
    led = Color(0xFF5CE8FF),
    ember = Color(0xFF2E86A8),
    emberBright = Color(0xFF47B0D4),
)

val ROAM_OS_PALETTES = listOf(PHOSPHOR, AMBER, MAGENTA, TERMINAL_GREEN, ARCTIC_CYAN)

fun roamOsPalette(key: String?): RoamOsPalette =
    ROAM_OS_PALETTES.firstOrNull { it.key == key } ?: PHOSPHOR

/** Ambient palette for hardware chrome (deck keys, LEDs, antenna/nixie glow). */
val LocalHardwarePalette = staticCompositionLocalOf { PHOSPHOR }
