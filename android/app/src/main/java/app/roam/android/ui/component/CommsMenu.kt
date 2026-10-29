package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.AlertDialog
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
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
            CommsRow(Icons.Filled.Notifications, "Notifications", "Review your latest alerts") {
                onClose()
                onCheckNotifications()
            }
            Spacer(Modifier.height(8.dp))
            CommsRow(Icons.Filled.Feedback, "Send feedback", "Tell us what you think") {
                feedbackDialogOpen = true
            }
            Spacer(Modifier.height(8.dp))
            CommsRow(Icons.Filled.Link, "Submit a URL", "Share a new site with Roam") {
                onClose()
                onSubmitUrl()
            }
        }
    }

    if (feedbackDialogOpen) {
        AlertDialog(
            onDismissRequest = { feedbackDialogOpen = false },
            title = { Text("Send feedback") },
            text = {
                Column {
                    OutlinedTextField(
                        value = feedbackText,
                        onValueChange = { feedbackText = it },
                        label = { Text("Message") },
                        minLines = 3,
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = feedbackEmail,
                        onValueChange = { feedbackEmail = it },
                        label = { Text("Email (optional)") },
                        singleLine = true,
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onSendFeedback(feedbackText, feedbackEmail.ifBlank { null })
                        feedbackDialogOpen = false
                        feedbackText = ""
                        feedbackEmail = ""
                    },
                ) { Text("Send") }
            },
            dismissButton = { TextButton(onClick = { feedbackDialogOpen = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun CommsRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(Panel2)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { onClick() }
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
