package app.roam.android.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.roam.android.model.AppNotification
import app.roam.android.viewmodel.MainViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private fun formatTimeAgo(createdAt: String): String {
    val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
    fmt.timeZone = TimeZone.getTimeZone("UTC")
    val date = runCatching { fmt.parse(createdAt.take(19)) }.getOrNull() ?: return createdAt
    val now = System.currentTimeMillis()
    val diff = now - date.time
    val seconds = diff / 1000
    val minutes = seconds / 60
    val hours = minutes / 60
    val days = hours / 24

    return when {
        seconds < 60 -> "just now"
        minutes < 60 -> "${minutes}m ago"
        hours < 24 -> "${hours}h ago"
        days < 30 -> "${days}d ago"
        else -> SimpleDateFormat("MMM d", Locale.US).format(date)
    }
}

private fun getNotificationIcon(type: String): String = when (type) {
    "url_approved" -> "\u2705"
    "url_rejected" -> "\u274C"
    "new_follower" -> "\uD83D\uDC64"
    "badge_unlocked" -> "\uD83C\uDFC5"
    "level_up" -> "\u2B06\uFE0F"
    else -> "\uD83D\uDD14"
}

/**
 * Resolves a navigation deep-link from a notification.
 * Returns a relative path (e.g. "/u/alice") for in-app navigation,
 * or a full URL (e.g. "https://example.com") for browser fallback.
 */
private fun resolveNotificationUrl(notification: AppNotification): String? {
    return when (notification.type) {
        "url_approved", "url_rejected" -> notification.data?.url
        "new_follower" -> notification.data?.followerUsername?.let { "/u/$it" }
        "badge_unlocked", "level_up" -> notification.data?.vProfileUrl
        else -> null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    vm: MainViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToUrl: ((String) -> Unit)? = null,
) {
    val notifications by vm.notifications.collectAsState()
    val notificationsLoading by vm.notificationsLoading.collectAsState()
    val unreadCount by vm.unreadNotificationCount.collectAsState()

    LaunchedEffect(Unit) { vm.loadNotifications() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notifications") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (unreadCount > 0) {
                        TextButton(onClick = { vm.markAllNotificationsRead() }) {
                            Text("Mark all read")
                        }
                    }
                },
            )
        },
    ) { innerPadding ->
        if (notificationsLoading) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Spacer(Modifier.height(48.dp))
                CircularProgressIndicator(
                    modifier = Modifier.size(32.dp),
                    strokeWidth = 2.dp,
                )
            }
        } else if (notifications.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 32.dp, vertical = 48.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    "\uD83D\uDD14",
                    style = MaterialTheme.typography.headlineLarge,
                )
                Spacer(Modifier.height(16.dp))
                Text(
                    "No notifications yet",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "You'll be notified about your submissions, followers, and other activity.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
            ) {
                items(notifications, key = { it.id }) { notif ->
                    NotificationRow(
                        notification = notif,
                        onDelete = { vm.deleteNotification(notif.id) },
                        onNavigateToUrl = onNavigateToUrl,
                    )
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(
    notification: AppNotification,
    onDelete: () -> Unit,
    onNavigateToUrl: ((String) -> Unit)?,
) {
    var expanded by remember { mutableStateOf(false) }
    val isUnread = !notification.read
    val surfaceColor = if (isUnread) {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
    } else {
        Color.Transparent
    }

    val notificationUrl = resolveNotificationUrl(notification)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded }
            .padding(horizontal = 16.dp, vertical = 10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top,
        ) {
            Text(
                getNotificationIcon(notification.type),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(top = 2.dp),
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        notification.title,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (isUnread) MaterialTheme.colorScheme.onSurface
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = if (expanded) Int.MAX_VALUE else 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    if (isUnread) {
                        val dotColor = MaterialTheme.colorScheme.primary
                        Spacer(Modifier.width(8.dp))
                        androidx.compose.foundation.Canvas(
                            modifier = Modifier.size(8.dp),
                        ) {
                            drawCircle(
                                color = dotColor,
                                radius = 4.dp.toPx(),
                            )
                        }
                    }
                }
                // Body always visible; expands to full text when tapped
                if (notification.body != null) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        notification.body,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = if (expanded) Int.MAX_VALUE else 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    formatTimeAgo(notification.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                )
            }

            // Delete button
            IconButton(
                onClick = onDelete,
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = "Delete notification",
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                )
            }
        }

        // Expanded section: "Open link" button if the notification has a deep-link
        AnimatedVisibility(
            visible = expanded && notificationUrl != null && onNavigateToUrl != null,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut(),
        ) {
            val label = when (notification.type) {
                "new_follower" -> "View profile"
                "badge_unlocked" -> "View badges"
                "level_up" -> "View profile"
                else -> "Open in Roam"
            }
            TextButton(
                onClick = { onNavigateToUrl?.invoke(notificationUrl!!) },
                modifier = Modifier
                    .padding(start = 48.dp, top = 4.dp),
            ) {
                Icon(
                    Icons.Filled.OpenInBrowser,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    label,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
    }
}