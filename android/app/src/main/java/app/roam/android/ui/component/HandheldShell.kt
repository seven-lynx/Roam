package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.roam.android.ui.theme.Abyss
import app.roam.android.ui.theme.Oxide3
import app.roam.android.ui.theme.ScreenDeep

/**
 * The retrofuturistic handheld: a weathered plastic chassis around a dark bezel
 * around the screen. Content renders inside the screen slot, so the frame adds
 * padding rather than covering content. In frameless mode only the CRT overlay
 * is applied (no chassis/bezel).
 */
@Composable
fun HandheldShell(
    framed: Boolean,
    crtEnabled: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    if (framed) {
        Box(modifier = modifier.background(Abyss)) {
            Box(
                Modifier
                    .fillMaxSize()
                    .padding(10.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Oxide3),
            ) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .padding(6.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(ScreenDeep),
                ) {
                    Box(Modifier.fillMaxSize()) {
                        content()
                        if (crtEnabled) CrtOverlay(Modifier.fillMaxSize())
                    }
                }
            }
        }
    } else {
        Box(modifier = modifier) {
            content()
            if (crtEnabled) CrtOverlay(Modifier.fillMaxSize())
        }
    }
}
