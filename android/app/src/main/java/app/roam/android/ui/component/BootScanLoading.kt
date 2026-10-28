package app.roam.android.ui.component

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
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.random.Random

private val STAGES = listOf("SCAN", "TRIANGULATE", "COMPILE")

/**
 * ROAM-OS boot/scan loading screen: a looping scan → triangulate → compile
 * sequence with a scrolling hex readout and a rotating message. When [finishing]
 * flips true (loading complete), it shows a brief "MOUNT COMPLETE" beat instead
 * of the scan, so the sequence reads as a real process rather than being cut off.
 */
@Composable
fun BootScanLoading(
    message: String,
    finishing: Boolean,
    modifier: Modifier = Modifier,
) {
    var stage by remember { mutableIntStateOf(0) }
    var hexLines by remember { mutableStateOf(List(8) { randomHexLine() }) }

    LaunchedEffect(finishing) {
        if (!finishing) {
            while (true) {
                delay(900)
                stage = (stage + 1) % STAGES.size
                hexLines = (hexLines.drop(1) + randomHexLine()).takeLast(8)
            }
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
                        style = MaterialTheme.typography.labelMedium,
                        color = if (i == stage) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                    )
                }
            }
            Spacer(Modifier.height(16.dp))

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
            Spacer(Modifier.height(16.dp))

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
