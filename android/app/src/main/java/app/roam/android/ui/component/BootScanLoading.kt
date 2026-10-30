package app.roam.android.ui.component

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.R
import app.roam.android.ui.theme.Orbitron
import app.roam.android.util.SoundManager
import kotlinx.coroutines.delay
import kotlin.random.Random

private val STAGES = listOf("SCAN", "TRIANGULATE", "COMPILE")

/**
 * ROAM-OS boot/scan loading screen. Motion is continuous (a sweeping scan bar,
 * per-frame flicker and a fast-scrolling hex readout) so the screen never looks
 * static — even when it only flashes for an instant on a hot-queue hit. When
 * [finishing] flips true it plays a "MOUNT COMPLETE" beat.
 */
@Composable
fun BootScanLoading(
    message: String,
    finishing: Boolean,
    modifier: Modifier = Modifier,
    soundEnabled: Boolean = true,
) {
    val context = LocalContext.current
    var stage by remember { mutableIntStateOf(0) }
    var hexLines by remember { mutableStateOf(List(10) { randomHexLine() }) }

    // Progress bar: creeps toward ~90% and stalls, then snaps to 100% on finish.
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        progress.snapTo(0f)
        progress.animateTo(0.86f, tween(3200, easing = LinearEasing))
    }
    LaunchedEffect(finishing) {
        if (finishing) {
            progress.animateTo(1f, tween(280, easing = LinearEasing))
            if (soundEnabled) SoundManager.play(context, R.raw.mount_complete)
        }
    }

    // Slower hex scroll — still moving, but not frantic.
    LaunchedEffect(finishing) {
        if (finishing) return@LaunchedEffect
        while (true) {
            delay(220)
            hexLines = (hexLines.drop(1) + randomHexLine()).takeLast(10)
        }
    }
    // Stage cycling + scan blips.
    LaunchedEffect(finishing) {
        if (finishing) return@LaunchedEffect
        while (true) {
            delay(900)
            stage = (stage + 1) % STAGES.size
            if (soundEnabled) SoundManager.play(context, R.raw.scan_blip)
        }
    }
    // Sparse random ticks/blips — just enough to break up the scan rhythm
    // without becoming repetitive.
    LaunchedEffect(finishing) {
        if (finishing) return@LaunchedEffect
        while (true) {
            delay(Random.nextLong(3000, 8000))
            if (soundEnabled && Random.nextFloat() < 0.5f) SoundManager.play(context, if (Random.nextBoolean()) R.raw.relay_tick else R.raw.modem_blip)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                STAGES.forEachIndexed { i, name ->
                    Text(
                        text = name,
                        style = MaterialTheme.typography.labelMedium.copy(fontFamily = Orbitron, letterSpacing = 2.sp),
                        color = if (i == stage) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                    )
                }
            }
            Spacer(Modifier.height(16.dp))

            // Progress bar
            Box(
                Modifier
                    .width(220.dp)
                    .height(6.dp)
                    .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.18f)),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(progress.value)
                        .height(6.dp)
                        .background(MaterialTheme.colorScheme.secondary),
                )
            }
            Spacer(Modifier.height(14.dp))

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                hexLines.forEach { line ->
                    Text(
                        text = line,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.secondary.copy(alpha = 0.8f),
                        maxLines = 1,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))

            if (finishing) {
                Text(
                    "MOUNT COMPLETE",
                    style = MaterialTheme.typography.titleLarge.copy(fontFamily = Orbitron, letterSpacing = 2.sp),
                    color = MaterialTheme.colorScheme.secondary,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "LINK ESTABLISHED",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Text(
                    message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private fun randomHexLine(): String {
    val chars = "0123456789ABCDEF"
    return buildString {
        repeat(24) { append(chars[Random.nextInt(16)]) }
    }
}
