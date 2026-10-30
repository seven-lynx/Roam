package app.roam.android.ui.component

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.MaterialTheme
import app.roam.android.ui.theme.Abyss
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.IbmPlexMono
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Orbitron
import androidx.compose.ui.platform.LocalContext
import app.roam.android.R
import app.roam.android.util.SoundManager
import kotlin.random.Random
import kotlinx.coroutines.delay

/**
 * Cyberdeck boot/standby animation shown while the app starts up or waits for
 * the WebView to come back after a background pause. Deliberately distinct from
 * the URL-loading scan sequence (BootScanLoading).
 */
@Composable
fun RoamOsBootScreen(soundEnabled: Boolean = true) {
    val context = LocalContext.current
    LaunchedEffect(Unit) {
        if (soundEnabled) SoundManager.play(context, R.raw.load_start)
        while (true) {
            delay(Random.nextLong(3000, 8000))
            if (soundEnabled && Random.nextFloat() < 0.5f) SoundManager.play(context, if (Random.nextBoolean()) R.raw.relay_tick else R.raw.modem_blip)
        }
    }
    val lines = listOf(
        "> establishing uplink …",
        "> [ OK ] started roam-daemon",
        "> mounting /home …",
        "> loading kernel modules …",
        "> phosphor array: ok",
        "> signal lock: acquired",
        "> tty1: login as wanderer",
    )
    var lineIndex by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        while (lineIndex < lines.size) {
            delay(300)
            lineIndex = lineIndex + 1
        }
    }
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        progress.snapTo(0f)
        progress.animateTo(1f, tween(2400, easing = LinearEasing))
    }
    val transition = rememberInfiniteTransition(label = "roamos-boot")
    val glow by transition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "boot-glow",
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .background(Abyss)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "ROAM-OS",
            color = MaterialTheme.colorScheme.secondary.copy(alpha = glow),
            fontFamily = Orbitron,
            fontSize = 30.sp,
            letterSpacing = 4.sp,
        )
        Spacer(Modifier.height(18.dp))
        Box(Modifier.width(170.dp).height(3.dp).background(LineColor)) {
            Box(
                Modifier
                    .fillMaxWidth(progress.value)
                    .height(3.dp)
                    .background(MaterialTheme.colorScheme.secondary)
            )
        }
        Spacer(Modifier.height(22.dp))
        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.width(230.dp)) {
            lines.forEachIndexed { i, line ->
                Text(
                    line,
                    color = if (i <= lineIndex) Fog else Fog.copy(alpha = 0.3f),
                    fontFamily = IbmPlexMono,
                    fontSize = 12.sp,
                    lineHeight = 20.sp,
                )
            }
            Text("\u258C", color = MaterialTheme.colorScheme.secondary, fontFamily = IbmPlexMono, fontSize = 12.sp)
        }
    }
}