package app.roam.android.ui.screen

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.model.FollowUser
import app.roam.android.ui.component.LevelProgressBar
import app.roam.android.viewmodel.MainViewModel

@Composable
fun YouScreen(
    vm: MainViewModel,
    onSignOut: () -> Unit,
    onNavigateToProfile: () -> Unit = {},
    onNavigateToSaved: () -> Unit = {},
    onNavigateToHistory: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {},
    onNavigateToBadges: () -> Unit = {},
    onNavigateToChallenges: () -> Unit = {},
    onNavigateToLeaderboard: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {},
    onNavigateToPublicProfile: (String) -> Unit = {},
    onNavigateToRoam: () -> Unit = {},
    onOpenUserSearch: () -> Unit = {},
    onNavigateToActivityFeed: () -> Unit = {},
    onNavigateToAdmin: () -> Unit = {},
) {
    val profile by vm.profile.collectAsState()
    val badges by vm.badges.collectAsState()
    val badgesLoading by vm.badgesLoading.collectAsState()
    val followerCount by vm.followerCount.collectAsState()
    val followingCount by vm.followingCount.collectAsState()
    val followers by vm.followers.collectAsState()
    val following by vm.following.collectAsState()
    val followListsLoading by vm.followListsLoading.collectAsState()
    val collections by vm.collections.collectAsState()
    val savedUrls by vm.savedUrls.collectAsState()
    val unreadNotificationCount by vm.unreadNotificationCount.collectAsState()
    val context = LocalContext.current

    var expandedList by remember { mutableStateOf<String?>(null) } // null, "followers", "following"

    LaunchedEffect(Unit) {
        // Re-sync role when You opens so the Admin/Mod entry appears even if
        // the ViewModel was created before the session finished loading.
        vm.checkUserRole()
        vm.loadProfile()
        vm.loadCollections()
        vm.fetchUnreadNotificationCount()
    }


    val unlockedBadgeCount = if (badgesLoading && badges.isEmpty()) null else badges.count { it.isUnlocked }
    val totalBadges = badges.size

    val userId = profile?.id

    Scaffold { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(16.dp))

            // Avatar
            val avatarName = (profile?.displayName?.takeIf { it.isNotBlank() }
                ?: profile?.username?.takeIf { it.isNotBlank() }
                ?: "?").trim()
            val avatarInitial = avatarName.firstOrNull()?.uppercaseChar()?.toString() ?: "?"
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF7C3AED)),
                contentAlignment = Alignment.Center,
            ) {
                Text(avatarInitial, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(12.dp))

            Text(
                text = profile?.displayName?.takeIf { it.isNotBlank() } ?: profile?.username ?: "",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            if (profile?.username != null) {
                Text(
                    text = "@${profile?.username}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                )
            }

            Spacer(Modifier.height(8.dp))

            LevelProgressBar(
                level = profile?.level ?: 1,
                xpTotal = profile?.xpTotal ?: 0,
                streakDays = profile?.streakDays ?: 0,
                maxStreak = profile?.maxStreak ?: 0,
                badgeCount = unlockedBadgeCount ?: 0,
            )

            Spacer(Modifier.height(16.dp))

            // Stats row — tappable
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                StatCell("Followers", followerCount.toString(), onClick = {
                    if (expandedList == "followers") expandedList = null
                    else { expandedList = "followers"; userId?.let { vm.loadFollowers(it) } }
                })
                StatCell("Following", followingCount.toString(), onClick = {
                    if (expandedList == "following") expandedList = null
                    else { expandedList = "following"; userId?.let { vm.loadFollowing(it) } }
                })
                StatCell("Badges", unlockedBadgeCount?.let { "$it/$totalBadges" } ?: "…", onClick = onNavigateToBadges)
            }

            // Expandable followers list
            if (expandedList == "followers") {
                Spacer(Modifier.height(8.dp))
                HorizontalDivider()
                ExpandableUserList(
                    title = "Followers",
                    users = followers,
                    loading = followListsLoading,
                    onSelect = { expandedList = null; onNavigateToPublicProfile(it.username) },
                    onClose = { expandedList = null },
                )
            }

            // Expandable following list
            if (expandedList == "following") {
                Spacer(Modifier.height(8.dp))
                HorizontalDivider()
                ExpandableUserList(
                    title = "Following",
                    users = following,
                    loading = followListsLoading,
                    onSelect = { expandedList = null; onNavigateToPublicProfile(it.username) },
                    onClose = { expandedList = null },
                )
            }

            Spacer(Modifier.height(8.dp))

            HorizontalDivider()
            Spacer(Modifier.height(8.dp))

            // ── Account ──────────────────────────────────────────
            SectionHeader("Account")
            ActionRow("Edit Profile", "Name, bio, interests, privacy", onClick = onNavigateToProfile)
            ActionRow("Collections", "${collections.size} collections", onClick = onNavigateToSaved)
            ActionRow("Saved URLs", "${savedUrls.size} saved", onClick = onNavigateToSaved)
            ActionRow("History", "Pages you've visited", onClick = onNavigateToHistory)
            ActionRow(
                "Notifications",
                if (unreadNotificationCount > 0) "${unreadNotificationCount} unread" else "All caught up",
                onClick = onNavigateToNotifications,
            )

            HorizontalDivider()
            Spacer(Modifier.height(8.dp))

            // ── Social ───────────────────────────────────────────
            SectionHeader("Social")
            ActionRow("Search users", "Find people to follow", onClick = onOpenUserSearch)
            ActionRow("Leaderboard", "Top explorers", onClick = onNavigateToLeaderboard)
            ActionRow("Badges", "View all badges", onClick = onNavigateToBadges)
            ActionRow("Challenges", "Complete challenges and earn XP", onClick = onNavigateToChallenges)
            ActionRow("Activity feed", "See what people you follow are doing", onClick = onNavigateToActivityFeed)
            ActionRow("Open in Roam Web", "roamtheweb.app", onClick = {
                vm.navigateToWeb("https://roamtheweb.app")
                onNavigateToRoam()
            })

            HorizontalDivider()
            Spacer(Modifier.height(8.dp))

            // ── App ─────────────────────────────────────────────
            SectionHeader("App")
            ActionRow("Settings", "Browser, discovery, appearance", onClick = onNavigateToSettings)
            ActionRow(
                "Privacy policy",
                null,
                onClick = {
                    vm.navigateToWeb("https://roamtheweb.app/privacy")
                    onNavigateToRoam()
                },
            )

            // Show Admin panel entry for privileged users
            val adminModeEnabled by vm.adminModeEnabled.collectAsState()
            val moderatorModeEnabled by vm.moderatorModeEnabled.collectAsState()
            if (adminModeEnabled || moderatorModeEnabled) {
                HorizontalDivider()
                Spacer(Modifier.height(8.dp))
                SectionHeader(if (adminModeEnabled) "Admin" else "Moderator")
                ActionRow(
                    if (adminModeEnabled) "\uD83D\uDD12 Admin Panel" else "\uD83D\uDEE1\uFE0F Moderator Panel",
                    "Manage submissions, reports, and more",
                    onClick = onNavigateToAdmin,
                )
            }

            HorizontalDivider()
            Spacer(Modifier.height(8.dp))

            ActionRow("Sign out", null, tint = MaterialTheme.colorScheme.error, onClick = onSignOut)

            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun ExpandableUserList(
    title: String,
    users: List<FollowUser>,
    loading: Boolean,
    onSelect: (FollowUser) -> Unit,
    onClose: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            Text("× Close", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f), modifier = Modifier.clickable { onClose() })
        }
        if (loading) {
            Text("Loading…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f), modifier = Modifier.padding(vertical = 8.dp))
        } else if (users.isEmpty()) {
            Text("No one yet", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f), modifier = Modifier.padding(vertical = 8.dp))
        } else {
            users.take(20).forEach { user ->
                val initials = (user.displayName.takeIf { it.isNotBlank() } ?: user.username).firstOrNull()?.uppercase() ?: "?"
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { onSelect(user) }.padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(32.dp).clip(CircleShape).background(Color(0xFF7C3AED)), contentAlignment = Alignment.Center) {
                        Text(initials, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Column(modifier = Modifier.weight(1f).padding(horizontal = 10.dp)) {
                        Text(user.displayName.ifBlank { user.username }, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("@${user.username}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(text = title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp))
}

@Composable
private fun ActionRow(title: String, subtitle: String?, onClick: () -> Unit, tint: Color = MaterialTheme.colorScheme.onSurface) {
    Row(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, color = tint, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun StatCell(label: String, value: String, onClick: () -> Unit = {}) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable { onClick() }) {
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}