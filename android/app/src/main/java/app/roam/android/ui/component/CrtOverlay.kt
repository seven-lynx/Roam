package app.roam.android.ui.component

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Shader
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.unit.dp
import app.roam.android.ui.theme.TealBright
import kotlin.random.Random

/** Per-effect CRT strength. 1 = subtle (current look), 10 = very pronounced. */
data class CrtFx(
    val scanlines: Int = 1,
    val grain: Int = 1,
    val vignette: Int = 1,
    val flicker: Int = 1,
    val fisheye: Int = 1,
)

/**
 * CRT effects drawn over the screen: a pulsing phosphor glow, vignette, fisheye
 * (curved-glass) shading, scanlines and tiled film grain. Rendered with a Canvas
 * so it is pointer-transparent and never intercepts WebView/gesture input.
 */
@Composable
fun CrtOverlay(modifier: Modifier = Modifier, fx: CrtFx = CrtFx()) {
    val grainBrush = remember {
        ShaderBrush(BitmapShader(createNoiseBitmap(), Shader.TileMode.REPEAT, Shader.TileMode.REPEAT))
    }
    val transition = rememberInfiniteTransition(label = "crt-flicker")
    val flicker by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(6000, easing = LinearEasing), RepeatMode.Reverse),
        label = "crt-flicker-alpha",
    )

    val sScan = (fx.scanlines - 1) / 9f
    val sGrain = (fx.grain - 1) / 9f
    val sVignette = (fx.vignette - 1) / 9f
    val sFlicker = (fx.flicker - 1) / 9f
    val sFisheye = (fx.fisheye - 1) / 9f

    Canvas(modifier = modifier) {
        // Phosphor glow, gently pulsing (amplitude scales with flicker strength).
        drawRect(color = TealBright.copy(alpha = 0.02f + (0.02f + 0.06f * sFlicker) * flicker))

        // Vignette - darkens the edges toward the corners.
        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.28f + 0.32f * sVignette)),
                center = Offset(size.width / 2f, size.height / 2f),
                radius = size.maxDimension * 0.78f,
            ),
        )

        // Fisheye / curved-glass: a soft center bulge with darker corners.
        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(
                    Color.White.copy(alpha = 0.03f * sFisheye),
                    Color.Transparent,
                    Color.Black.copy(alpha = 0.08f + 0.42f * sFisheye),
                ),
                center = Offset(size.width / 2f, size.height / 2f),
                radius = size.maxDimension * 0.58f,
            ),
        )

        // Scanlines.
        val spacing = 3.dp.toPx()
        var y = 0f
        while (y < size.height) {
            drawLine(
                color = Color.Black.copy(alpha = 0.12f + 0.28f * sScan),
                start = Offset(0f, y),
                end = Offset(size.width, y),
                strokeWidth = 1.dp.toPx(),
            )
            y += spacing
        }

        // Grain - tiled low-opacity monochrome noise.
        drawRect(brush = grainBrush, alpha = 0.03f + 0.06f * sGrain)
    }
}

private fun createNoiseBitmap(): Bitmap {
    val size = 128
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val pixels = IntArray(size * size)
    val rng = Random(42)
    for (i in pixels.indices) {
        val v = rng.nextInt(256)
        pixels[i] = (0xFF shl 24) or (v shl 16) or (v shl 8) or v
    }
    bmp.setPixels(pixels, 0, size, 0, 0, size, size)
    return bmp
}