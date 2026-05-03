package app.roam.android.ui.component

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PersonOutline
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.vectorResource
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState
import app.roam.android.R

enum class RoamTab(
    val route: String,
    val label: String,
) {
    Discover("discover", "Discover"),
    Saved("saved", "Saved"),
    Profile("profile", "Profile"),
    Settings("settings", "Settings"),
}

@Composable
fun BottomBar(
    navController: NavController,
    modifier: Modifier = Modifier,
) {
    val backStack = navController.currentBackStackEntryAsState()
    val currentRoute = backStack.value?.destination?.route

    NavigationBar(modifier = modifier) {
        RoamTab.entries.forEach { tab ->
            val selected = currentRoute == tab.route
            NavigationBarItem(
                selected = selected,
                onClick = {
                    if (!selected) {
                        navController.navigate(tab.route) {
                            popUpTo(RoamTab.Discover.route) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                icon = {
                    Icon(
                        imageVector = tabIcon(tab, selected),
                        contentDescription = tab.label,
                    )
                },
                label = { Text(tab.label, style = MaterialTheme.typography.labelSmall) },
            )
        }
    }
}

@Composable
private fun tabIcon(tab: RoamTab, selected: Boolean): ImageVector = when (tab) {
    RoamTab.Discover -> ImageVector.vectorResource(R.drawable.ic_compass)
    RoamTab.Saved    -> if (selected) Icons.Filled.Bookmark else Icons.Filled.BookmarkBorder
    RoamTab.Profile  -> if (selected) Icons.Filled.Person   else Icons.Filled.PersonOutline
    RoamTab.Settings -> if (selected) Icons.Filled.Settings  else Icons.Outlined.Settings
}
