package app.roam.android.ui.component

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Shader
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.ui.theme.Abyss
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.EmberBright
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.IbmPlexMono
import app.roam.android.ui.theme.NeonPink
import app.roam.android.ui.theme.Oxide
import app.roam.android.ui.theme.Oxide2
import app.roam.android.ui.theme.Oxide3
import app.roam.android.ui.theme.ScreenDeep
import app.roam.android.ui.theme.TealBright
import kotlin.math.cos
import kotlin.math.sin
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
    wear: Boolean = false,
    bezelFisheye: Boolean = true,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    if (framed) {
        Box(
            modifier = modifier
                .background(Abyss)
                .then(if (bezelFisheye) Modifier.fisheyeDistortion(crtFx.fisheye) else Modifier)
        ) {
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
                        drawRect(brush = brushedMetalShader, alpha = 0.10f)
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
                        Box(
                            Modifier
                                .fillMaxSize()
                                .then(if (bezelFisheye) Modifier else Modifier.fisheyeDistortion(crtFx.fisheye))
                        ) { content() }
                        if (crtEnabled) CrtOverlay(Modifier.fillMaxSize(), fx = crtFx)
                    }
                }
                SpeakerGrille(Modifier.align(Alignment.TopCenter).padding(top = 3.dp))
                VentSlots(Modifier.align(Alignment.BottomCenter))
                PowerLed(Modifier.align(Alignment.TopEnd).padding(3.dp))
                Diodes(Modifier.align(Alignment.BottomEnd).padding(3.dp))
                PortLabels(Modifier.align(Alignment.BottomStart).padding(start = 4.dp, bottom = 3.dp))
                if (wear) WearLayer(Modifier.fillMaxSize().padding(8.dp))
            }
            Screw(Modifier.align(Alignment.TopStart).padding(2.dp))
            Screw(Modifier.align(Alignment.TopEnd).padding(2.dp))
            Screw(Modifier.align(Alignment.BottomStart).padding(2.dp))
            Screw(Modifier.align(Alignment.BottomEnd).padding(2.dp))
        }
    } else {
        Box(modifier = modifier) {
            Box(Modifier.fillMaxSize().fisheyeDistortion(crtFx.fisheye)) { content() }
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

@Composable
private fun SpeakerGrille(modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .height(9.dp)
            .drawBehind {
                val r = 1.2.dp.toPx()
                val gap = 5.dp.toPx()
                val count = 18
                val total = count * (r * 2) + (count - 1) * gap
                val startX = (size.width - total) / 2f
                val y = size.height / 2f
                for (i in 0 until count) {
                    drawCircle(
                        color = Color.Black.copy(alpha = 0.55f),
                        radius = r,
                        center = Offset(startX + i * (r * 2 + gap), y),
                    )
                }
            },
    )
}

@Composable
private fun Diodes(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "diodes")
    val a1 by transition.animateFloat(0.3f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "d1")
    val a2 by transition.animateFloat(0.3f, 1f, infiniteRepeatable(tween(1400), RepeatMode.Reverse), label = "d2")
    val a3 by transition.animateFloat(0.3f, 1f, infiniteRepeatable(tween(1100), RepeatMode.Reverse), label = "d3")
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(4.dp).clip(CircleShape).background(TealBright.copy(alpha = a1)))
        Box(Modifier.size(4.dp).clip(CircleShape).background(EmberBright.copy(alpha = a2)))
        Box(Modifier.size(4.dp).clip(CircleShape).background(NeonPink.copy(alpha = a3)))
    }
}

@Composable
private fun PortLabels(modifier: Modifier = Modifier) {
    Text(
        "RS-232 · AUX · 12V",
        style = TextStyle(
            fontFamily = IbmPlexMono,
            fontSize = 7.sp,
            letterSpacing = 1.sp,
            color = Fog.copy(alpha = 0.75f),
        ),
        modifier = modifier,
    )
}

@Composable
private fun WearLayer(modifier: Modifier = Modifier) {
    val rng = remember { Random(31) }
    Canvas(modifier) {
        // Oxidised patches near the corners.
        drawCircle(Bone.copy(alpha = 0.07f), radius = size.width * 0.16f, center = Offset(size.width * 0.06f, size.height * 0.07f))
        drawCircle(Bone.copy(alpha = 0.05f), radius = size.width * 0.12f, center = Offset(size.width * 0.93f, size.height * 0.92f))
        drawCircle(EmberBright.copy(alpha = 0.05f), radius = size.width * 0.10f, center = Offset(size.width * 0.90f, size.height * 0.07f))
        // Hairline scratches (seeded, stable across recompositions).
        repeat(7) {
            val x1 = rng.nextFloat() * size.width
            val y1 = rng.nextFloat() * size.height
            val len = size.width * (0.08f + rng.nextFloat() * 0.22f)
            val ang = rng.nextFloat() * 6.28318f
            val x2 = x1 + len * cos(ang)
            val y2 = y1 + len * sin(ang)
            drawLine(
                color = Color.White.copy(alpha = 0.05f + rng.nextFloat() * 0.07f),
                start = Offset(x1, y1),
                end = Offset(x2, y2),
                strokeWidth = 0.8.dp.toPx(),
            )
        }
    }
}

private val chassisNoiseShader by lazy {
    ShaderBrush(BitmapShader(createChassisNoiseBitmap(), Shader.TileMode.REPEAT, Shader.TileMode.REPEAT))
}

private val brushedMetalShader by lazy {
    ShaderBrush(BitmapShader(createBrushedMetalBitmap(), Shader.TileMode.REPEAT, Shader.TileMode.REPEAT))
}

private fun createBrushedMetalBitmap(): Bitmap {
    val size = 128
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val pixels = IntArray(size * size)
    val rng = Random(19)
    for (y in 0 until size) {
        val base = 100 + rng.nextInt(40)
        for (x in 0 until size) {
            val streak = (x + y * 3) % 24
            val v = if (streak < 2) 220 else base
            pixels[y * size + x] = (0xFF shl 24) or (v shl 16) or (v shl 8) or v
        }
    }
    bmp.setPixels(pixels, 0, size, 0, 0, size, size)
    return bmp
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