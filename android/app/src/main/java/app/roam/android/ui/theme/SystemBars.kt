package app.roam.android.ui.theme

import android.os.Build
import android.view.Window

/**
 * Makes the system status/navigation bars transparent so full-bleed content
 * (the ROAM-OS control deck) shows through behind the nav bar.
 *
 * - The contrast-enforcement flags (API 29+, not deprecated) are all API 35+
 *   needs, since edge-to-edge is enforced there and the bars are transparent
 *   by default.
 * - The deprecated bar-color setters are only required (and honoured) below
 *   API 35, so they are gated and the deprecation warning is suppressed here.
 */
@Suppress("DEPRECATION")
internal fun applyTransparentSystemBars(window: Window) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        window.isNavigationBarContrastEnforced = false
        window.isStatusBarContrastEnforced = false
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        window.navigationBarColor = android.graphics.Color.TRANSPARENT
    }
}
