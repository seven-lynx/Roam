package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.ui.theme.Abyss
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.NeonGreen
import app.roam.android.ui.theme.SevenSegment
import app.roam.android.ui.theme.Warn

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
    onRetry: () -> Unit = {},
) {
    val text = when {
        errorText != null -> "$errorText"
        exhausted -> "SIGNAL EXHAUSTED — ADJUST CATEGORIES"
        offline -> "OFFLINE"
        loading -> "ROAMING…"
        else -> {
            val parts = listOfNotNull(category, domain, subcategory)
            if (parts.isEmpty()) "AWAITING SIGNAL" else parts.joinToString(" · ")
        }
    }

    val ledColor = when {
        errorText != null -> MaterialTheme.colorScheme.error
        exhausted || offline -> Warn
        else -> NeonGreen
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Abyss)
            .border(1.dp, LineColor)
            .clickable(enabled = errorText != null) { onRetry() }
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text,
            style = MaterialTheme.typography.labelMedium.copy(
                fontFamily = SevenSegment,
                fontSize = 15.sp,
                letterSpacing = 1.sp,
                color = ledColor,
                shadow = Shadow(color = ledColor.copy(alpha = 0.85f), offset = Offset.Zero, blurRadius = 9f),
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
