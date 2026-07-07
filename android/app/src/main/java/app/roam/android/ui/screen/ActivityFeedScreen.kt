package app.roam.android.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import app.roam.android.model.ActivityFeedItem
import app.roam.android.viewmodel.MainViewModel
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityFeedScreen(
    vm: MainViewModel,
    onNavigateBack: () -> Unit = {},
    onNavigateToProfile: (String) -> Unit = {},
    onNavigateToUrl: (String) -> Unit = {},
) {
    val feed by vm.activityFeed.collectAsState()
    val loading by vm.activityFeedLoading.collectAsState()
    val error by vm.activityFeedError.collectAsState()

    LaunchedEffect(Unit) { vm.loadActivityFeed() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Following") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .navigationBarsPadding()
                .padding(horizontal = 16.dp),
        ) {
            if (loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Loading…", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                }
            } else if (error != null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(error ?: "Error", color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(8.dp))
                        Text("Follow some people to see their activity here", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
                    }
                }
            } else if (feed.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("📭", fontSize = 48.sp)
                        Text("No activity yet", style = MaterialTheme.typography.bodyLarge)
                        Text("Follow people to see what they're discovering", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                    modifier = Modifier.padding(bottom = 16.dp),
                ) {
                    items(feed) { item -> FeedRow(item, onNavigateToProfile, onNavigateToUrl) }
                }
            }
        }
    }
}

@Composable
private fun FeedRow(
    item: ActivityFeedItem,
    onNavigateToProfile: (String) -> Unit,
    onNavigateToUrl: (String) -> Unit,
) {
    val initial = (item.displayName.takeIf { it.isNotBlank() } ?: item.username).firstOrNull()?.uppercase() ?: "?"
    val actionText = when (item.activityType) {
        "url_submitted" -> "submitted a link"
        "url_rated" -> "rated a page"
        "collection_created" -> "created a collection"
        "badge_unlocked" -> "unlocked a badge"
        else -> item.activityType
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                when (item.activityType) {
                    "url_submitted", "url_rated" -> {
                        if (item.subjectId != null) onNavigateToUrl("https://roamtheweb.app/url/${item.subjectId}")
                    }
                    else -> onNavigateToProfile(item.username)
                }
            }
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(36.dp).clip(CircleShape).background(Color(0xFF7C3AED)),
            contentAlignment = Alignment.Center,
        ) {
            Text(initial, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
        Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Row {
                Text(
                    item.displayName.ifBlank { item.username },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    " $actionText",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                )
            }
            if (item.subjectTitle?.isNotBlank() == true) {
                Text(
                    item.subjectTitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            item.createdAt.takeIf { it.isNotBlank() }?.let { timestamp ->
                Text(
                    timestamp.take(10),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.35f),
                )
            }
        }
    }
}