package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import app.roam.android.ui.theme.Abyss
import app.roam.android.ui.theme.Oxide
import app.roam.android.ui.theme.Oxide2
import app.roam.android.ui.theme.Oxide3
import app.roam.android.ui.theme.ScreenDeep
import app.roam.android.ui.theme.TealBright

/**
 * The retrofuturistic handheld chassis. The screen is recessed inside a heavy,
 * gradient-shaded shell with a beveled edge, a specular highlight, and corner
 * screws so the frame reads as a solid physical device rather than an outline.
 * Content renders inside the screen slot (padding only — never covered).
 * In frameless mode only the CRT overlay is applied.
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
                    .padding(8.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(Brush.verticalGradient(listOf(Oxide3, Oxide2, Oxide, Abyss)))
                    .border(
                        1.dp,
                        Brush.verticalGradient(
                            listOf(
                                TealBright.copy(alpha = 0.35f),
                                Color.Transparent,
                                Color.Black.copy(alpha = 0.55f),
                            ),
                        ),
                        RoundedCornerShape(22.dp),
                    )
                    .drawBehind {
                        drawRect(
                            brush = Brush.linearGradient(
                                colors = listOf(
                                    Color.White.copy(alpha = 0.07f),
                                    Color.Transparent,
                                    Color.Transparent,
                                ),
                                start = Offset.Zero,
                                end = Offset(size.width * 0.45f, size.height * 0.35f),
                            ),
                        )
                    },
            ) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .padding(7.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(ScreenDeep)
                        .border(1.dp, Color.Black.copy(alpha = 0.8f), RoundedCornerShape(14.dp)),
                ) {
                    Box(Modifier.fillMaxSize()) {
                        content()
                        if (crtEnabled) CrtOverlay(Modifier.fillMaxSize())
                    }
                }
                Screw(Modifier.align(Alignment.TopStart).padding(10.dp))
                Screw(Modifier.align(Alignment.TopEnd).padding(10.dp))
                Screw(Modifier.align(Alignment.BottomStart).padding(10.dp))
                Screw(Modifier.align(Alignment.BottomEnd).padding(10.dp))
            }
        }
    } else {
        Box(modifier = modifier) {
            content()
            if (crtEnabled) CrtOverlay(Modifier.fillMaxSize())
        }
    }
}

@Composable
private fun Screw(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(7.dp)
            .clip(CircleShape)
            .background(Brush.radialGradient(listOf(Oxide3, Abyss)))
            .border(1.dp, Color.Black.copy(alpha = 0.7f), CircleShape),
    )
}
