package app.roam.android.ui.component

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.roam.android.R
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

    val transition = rememberInfiniteTransition(label = "boot-scan")
    val sweep by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1300, easing = LinearEasing), RepeatMode.Restart),
        label = "boot-sweep",
    )
    val sweepColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f)

    // Mount sound on finish.
    LaunchedEffect(finishing) {
        if (finishing && soundEnabled) SoundManager.play(context, R.raw.mount_complete)
    }
    // Fast hex scroll — always moving while scanning.
    LaunchedEffect(finishing) {
        if (finishing) return@LaunchedEffect
        while (true) {
            delay(140)
            hexLines = (hexLines.drop(1) + randomHexLine()).takeLast(10)
        }
    }
    // Stage cycling + scan blips.
    LaunchedEffect(finishing) {
        if (finishing) return@LaunchedEffect
        while (true) {
            delay(650)
            stage = (stage + 1) % STAGES.size
            if (soundEnabled) SoundManager.play(context, R.raw.scan_blip)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val y = sweep * size.height
            drawLine(
                color = sweepColor,
                start = Offset(0f, y),
                end = Offset(size.width, y),
                strokeWidth = 2.dp.toPx(),
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                STAGES.forEachIndexed { i, name ->
                    Text(
                        text = name,
                        style = MaterialTheme.typography.labelMedium,
                        color = if (i == stage) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                    )
                }
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
                    style = MaterialTheme.typography.titleLarge,
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
