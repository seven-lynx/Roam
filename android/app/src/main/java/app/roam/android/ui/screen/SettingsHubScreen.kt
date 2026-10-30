package app.roam.android.ui.screen

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.core.net.toUri
import app.roam.android.BuildConfig
import app.roam.android.model.CategoryItem
import app.roam.android.model.FollowUser
import app.roam.android.model.SubcategoryItem
import app.roam.android.ui.component.CategoryIconLabel
import app.roam.android.ui.component.LevelProgressBar
import app.roam.android.ui.component.RoamOsLoadingBlock
import app.roam.android.ui.component.SettingsActionRow
import app.roam.android.ui.component.SettingsSectionHeader
import app.roam.android.ui.component.SettingsTopBar
import app.roam.android.viewmodel.MainViewModel

@Composable
fun SettingsHubScreen(
    vm: MainViewModel,
    onSignOut: () -> Unit,
    roamOs: Boolean = false,
    onNavigateToProfile: () -> Unit = {},
    onNavigateToSaved: () -> Unit = {},
    onNavigateToHistory: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {},
    onNavigateToBadges: () -> Unit = {},
    onNavigateToChallenges: () -> Unit = {},
    onNavigateToLeaderboard: () -> Unit = {},
    onNavigateToPublicProfile: (String) -> Unit = {},
    onNavigateToRoam: () -> Unit = {},
    onOpenUserSearch: () -> Unit = {},
    onNavigateToActivityFeed: () -> Unit = {},
    onNavigateToAdmin: () -> Unit = {},
    onNavigateToAppearance: () -> Unit = {},
    onNavigateToBrowser: () -> Unit = {},
    onNavigateToDiscovery: () -> Unit = {},
    onNavigateToEffects: () -> Unit = {},
    onNavigateToSound: () -> Unit = {},
) {
    val profile by vm.profile.collectAsState()
    val profileLoading by vm.profileLoading.collectAsState()
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
    val currentUrl by vm.currentUrl.collectAsState()
    val savedConfirmation by vm.savedConfirmation.collectAsState()
    val categories by vm.categories.collectAsState()
    val subcategories by vm.subcategories.collectAsState()
    val context = LocalContext.current

    var expandedList by remember { mutableStateOf<String?>(null) }
    var showSubmitUrlDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        // Re-sync role when the hub opens so the Admin/Mod entry appears even if
        // the ViewModel was created before the session finished loading.
        vm.checkUserRole()
        vm.loadProfile()
        vm.loadChallenges()
        vm.fetchUnreadNotificationCount()
    }

    val unlockedBadgeCount = if (badgesLoading && badges.isEmpty()) null else badges.count { it.isUnlocked }
    val totalBadges = badges.size
    val userId = profile?.id

    if (showSubmitUrlDialog) {
        SubmitUrlDialog(
            currentUrl = currentUrl,
            categories = categories,
            subcategories = subcategories,
            roamOs = roamOs,
            onSubmit = { url, categoryId, subcategoryId ->
                vm.submitUrl(url, categoryId, subcategoryId)
                showSubmitUrlDialog = false
            },
            onDismiss = { showSubmitUrlDialog = false },
        )
    }

    Scaffold(
        topBar = {
            SettingsTopBar(
                title = if (roamOs) "SETTINGS HUB" else "Settings",
                roamOs = roamOs,
                onNavigateBack = onNavigateToRoam,
                closeIcon = true,
            )
        },
    ) { innerPadding ->
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

            if (profileLoading && profile == null) {
                RoamOsLoadingBlock(label = "SIGNAL //")
                Spacer(Modifier.height(16.dp))
            } else {
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
                StatCell("Badges", unlockedBadgeCount?.let { "$it/$totalBadges" } ?: "...", onClick = onNavigateToBadges)
            }
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

            // Account
            SettingsSectionHeader(if (roamOs) "IDENTITY" else "Account")
            SettingsActionRow("Edit Profile", "Name, bio, interests, privacy", onClick = onNavigateToProfile)
            SettingsActionRow("Collections", "${collections.size} collections", onClick = onNavigateToSaved)
            SettingsActionRow("Saved URLs", "${savedUrls.size} saved", onClick = onNavigateToSaved)
            SettingsActionRow("Bookmark this page", if (savedConfirmation) "Saved!" else currentUrl ?: "No page loaded", onClick = { vm.saveForLater() })
            SettingsActionRow("History", "Pages you've visited", onClick = onNavigateToHistory)
            SettingsActionRow("Notifications", if (unreadNotificationCount > 0) "${unreadNotificationCount} unread" else "All caught up", onClick = onNavigateToNotifications)

            HorizontalDivider()
            Spacer(Modifier.height(8.dp))

            // Social
            SettingsSectionHeader(if (roamOs) "NETWORK" else "Social")
            SettingsActionRow("Search users", "Find people to follow", onClick = onOpenUserSearch)
            SettingsActionRow("Leaderboard", "Top explorers", onClick = onNavigateToLeaderboard)
            SettingsActionRow("Badges", "View all badges", onClick = onNavigateToBadges)
            SettingsActionRow("Challenges", "Complete challenges and earn XP", onClick = onNavigateToChallenges)
            SettingsActionRow("Activity feed", "See what people you follow are doing", onClick = onNavigateToActivityFeed)
            SettingsActionRow("Open in Roam Web", "roamtheweb.app", onClick = {
                vm.navigateToWeb("https://roamtheweb.app")
                onNavigateToRoam()
            })

            HorizontalDivider()
            Spacer(Modifier.height(8.dp))

            // Preferences
            SettingsSectionHeader(if (roamOs) "CONFIG" else "Preferences")
            SettingsActionRow(if (roamOs) "Display // Optics" else "Appearance", "Theme, frame, CRT, wear and deck", onClick = onNavigateToAppearance)
            SettingsActionRow(if (roamOs) "Net // Browser" else "Browser", "Languages, dark mode, translation", onClick = onNavigateToBrowser)
            SettingsActionRow(if (roamOs) "Scan // Discovery" else "Discovery", "Categories, focus mode, paywalls", onClick = onNavigateToDiscovery)
            SettingsActionRow(if (roamOs) "Sensory // Feedback" else "Notifications & Effects", "Push, sounds, haptics, celebrations", onClick = onNavigateToEffects)
            SettingsActionRow(if (roamOs) "Audio // Channels" else "Sound", "Volume, channel switches, sound", onClick = onNavigateToSound)

            HorizontalDivider()
            Spacer(Modifier.height(8.dp))

            // Feedback
            SettingsSectionHeader(if (roamOs) "UPLINK" else "Feedback")
            SettingsActionRow(if (roamOs) "Upload URL" else "Submit a URL", if (roamOs) "Push a new page to the network" else "Suggest a page to add to Roam", onClick = { showSubmitUrlDialog = true })
            SettingsActionRow("Send feedback", "Tell us what you think", onClick = {
                val intent = Intent(Intent.ACTION_SENDTO).apply {
                    data = "mailto:developer@roamtheweb.app".toUri()
                    putExtra(Intent.EXTRA_SUBJECT, "Roam feedback")
                }
                context.startActivity(Intent.createChooser(intent, "Send feedback"))
            })
            SettingsActionRow("Report dead link", currentUrl ?: "No page loaded", onClick = {
                vm.reportBrokenLink()
                onNavigateToRoam()
            })

            HorizontalDivider()
            Spacer(Modifier.height(8.dp))

            // About
            SettingsSectionHeader(if (roamOs) "SYSINFO" else "About")
            SettingsActionRow("Privacy policy", null, onClick = {
                CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse("https://roamtheweb.app/privacy"))
            })
            SettingsActionRow("Replay guided tour", "See the walkthrough again", onClick = {
                vm.resetWalkthrough()
                onNavigateToRoam()
            })
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Version", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                Text(BuildConfig.VERSION_NAME, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f))
            }

            // Admin / Moderator
            val adminModeEnabled by vm.adminModeEnabled.collectAsState()
            val moderatorModeEnabled by vm.moderatorModeEnabled.collectAsState()
            if (adminModeEnabled || moderatorModeEnabled) {
                HorizontalDivider()
                Spacer(Modifier.height(8.dp))
                SettingsSectionHeader(if (adminModeEnabled) (if (roamOs) "ROOT" else "Admin") else "Moderator")
                SettingsActionRow(
                    if (adminModeEnabled) (if (roamOs) "Root Panel" else "Admin Panel") else "Moderator Panel",
                    "Manage submissions, reports, and more",
                    onClick = onNavigateToAdmin,
                )
            }

            HorizontalDivider()
            Spacer(Modifier.height(8.dp))

            SettingsActionRow("Sign out", null, tint = MaterialTheme.colorScheme.error, onClick = onSignOut)

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
private fun StatCell(label: String, value: String, onClick: () -> Unit = {}) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable { onClick() }) {
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun SubmitUrlDialog(
    currentUrl: String? = null,
    categories: List<CategoryItem>,
    subcategories: List<SubcategoryItem>,
    onSubmit: (url: String, categoryId: String, subcategoryId: String?) -> Unit,
    onDismiss: () -> Unit,
    roamOs: Boolean = false,
) {
    var url by remember { mutableStateOf(currentUrl ?: "") }
    var selectedCategoryId by remember { mutableStateOf<String?>(null) }
    var selectedSubcategoryId by remember { mutableStateOf<String?>(null) }
    var categoryDropdownExpanded by remember { mutableStateOf(false) }
    var subcategoryDropdownExpanded by remember { mutableStateOf(false) }

    val selectedCategory = categories.firstOrNull { it.id == selectedCategoryId }
    val filteredSubcats = subcategories.filter { it.categoryId == selectedCategoryId }
    val selectedSubcat = filteredSubcats.firstOrNull { it.id == selectedSubcategoryId }
    val canSubmit = url.isNotBlank() && selectedCategoryId != null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (roamOs) "Upload URL" else "Submit a URL") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = url,
                    onValueChange = { url = it },
                    label = { Text("URL") },
                    placeholder = { Text("https://example.com/article") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                // Category picker
                Column {
                    Text("Category", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    Spacer(Modifier.height(4.dp))
                    Box {
                        OutlinedButton(onClick = { categoryDropdownExpanded = true }, modifier = Modifier.fillMaxWidth()) {
                            if (selectedCategory != null) {
                                CategoryIconLabel(selectedCategory.icon, selectedCategory.name, modifier = Modifier.weight(1f))
                            } else {
                                Text("Pick a category...", modifier = Modifier.weight(1f))
                            }
                        }
                        DropdownMenu(expanded = categoryDropdownExpanded, onDismissRequest = { categoryDropdownExpanded = false }) {
                            categories.forEach { cat ->
                                DropdownMenuItem(
                                    text = { CategoryIconLabel(cat.icon, cat.name) },
                                    onClick = {
                                        selectedCategoryId = cat.id
                                        selectedSubcategoryId = null
                                        categoryDropdownExpanded = false
                                    },
                                )
                            }
                        }
                    }
                }

                // Subcategory picker — only shown once a category is selected
                if (selectedCategoryId != null && filteredSubcats.isNotEmpty()) {
                    Column {
                        Text("Topic (optional)", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                        Spacer(Modifier.height(4.dp))
                        Box {
                            OutlinedButton(onClick = { subcategoryDropdownExpanded = true }, modifier = Modifier.fillMaxWidth()) {
                                Text(selectedSubcat?.name ?: "Any topic", modifier = Modifier.weight(1f))
                            }
                            DropdownMenu(expanded = subcategoryDropdownExpanded, onDismissRequest = { subcategoryDropdownExpanded = false }) {
                                DropdownMenuItem(
                                    text = { Text("Any topic") },
                                    onClick = { selectedSubcategoryId = null; subcategoryDropdownExpanded = false },
                                )
                                filteredSubcats.forEach { sub ->
                                    DropdownMenuItem(
                                        text = { Text(sub.name) },
                                        onClick = { selectedSubcategoryId = sub.id; subcategoryDropdownExpanded = false },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSubmit(url.trim(), selectedCategoryId!!, selectedSubcategoryId) },
                enabled = canSubmit,
            ) { Text("Submit") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}