package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Feedback
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Panel2
import app.roam.android.ui.theme.TealBright

/** ROAM-OS "comms" panel: notifications, feedback, and submit-a-URL. */
@Composable
fun CommsMenu(
    onCheckNotifications: () -> Unit,
    onSendFeedback: (String, String?) -> Unit,
    onSubmitUrl: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var feedbackDialogOpen by remember { mutableStateOf(false) }
    var feedbackText by remember { mutableStateOf("") }
    var feedbackEmail by remember { mutableStateOf("") }

    RoamOsWindow(title = "COMMS", onClose = onClose, modifier = modifier) {
        Column(Modifier.fillMaxSize()) {
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(12.dp),
            ) {
                Text("// open a channel", style = MaterialTheme.typography.labelSmall, color = Fog)
                Spacer(Modifier.height(8.dp))
                CommsRow(Icons.Filled.Notifications, "Notifications", "Review your latest transmissions") {
                    onClose()
                    onCheckNotifications()
                }
                Spacer(Modifier.height(8.dp))
                CommsRow(Icons.Filled.Feedback, "Send feedback", "Beam your thoughts upstream") {
                    feedbackDialogOpen = true
                }
                Spacer(Modifier.height(8.dp))
                CommsRow(Icons.Filled.Link, "Upload URL", "Push a new site to the network") {
                    onClose()
                    onSubmitUrl()
                }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(LineColor))
            Text(
                "channels: 3 · uplink: idle",
                style = MaterialTheme.typography.labelSmall,
                color = Fog,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
    }

    if (feedbackDialogOpen) {
        RoamOsDialog(
            title = "COMMS // FEEDBACK",
            onDismiss = { feedbackDialogOpen = false },
            header = "// beam feedback upstream",
            footer = "bytes: 0/512 · channel: feedback",
        ) {
            OutlinedTextField(
                value = feedbackText,
                onValueChange = { feedbackText = it },
                label = { Text("Message") },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = feedbackEmail,
                onValueChange = { feedbackEmail = it },
                label = { Text("Email (optional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = { feedbackDialogOpen = false }) {
                    Text("cancel", style = MaterialTheme.typography.labelMedium, color = Fog)
                }
                TextButton(
                    onClick = {
                        onSendFeedback(feedbackText, feedbackEmail.ifBlank { null })
                        feedbackDialogOpen = false
                        feedbackText = ""
                        feedbackEmail = ""
                    },
                ) {
                    Text("send", style = MaterialTheme.typography.labelMedium, color = TealBright)
                }
            }
        }
    }
}

@Composable
private fun CommsRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    val clickSound = LocalClickSound.current
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(Panel2)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { clickSound(); onClick() }
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = title, tint = TealBright, modifier = Modifier.size(22.dp))
        Column(Modifier.padding(start = 12.dp)) {
            Text(title, style = MaterialTheme.typography.labelLarge, color = Bone)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = Fog,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
