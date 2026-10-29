package app.roam.android.ui.component

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Shader
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.unit.dp
import app.roam.android.ui.theme.Abyss
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Oxide
import app.roam.android.ui.theme.Oxide2
import app.roam.android.ui.theme.Oxide3
import app.roam.android.ui.theme.ScreenDeep
import app.roam.android.ui.theme.TealBright
import kotlin.random.Random

/**
 * The retrofuturistic handheld chassis. The screen is recessed inside a heavy,
 * gradient-shaded shell with a beveled edge, a specular highlight, and corner
 * screws so the frame reads as a solid physical device rather than an outline.
 * Content renders inside the screen slot (padding only - never covered).
 * In frameless mode only the CRT overlay is applied.
 */
@Composable
fun HandheldShell(
    framed: Boolean,
    crtEnabled: Boolean,
    crtFx: CrtFx = CrtFx(),
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
                        drawRect(brush = chassisNoiseShader, alpha = 0.05f)
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
                        if (crtEnabled) CrtOverlay(Modifier.fillMaxSize(), fx = crtFx)
                    }
                }
                VentSlots(Modifier.align(Alignment.BottomCenter))
                PowerLed(Modifier.align(Alignment.TopEnd).padding(3.dp))
            }
            Screw(Modifier.align(Alignment.TopStart).padding(2.dp))
            Screw(Modifier.align(Alignment.TopEnd).padding(2.dp))
            Screw(Modifier.align(Alignment.BottomStart).padding(2.dp))
            Screw(Modifier.align(Alignment.BottomEnd).padding(2.dp))
        }
    } else {
        Box(modifier = modifier) {
            content()
            if (crtEnabled) CrtOverlay(Modifier.fillMaxSize(), fx = crtFx)
        }
    }
}

@Composable
private fun Screw(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(14.dp)
            .clip(CircleShape)
            .background(Brush.radialGradient(listOf(Bone, Oxide, Oxide3), center = Offset(0.35f, 0.3f), radius = 22f))
            .border(1.dp, Color.Black.copy(alpha = 0.85f), CircleShape)
            .drawBehind {
                val c = size.width / 2f
                val lw = 2.dp.toPx()
                drawLine(Color.Black.copy(alpha = 0.7f), Offset(c, size.height * 0.14f), Offset(c, size.height * 0.86f), strokeWidth = lw)
                drawLine(Color.Black.copy(alpha = 0.7f), Offset(size.width * 0.14f, c), Offset(size.width * 0.86f, c), strokeWidth = lw)
            },
    )
}

@Composable
private fun PowerLed(modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(4.dp)
            .drawBehind {
                drawCircle(TealBright.copy(alpha = 0.18f), radius = size.width * 0.9f)
                drawCircle(TealBright.copy(alpha = 0.9f), radius = size.width * 0.4f)
            },
    )
}

@Composable
private fun VentSlots(modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .height(7.dp)
            .drawBehind {
                val slotW = 4.dp.toPx()
                val slotH = 3.dp.toPx()
                val gap = 6.dp.toPx()
                val count = 9
                val total = count * slotW + (count - 1) * gap
                val startX = (size.width - total) / 2f
                val y = (size.height - slotH) / 2f
                for (i in 0 until count) {
                    drawRoundRect(
                        color = Color.Black.copy(alpha = 0.5f),
                        topLeft = Offset(startX + i * (slotW + gap), y),
                        size = Size(slotW, slotH),
                        cornerRadius = CornerRadius(slotW / 2f, slotH / 2f),
                    )
                }
            },
    )
}

private val chassisNoiseShader by lazy {
    ShaderBrush(BitmapShader(createChassisNoiseBitmap(), Shader.TileMode.REPEAT, Shader.TileMode.REPEAT))
}

private fun createChassisNoiseBitmap(): Bitmap {
    val size = 128
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val pixels = IntArray(size * size)
    val rng = Random(13)
    for (i in pixels.indices) {
        val v = rng.nextInt(256)
        pixels[i] = (0xFF shl 24) or (v shl 16) or (v shl 8) or v
    }
    bmp.setPixels(pixels, 0, size, 0, 0, size, size)
    return bmp
}