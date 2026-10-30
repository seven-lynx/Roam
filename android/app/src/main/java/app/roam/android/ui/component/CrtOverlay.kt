package app.roam.android.ui.component

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import app.roam.android.ui.theme.TealBright
import kotlin.random.Random
/** Per-effect CRT strength. 1 = off, 10 = very pronounced (default halfway at 5). */
data class CrtFx(
    val scanlines: Int = 5,
    val grain: Int = 5,
    val vignette: Int = 5,
    val flicker: Int = 5,
    val fisheye: Int = 5,
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
    val shimmer by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(180), RepeatMode.Reverse),
        label = "crt-shimmer",
    )

    val sScan = (fx.scanlines - 1) / 9f
    val sGrain = (fx.grain - 1) / 9f
    val sVignette = (fx.vignette - 1) / 9f
    val sFlicker = (fx.flicker - 1) / 9f
    val sFisheye = (fx.fisheye - 1) / 9f
    val phosphor = MaterialTheme.colorScheme.secondary

    Canvas(modifier = modifier) {
        // Flicker: full-screen luminance wobble (strong, scales with the slider).
        val flickerAmp = 0.03f + 0.35f * sFlicker
        drawRect(color = phosphor.copy(alpha = flickerAmp * flicker))
        drawRect(color = Color.Black.copy(alpha = 0.05f + 0.20f * sFlicker * (1f - flicker)))
        drawRect(color = Color.White.copy(alpha = 0.015f * shimmer * (0.4f + sFlicker)))

        // Vignette - darkens the edges toward the corners.
        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f + 0.55f * sVignette)),
                center = Offset(size.width / 2f, size.height / 2f),
                radius = size.maxDimension * 0.55f,
            ),
        )

        // Fisheye / curved-glass: a bright centre bulge with dark curved edges.
        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(
                    Color.White.copy(alpha = 0.14f * sFisheye),
                    Color.Transparent,
                    Color.Black.copy(alpha = 0.25f + 0.65f * sFisheye),
                ),
                center = Offset(size.width / 2f, size.height / 2f),
                radius = size.maxDimension * 0.60f,
            ),
        )
        // Horizontal tube curvature — darken the left/right extremes.
        if (sFisheye > 0f) {
            drawRect(
                brush = Brush.horizontalGradient(
                    colors = listOf(
                        Color.Black.copy(alpha = 0.16f * sFisheye),
                        Color.Transparent,
                        Color.Transparent,
                        Color.Black.copy(alpha = 0.16f * sFisheye),
                    ),
                    startX = 0f,
                    endX = size.width,
                ),
            )
        }

        // Scanlines.
        val spacing = 3.dp.toPx()
        var y = 0f
        while (y < size.height) {
            drawLine(
                color = Color.Black.copy(alpha = 0.10f + 0.45f * sScan),
                start = Offset(0f, y),
                end = Offset(size.width, y),
                strokeWidth = 1.dp.toPx(),
            )
            y += spacing
        }

        // Grain - tiled low-opacity monochrome noise.
        drawRect(brush = grainBrush, alpha = 0.02f + 0.12f * sGrain)
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

/** AGSL barrel-distortion shader — curves the screen plane like a CRT tube. */
private const val FISHEYE_SHADER = """
    uniform shader content;
    uniform float amount;
    uniform float2 size;
    half4 main(float2 coord) {
        float2 uv = coord / size;
        float2 center = float2(0.5, 0.5);
        float2 d = uv - center;
        float r2 = dot(d, d);
        float2 warped = center + d * (1.0 + amount * r2);
        if (warped.x < 0.0 || warped.x > 1.0 || warped.y < 0.0 || warped.y > 1.0) {
            return half4(0.0, 0.0, 0.0, 1.0);
        }
        return content.eval(warped * size);
    }
"""

/**
 * Applies a real barrel distortion to the layer's content for the given fisheye
 * strength (1 = off). No-op below Android 13 (TIRAMISU), where the enhanced shading in
 * [CrtOverlay] carries the effect instead.
 */
fun Modifier.fisheyeDistortion(fisheye: Int): Modifier {
    if (fisheye <= 1 || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return this
    return applyFisheyeShader(fisheye)
}

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
private fun Modifier.applyFisheyeShader(fisheye: Int): Modifier {
    return graphicsLayer {
        val shader = RuntimeShader(FISHEYE_SHADER)
        shader.setFloatUniform("amount", (fisheye - 1) / 9f * 0.70f)
        shader.setFloatUniform("size", size.width, size.height)
        renderEffect = RenderEffect.createRuntimeShaderEffect(shader, "content").asComposeRenderEffect()
    }
}