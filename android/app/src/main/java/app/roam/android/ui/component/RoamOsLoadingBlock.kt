package app.roam.android.ui.component

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.Panel2
import app.roam.android.ui.theme.TealBright

/**
 * Pulsing diagetic placeholder shown while a screen's data is still loading.
 * Used in place of dummy values (e.g. level 1 / 0 XP) until the real data lands.
 */
@Composable
fun RoamOsLoadingBlock(
    label: String = "SIGNAL //",
    modifier: Modifier = Modifier,
) {
    val transition = rememberInfiniteTransition(label = "roamos-loading")
    val alpha by transition.animateFloat(
        initialValue = 0.25f,
        targetValue = 0.8f,
        animationSpec = infiniteRepeatable(tween(650), RepeatMode.Reverse),
        label = "alpha",
    )
    Column(modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = TealBright.copy(alpha = alpha))
            Spacer(Modifier.width(6.dp))
            Text("\u2026", style = MaterialTheme.typography.labelSmall, color = Fog.copy(alpha = alpha))
        }
        Spacer(Modifier.height(10.dp))
        Box(Modifier.size(64.dp).clip(CircleShape).background(Panel2.copy(alpha = alpha)))
        Spacer(Modifier.height(12.dp))
        Box(Modifier.fillMaxWidth(0.6f).height(14.dp).clip(RoundedCornerShape(4.dp)).background(Panel2.copy(alpha = alpha)))
        Spacer(Modifier.height(8.dp))
        Box(Modifier.fillMaxWidth(0.4f).height(10.dp).clip(RoundedCornerShape(4.dp)).background(Panel2.copy(alpha = alpha)))
        Spacer(Modifier.height(12.dp))
        Box(Modifier.fillMaxWidth().height(14.dp).clip(RoundedCornerShape(4.dp)).background(Panel2.copy(alpha = alpha)))
    }
}
