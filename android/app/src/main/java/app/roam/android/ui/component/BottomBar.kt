package app.roam.android.ui.component

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ThumbDown
import androidx.compose.material.icons.outlined.ThumbUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

enum class RoamTab(val route: String) {
    Roam("discover"),
    Settings("settings"),
    // Accessible via Settings, not bottom bar
    Saved("saved"),
    Profile("profile"),
    History("history"),
}

@Composable
fun BottomBar(
    currentRoute: String,
    onThumbsDown: () -> Unit,
    onThumbsUp: () -> Unit,
    modifier: Modifier = Modifier,
    onRoam: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    focusModeEnabled: Boolean = false,
    hasRatedUp: Boolean = false,
) {
    // Track recent clicks for temporary highlight feedback
    var recentLikeClick by remember { mutableStateOf(false) }
    var recentSkipClick by remember { mutableStateOf(false) }

    // Auto-reset like click after 500ms
    LaunchedEffect(recentLikeClick) {
        if (recentLikeClick) {
            kotlinx.coroutines.delay(500)
            recentLikeClick = false
        }
    }

    // Auto-reset skip click after 500ms
    LaunchedEffect(recentSkipClick) {
        if (recentSkipClick) {
            kotlinx.coroutines.delay(500)
            recentSkipClick = false
        }
    }

    NavigationBar(modifier = modifier) {
        // Thumbs Down
        NavigationBarItem(
            selected = false,
            onClick = {
                recentSkipClick = true
                onThumbsDown()
            },
            icon = {
                Icon(
                    if (recentSkipClick) Icons.Filled.ThumbDown else Icons.Outlined.ThumbDown,
                    contentDescription = "Skip",
                    tint = if (recentSkipClick) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            label = { Text("Skip", style = MaterialTheme.typography.labelSmall) },
        )

        // Roam
        NavigationBarItem(
            selected = currentRoute == RoamTab.Roam.route,
            onClick = {
                if (currentRoute == RoamTab.Roam.route) {
                    // Already on Roam tab — load a new URL
                    onRoam()
                } else {
                    onNavigate(RoamTab.Roam.route)
                }
            },
            icon = {
                Icon(
                    if (currentRoute == RoamTab.Roam.route) Icons.Filled.Explore else Icons.Outlined.Explore,
                    contentDescription = "Roam",
                    tint = if (focusModeEnabled) MaterialTheme.colorScheme.tertiary
                           else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            label = {
                Text(
                    if (focusModeEnabled) "Focus" else "Roam",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (focusModeEnabled) MaterialTheme.colorScheme.tertiary
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
        )

        // Settings
        NavigationBarItem(
            selected = currentRoute == RoamTab.Settings.route,
            onClick = {
                if (currentRoute != RoamTab.Settings.route) {
                    onNavigate(RoamTab.Settings.route)
                }
            },
            icon = {
                Icon(
                    if (currentRoute == RoamTab.Settings.route) Icons.Filled.Settings else Icons.Outlined.Settings,
                    contentDescription = "Settings",
                )
            },
            label = { Text("Settings", style = MaterialTheme.typography.labelSmall) },
        )

        // Thumbs Up
        NavigationBarItem(
            selected = false,
            onClick = {
                recentLikeClick = true
                onThumbsUp()
            },
            icon = {
                Icon(
                    if (hasRatedUp || recentLikeClick) Icons.Filled.ThumbUp else Icons.Outlined.ThumbUp,
                    contentDescription = "Like",
                    tint = if (hasRatedUp || recentLikeClick) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            label = { Text("Like", style = MaterialTheme.typography.labelSmall) },
        )
    }
}