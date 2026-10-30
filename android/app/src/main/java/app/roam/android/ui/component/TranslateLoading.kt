package app.roam.android.ui.component

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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.R
import app.roam.android.ui.theme.Orbitron
import app.roam.android.util.SoundManager
import kotlinx.coroutines.delay

/**
 * ROAM-OS "translating" loading screen — distinct from the boot/scan sequence.
 * Shown while a Google Translate URL loads after an auto/manual translation.
 */
@Composable
fun TranslateLoading(language: String, soundEnabled: Boolean = true, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val transition = rememberInfiniteTransition(label = "translate")
    val sweep by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1100, easing = LinearEasing), RepeatMode.Restart),
        label = "translate-sweep",
    )
    LaunchedEffect(Unit) {
        while (true) {
            if (soundEnabled) SoundManager.play(context, R.raw.scan_blip)
            delay(420)
        }
    }

    Box(modifier.fillMaxSize().background(MaterialTheme.colorScheme.background), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "TRANSLATING",
                style = MaterialTheme.typography.titleLarge.copy(fontFamily = Orbitron, letterSpacing = 3.sp),
                color = MaterialTheme.colorScheme.secondary,
            )
            Spacer(Modifier.height(6.dp))
            Text(language.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(18.dp))
            Box(Modifier.fillMaxWidth(0.6f).height(3.dp).background(MaterialTheme.colorScheme.surfaceVariant)) {
                Box(Modifier.fillMaxWidth(sweep).height(3.dp).background(MaterialTheme.colorScheme.secondary))
            }
            Spacer(Modifier.height(12.dp))
            Text(
                "rerouting signal\u2026",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
            )
        }
    }
}