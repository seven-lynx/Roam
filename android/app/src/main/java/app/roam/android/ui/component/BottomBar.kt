package app.roam.android.ui.component

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

enum class RoamTab(val route: String, val label: String) {
    Roam("discover", "Roam"),
    Settings("settings", "Settings"),
    // Accessible via Settings, not bottom bar
    Saved("saved", "Saved"),
    Profile("profile", "Profile"),
}

@Composable
fun BottomBar(
    currentRoute: String,
    onThumbsDown: () -> Unit,
    onThumbsUp: () -> Unit,
    onRoam: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    NavigationBar(modifier = modifier) {
        // Thumbs Down
        NavigationBarItem(
            selected = false,
            onClick = onThumbsDown,
            icon = { Icon(Icons.Filled.ThumbDown, contentDescription = "Skip", tint = MaterialTheme.colorScheme.onSurfaceVariant) },
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
                )
            },
            label = { Text("Roam", style = MaterialTheme.typography.labelSmall) },
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
            onClick = onThumbsUp,
            icon = { Icon(Icons.Filled.ThumbUp, contentDescription = "Like", tint = MaterialTheme.colorScheme.primary) },
            label = { Text("Like", style = MaterialTheme.typography.labelSmall) },
        )
    }
}