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
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState
enum class RoamTab(val route: String, val label: String) {
    Roam("discover", "Roam"),
    Settings("settings", "Settings"),
    Saved("saved", "Saved"),
    Profile("profile", "Profile"),
}
@Composable
fun BottomBar(
    navController: NavController,
    onThumbsDown: () -> Unit,
    onThumbsUp: () -> Unit,
    onRoam: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route
    NavigationBar(modifier = modifier) {
        NavigationBarItem(
            selected = false,
            onClick = onThumbsDown,
            icon = { Icon(Icons.Filled.ThumbDown, contentDescription = "Skip", tint = MaterialTheme.colorScheme.onSurfaceVariant) },
            label = { Text("Skip", style = MaterialTheme.typography.labelSmall) },
        )
        NavigationBarItem(
            selected = currentRoute == RoamTab.Roam.route,
            onClick = {
                if (currentRoute == RoamTab.Roam.route) {
                    onRoam()
                } else {
                    navController.navigate(RoamTab.Roam.route) {
                        popUpTo(RoamTab.Roam.route) { inclusive = true }
                        launchSingleTop = true
                    }
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
        NavigationBarItem(
            selected = currentRoute == RoamTab.Settings.route,
            onClick = {
                if (currentRoute != RoamTab.Settings.route) {
                    navController.navigate(RoamTab.Settings.route) {
                        popUpTo(RoamTab.Roam.route) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
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
        NavigationBarItem(
            selected = false,
            onClick = onThumbsUp,
            icon = { Icon(Icons.Filled.ThumbUp, contentDescription = "Like", tint = MaterialTheme.colorScheme.primary) },
            label = { Text("Like", style = MaterialTheme.typography.labelSmall) },
        )
    }
}