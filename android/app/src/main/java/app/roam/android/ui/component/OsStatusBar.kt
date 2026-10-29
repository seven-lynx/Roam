package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(enabled = errorText != null) { onRetry() }
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text,
            style = MaterialTheme.typography.labelMedium,
            color = when {
                errorText != null -> MaterialTheme.colorScheme.error
                loading -> MaterialTheme.colorScheme.secondary
                else -> MaterialTheme.colorScheme.onSurfaceVariant
            },
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
