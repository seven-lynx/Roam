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

/**
 * CRT effects drawn over the screen: a faint pulsing phosphor glow, vignette,
 * scanlines and tiled film grain. Rendered with a Canvas so it is
 * pointer-transparent and never intercepts WebView/gesture input.
 */
@Composable
fun CrtOverlay(modifier: Modifier = Modifier) {
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

    Canvas(modifier = modifier) {
        // Faint phosphor glow, gently pulsing.
        drawRect(color = TealBright.copy(alpha = 0.02f + 0.02f * flicker))

        // Vignette — darkens the edges toward the corners.
        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.32f)),
                center = Offset(size.width / 2f, size.height / 2f),
                radius = size.maxDimension * 0.78f,
            ),
        )

        // Scanlines.
        val spacing = 3.dp.toPx()
        var y = 0f
        while (y < size.height) {
            drawLine(
                color = Color.Black.copy(alpha = 0.15f),
                start = Offset(0f, y),
                end = Offset(size.width, y),
                strokeWidth = 1.dp.toPx(),
            )
            y += spacing
        }

        // Grain — tiled low-opacity monochrome noise.
        drawRect(brush = grainBrush, alpha = 0.035f)
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
