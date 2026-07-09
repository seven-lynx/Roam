package app.roam.android.ui.screen

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.model.Badge
import app.roam.android.ui.component.BadgeDetailDialog
import app.roam.android.ui.component.LevelProgressBar
import app.roam.android.viewmodel.MainViewModel
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(
    vm: MainViewModel,
    onNavigateBack: () -> Unit = {},
    onSignOut: () -> Unit,
    onNavigateToBadges: () -> Unit = {},
) {
    val profile by vm.profile.collectAsState()
    val userCategoryIds by vm.userCategoryIds.collectAsState()
    val userTopicIds by vm.userTopicIds.collectAsState()
    val interestMode by vm.interestMode.collectAsState()
    val interestsDirty by vm.interestsDirty.collectAsState()
    val interestsSaving by vm.interestsSaving.collectAsState()
    val categories by vm.categories.collectAsState()
    val subcategories by vm.subcategories.collectAsState()
    val stats by vm.profileStats.collectAsState()
    val profileSaveError by vm.profileSaveError.collectAsState()
    val profileIsPublic by vm.profileIsPublic.collectAsState()
    val profileInterestsError by vm.profileInterestsError.collectAsState()
    val badges by vm.badges.collectAsState()

    val subcatsByCategory = subcategories.groupBy { it.categoryId }

    LaunchedEffect(Unit) { vm.loadProfile() }

    var username by remember(profile?.username) { mutableStateOf(profile?.username ?: "") }
    var displayName by remember(profile?.displayName) { mutableStateOf(profile?.displayName ?: "") }
    var bio by remember(profile?.bio) { mutableStateOf(profile?.bio ?: "") }

    LaunchedEffect(username, displayName, bio) {
        if (profile == null) return@LaunchedEffect
        delay(800)
        vm.onProfileFieldChanged(username, displayName, bio.ifBlank { null })
    }

    // Show unlocked badges compactly
    val unlockedBadges = badges.filter { it.isUnlocked }
    val lockedInProgress = badges.filter { !it.isUnlocked && it.progressCurrent > 0 }

    var selectedBadge by remember { mutableStateOf<Badge?>(null) }
    selectedBadge?.let { badge ->
        BadgeDetailDialog(badge = badge, onDismiss = { selectedBadge = null })
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profile") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
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
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Spacer(Modifier.height(8.dp))

            // Level progress card — use unlocked badges count for consistency
            LevelProgressBar(
                level = profile?.level ?: 1,
                xpTotal = profile?.xpTotal ?: 0,
                streakDays = profile?.streakDays ?: 0,
                maxStreak = profile?.maxStreak ?: 0,
                badgeCount = unlockedBadges.size,
            )

            // Avatar
            val avatarName = (profile?.displayName?.takeIf { it.isNotBlank() }
                ?: profile?.username?.takeIf { it.isNotBlank() }
                ?: "?").trim()
            val avatarColor = avatarColorFor(avatarName.ifBlank { "?" })
            val avatarInitial = avatarName.firstOrNull()?.uppercaseChar()?.toString() ?: "?"
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .background(avatarColor, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = avatarInitial,
                    color = Color.White,
                    fontSize = 40.sp,
                    fontWeight = FontWeight.Bold,
                )
            }

            // Stats row
            if (profile != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    StatCell(label = "Roamed", value = stats.roamed.toString())
                    StatCell(label = "Submitted", value = stats.submitted.toString())
                    StatCell(
                        label = "Joined",
                        value = (profile?.createdAt?.takeIf { it.isNotBlank() }
                            ?.take(10) ?: "—"),
                    )
                }
            }

            HorizontalDivider()

            // Profile save error
            if (profileSaveError != null) {
                Text(
                    text = profileSaveError ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            // Interests load failure
            if (profileInterestsError != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = profileInterestsError ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = { vm.reloadInterests() }) {
                        Text("Retry")
                    }
                }
            }

            // Badges section
            if (unlockedBadges.isNotEmpty()) {
                HorizontalDivider()
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Badges (${unlockedBadges.size})",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    TextButton(onClick = onNavigateToBadges) {
                        Text("View all →")
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    unlockedBadges.take(6).forEach { badge ->
                        BadgeMini(badge = badge, onClick = { selectedBadge = badge })
                    }
                    if (unlockedBadges.size > 6) {
                        Text(
                            "+${unlockedBadges.size - 6}",
                            modifier = Modifier
                                .padding(4.dp)
                                .align(Alignment.CenterVertically),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        )
                    }
                }
            }

            // In-progress badges
            if (lockedInProgress.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "In Progress",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    modifier = Modifier.align(Alignment.Start),
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    lockedInProgress.take(4).forEach { badge ->
                        BadgeMini(badge = badge, onClick = { selectedBadge = badge })
                    }
                }
            }

            HorizontalDivider()

            // Profile visibility toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Public profile", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        if (profileIsPublic) "Anyone can see your profile" else "Only you can see your profile",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    )
                }
                Switch(
                    checked = profileIsPublic,
                    onCheckedChange = { vm.toggleProfilePublic() },
                )
            }

            HorizontalDivider()

            // Edit fields
            OutlinedTextField(
                value = username,
                onValueChange = { username = it.take(30) },
                label = { Text("Username") },
                singleLine = true,
                isError = profileSaveError != null,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it.take(60) },
                label = { Text("Display name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = bio,
                onValueChange = { bio = it.take(200) },
                label = { Text("Bio") },
                minLines = 3,
                maxLines = 5,
                modifier = Modifier.fillMaxWidth(),
            )

            HorizontalDivider()

            // Interests
            Text(
                text = "Interests",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.align(Alignment.Start),
            )

            if (interestMode == "pillars") {
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    categories.forEach { category ->
                        val selected = category.id in userCategoryIds
                        FilterChip(
                            selected = selected,
                            onClick = { vm.toggleCategory(category.id, !selected) },
                            label = { Text("${category.icon} ${category.name}") },
                        )
                    }
                }
                if (subcategories.isNotEmpty()) {
                    TextButton(
                        onClick = { vm.setInterestMode("topics") },
                        modifier = Modifier.align(Alignment.Start),
                    ) {
                        Text("Choose specific topics instead \u2192")
                    }
                }
            } else {
                TextButton(
                    onClick = { vm.setInterestMode("pillars") },
                    modifier = Modifier.align(Alignment.Start),
                ) {
                    Text("\u2190 Choose categories instead")
                }
                categories.forEach { category ->
                    val subcats = subcatsByCategory[category.id] ?: emptyList()
                    if (subcats.isEmpty()) return@forEach
                    Text(
                        text = "${category.icon}  ${category.name}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp, bottom = 4.dp),
                    )
                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        subcats.forEach { sc ->
                            val selected = sc.id in userTopicIds
                            FilterChip(
                                selected = selected,
                                onClick = { vm.toggleTopic(sc.id, !selected) },
                                label = { Text(sc.name) },
                            )
                        }
                    }
                }
            }

            if (interestsDirty) {
                Button(
                    onClick = { vm.saveInterests() },
                    enabled = !interestsSaving && (
                        if (interestMode == "pillars") { userCategoryIds.isNotEmpty() }
                        else userTopicIds.isNotEmpty()
                    ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (interestsSaving) "Saving\u2026" else "Save interests")
                }
            }

            HorizontalDivider()

            OutlinedButton(
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error,
                ),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.error),
            ) {
                Text("Sign out")
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun BadgeMini(badge: Badge, onClick: () -> Unit = {}) {
    Column(
        modifier = Modifier.padding(4.dp).clickable { onClick() },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = if (badge.isHidden && !badge.isUnlocked) "\u2753" else badge.icon,
            fontSize = 20.sp,
        )
        if (badge.requiredCount != null && !badge.isUnlocked) {
            Text(
                text = "${badge.progressCurrent}/${badge.requiredCount}",
                fontSize = 9.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
            )
        }
    }
}

@Composable
private fun StatCell(label: String, value: String) {
    val safeValue = value.ifBlank { "\u2014" }
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(safeValue, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

private val AVATAR_COLORS = listOf(
    Color(0xFFE53935),
    Color(0xFFF4511E),
    Color(0xFFF6BF26),
    Color(0xFF33B679),
    Color(0xFF0B8043),
    Color(0xFF039BE5),
    Color(0xFF3F51B5),
    Color(0xFF7986CB),
    Color(0xFF8E24AA),
    Color(0xFFD81B60),
)

private fun avatarColorFor(name: String): Color {
    var hash = 0
    for (ch in name) {
        hash = (hash * 31 + ch.code) and 0x7FFFFFFF
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.size]
}