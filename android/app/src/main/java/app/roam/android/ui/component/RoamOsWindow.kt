package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Oxide3
import app.roam.android.ui.theme.Panel
import app.roam.android.ui.theme.TealBright

/**
 * Shared "app running on ROAM-OS" window chrome: a title bar with a close key
 * over a dark panel, styled to read as a program window on the handheld.
 */
@Composable
fun RoamOsWindow(
    title: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(Panel)
            .border(1.dp, LineColor, RoundedCornerShape(10.dp)),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Oxide3)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(title, style = MaterialTheme.typography.labelLarge, color = TealBright)
            Spacer(Modifier.weight(1f))
            Text(
                "\u2715",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.clickable { onClose() }.padding(horizontal = 8.dp),
            )
        }
        content()
    }
}

/**
 * Shared "ROAM-OS" modal dialog: the same window chrome as [RoamOsWindow] but
 * rendered as a centered dialog. [header] is the terminal `// comment` line,
 * [footer] a `key: value` status readout.
 */
@Composable
fun RoamOsDialog(
    title: String,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    header: String? = null,
    footer: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = modifier
                .widthIn(max = 480.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Panel)
                .border(1.dp, LineColor, RoundedCornerShape(10.dp)),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(Oxide3)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(title, style = MaterialTheme.typography.labelLarge, color = TealBright)
                Spacer(Modifier.weight(1f))
                Text(
                    "\u2715",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.clickable { onDismiss() }.padding(horizontal = 8.dp),
                )
            }
            Column(Modifier.fillMaxWidth().padding(12.dp)) {
                if (header != null) {
                    Text(header, style = MaterialTheme.typography.labelSmall, color = Fog)
                    Spacer(Modifier.height(8.dp))
                }
                content()
                if (footer != null) {
                    Spacer(Modifier.height(12.dp))
                    Text(footer, style = MaterialTheme.typography.labelSmall, color = Fog)
                }
            }
        }
    }
}
