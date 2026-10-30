package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Panel2
import app.roam.android.ui.theme.TealBright
import app.roam.android.viewmodel.MainViewModel

@Composable
fun ShareUrlBottomSheet(
    vm: MainViewModel,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shareRecipients by vm.shareRecipients.collectAsState()
    val shareRecipientsLoading by vm.shareRecipientsLoading.collectAsState()

    RoamOsWindow(title = "SHARE", onClose = onDismiss, modifier = modifier) {
        Column(Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(12.dp),
            ) {
                Text(
                    "// send this page to a wanderer",
                    style = MaterialTheme.typography.labelSmall,
                    color = Fog,
                )
                Spacer(Modifier.height(10.dp))

                if (shareRecipientsLoading) {
                    Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                        Text("resolving uplink…", style = MaterialTheme.typography.bodySmall, color = Fog)
                    }
                } else if (shareRecipients.isEmpty()) {
                    Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("no recipients found", style = MaterialTheme.typography.bodyMedium, color = Bone)
                            Text("// follow someone to share links", style = MaterialTheme.typography.bodySmall, color = Fog)
                        }
                    }
                } else {
                    shareRecipients.forEach { recipient ->
                        val initials = (recipient.displayName.takeIf { it.isNotBlank() } ?: recipient.username)
                            .firstOrNull()?.uppercaseChar()?.toString() ?: "?"
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(6.dp))
                                .background(Panel2)
                                .clickable { vm.shareUrlWithUser(recipient.id) }
                                .padding(horizontal = 10.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier.size(34.dp).clip(CircleShape).background(TealBright),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(initials, color = Color(0xFF0A1214), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                            Column(modifier = Modifier.weight(1f).padding(horizontal = 10.dp)) {
                                Text(
                                    recipient.displayName.ifBlank { recipient.username },
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Bone,
                                    fontWeight = FontWeight.Medium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    "@${recipient.username}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Fog,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                            Text("SEND →", style = MaterialTheme.typography.labelMedium, color = TealBright)
                        }
                        Spacer(Modifier.height(6.dp))
                    }
                }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(LineColor))
            Text(
                "relay: ready · recipients: ${shareRecipients.size}",
                style = MaterialTheme.typography.labelSmall,
                color = Fog,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
    }
}