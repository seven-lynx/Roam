package app.roam.android.ui.component

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/**
 * ROAM-OS screen readout — a single row showing live status: "ROAMING…" while
 * loading, then CATEGORY · DOMAIN · SUBCATEGORY when loaded. Error, exhausted
 * and offline states take priority. Tappable to retry on error.
 */
@Composable
fun OsStatusBar(
    category: String?,
    subcategory: String?,
    domain: String?,
    modifier: Modifier = Modifier,
    errorText: String? = null,
    exhausted: Boolean = false,
    offline: Boolean = false,
    loading: Boolean = false,
    screenLabel: String? = null,
    onRetry: () -> Unit = {},
) {
    val text = when {
        errorText != null -> "$errorText"
        screenLabel != null -> screenLabel
        exhausted -> "SIGNAL EXHAUSTED — ADJUST CATEGORIES"
        offline -> "OFFLINE"
        loading -> "ROAMING…"
        else -> {
            val parts = listOfNotNull(category, domain, subcategory)
            if (parts.isEmpty()) "AWAITING SIGNAL" else parts.joinToString(" · ")
        }
    }

    val textMeasurer = rememberTextMeasurer()
    val style = MaterialTheme.typography.labelMedium
    val textColor = when {
        errorText != null -> MaterialTheme.colorScheme.error
        screenLabel != null -> MaterialTheme.colorScheme.secondary
        loading -> MaterialTheme.colorScheme.secondary
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    val density = LocalDensity.current

    // Measure full text width to decide whether scrolling is needed.
    val measuredWidth = remember(text, style) {
        textMeasurer.measure(AnnotatedString(text), style).size.width
    }
    var containerWidth by remember { mutableIntStateOf(0) }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(enabled = errorText != null) { onRetry() }
            .padding(horizontal = 12.dp, vertical = 7.dp)
            .onSizeChanged { containerWidth = it.width },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val needsScroll = containerWidth > 0 && measuredWidth > containerWidth - with(density) { 24.dp.roundToPx() }
        if (needsScroll) {
            val scrollRange = (measuredWidth - containerWidth + with(density) { 60.dp.roundToPx() }).toFloat().coerceAtLeast(1f)
            val scrollDurationMs = (scrollRange / 55f * 1000f).toInt().coerceIn(2000, 12000)
            val transition = rememberInfiniteTransition(label = "status-marquee")
            val offset by transition.animateFloat(
                initialValue = 0f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    tween(durationMillis = scrollDurationMs, delayMillis = 1500, easing = LinearEasing),
                    RepeatMode.Reverse,
                ),
                label = "status-marquee-offset",
            )
            Text(
                text,
                style = style,
                color = textColor,
                maxLines = 1,
                softWrap = false,
                modifier = Modifier.graphicsLayer { translationX = -offset * scrollRange },
            )
        } else {
            Text(
                text,
                style = style,
                color = textColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
