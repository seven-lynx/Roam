package app.roam.android.ui.component

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp

/**
 * A shimmer placeholder that exactly mirrors [DiscoverCard]'s layout.
 * Shown while [RoamState.Loading] instead of a spinner.
 */
@Composable
fun DiscoverCardSkeleton(modifier: Modifier = Modifier) {
    Card(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        shape = RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Image area
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(260.dp),
            )

            Column(modifier = Modifier.padding(16.dp)) {
                // Domain chip placeholder
                ShimmerBox(
                    modifier = Modifier
                        .width(100.dp)
                        .height(28.dp)
                        .clip(RoundedCornerShape(50)),
                )
                Spacer(Modifier.height(12.dp))

                // Title line 1
                ShimmerBox(modifier = Modifier.fillMaxWidth().height(20.dp))
                Spacer(Modifier.height(6.dp))
                // Title line 2 (shorter)
                ShimmerBox(modifier = Modifier.fillMaxWidth(0.7f).height(20.dp))
                Spacer(Modifier.height(12.dp))

                // Description lines
                ShimmerBox(modifier = Modifier.fillMaxWidth().height(14.dp))
                Spacer(Modifier.height(4.dp))
                ShimmerBox(modifier = Modifier.fillMaxWidth().height(14.dp))
                Spacer(Modifier.height(4.dp))
                ShimmerBox(modifier = Modifier.fillMaxWidth(0.85f).height(14.dp))
            }
        }
    }
}

@Composable
fun ShimmerBox(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "shimmer_translate",
    )

    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant,
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        MaterialTheme.colorScheme.surfaceVariant,
    )

    Box(
        modifier = modifier.background(
            brush = Brush.linearGradient(
                colors = shimmerColors,
                start = Offset(translateAnim - 300f, translateAnim - 300f),
                end = Offset(translateAnim, translateAnim),
            ),
        ),
    )
}
