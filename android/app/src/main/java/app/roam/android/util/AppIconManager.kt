package app.roam.android.util

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

/** Switches the launcher icon between Classic and ROAM-OS via activity aliases. */
object AppIconManager {
    fun apply(context: Context, roamOs: Boolean) {
        val pm = context.packageManager
        val pkg = context.packageName
        try {
            pm.setComponentEnabledSetting(
                ComponentName(pkg, "$pkg.MainActivityClassic"),
                if (roamOs) PackageManager.COMPONENT_ENABLED_STATE_DISABLED else PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP,
            )
            pm.setComponentEnabledSetting(
                ComponentName(pkg, "$pkg.MainActivityRoamOs"),
                if (roamOs) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP,
            )
        } catch (_: Exception) {
            // Cosmetic only — never crash over an icon.
        }
    }
}