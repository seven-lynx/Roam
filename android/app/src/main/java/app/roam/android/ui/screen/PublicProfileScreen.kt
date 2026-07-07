package app.roam.android.ui.screen

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.ui.component.LevelProgressBar
import app.roam.android.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PublicProfileScreen(
    vm: MainViewModel,
    username: String,
    onNavigateBack: () -> Unit = {},
    onNavigateToUrl: (String) -> Unit = {},
) {
    val publicProfile by vm.publicProfile.collectAsState()
    val publicProfileLoading by vm.publicProfileLoading.collectAsState()
    val publicProfileError by vm.publicProfileError.collectAsState()
    val followStatus by vm.followStatus.collectAsState()
    val followLoading by vm.followLoading.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(username) { vm.loadPublicProfile(username) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(publicProfile?.displayName?.takeIf { it.isNotBlank() } ?: username) },
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
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            when {
                publicProfileLoading -> {
                    Spacer(Modifier.height(64.dp))
                    Text("Loading…", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                }
                publicProfileError != null -> {
                    Spacer(Modifier.height(64.dp))
                    Text(publicProfileError ?: "Error", color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = { vm.loadPublicProfile(username) }) {
                        Text("Retry")
                    }
                }
                publicProfile == null -> {
                    Spacer(Modifier.height(64.dp))
                    Text("Couldn't load this profile.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = { vm.loadPublicProfile(username) }) {
                        Text("Retry")
                    }
                }
                publicProfile != null -> {
                    val profile = publicProfile!!
                    Spacer(Modifier.height(16.dp))

                    // Avatar
                    val avatarName = (profile.displayName.takeIf { it.isNotBlank() } ?: profile.username).trim()
                    val initial = avatarName.firstOrNull()?.uppercaseChar()?.toString() ?: "?"
                    Box(
                        modifier = Modifier.size(96.dp).clip(CircleShape).background(Color(0xFF7C3AED)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(initial, color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.Bold)
                    }

                    Spacer(Modifier.height(12.dp))

                    Text(profile.displayName.ifBlank { profile.username }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text("@${profile.username}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))

                    if (profile.bio?.isNotBlank() == true) {
                        Spacer(Modifier.height(8.dp))
                        Text(profile.bio, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
                    }

                    Spacer(Modifier.height(12.dp))

                    // Follow / Copy link
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                if (followStatus == "following") vm.unfollowUser(profile.id)
                                else vm.followUser(profile.id)
                            },
                            enabled = !followLoading,
                            colors = if (followStatus == "following") ButtonDefaults.outlinedButtonColors() else ButtonDefaults.buttonColors(),
                        ) {
                            Text(if (followLoading) "…" else if (followStatus == "following") "Following" else "Follow")
                        }
                        OutlinedButton(onClick = {
                            val clip = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clip.setPrimaryClip(ClipData.newPlainText("profile link", "https://roamtheweb.app/u/${profile.username}"))
                            vm.showTransientToast("Profile link copied")
                        }) {
                            Text("Copy link")
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    // Level/XP — use unlocked badges count for consistency
                    if (profile.xpTotal > 0) {
                        LevelProgressBar(
                            level = profile.level,
                            xpTotal = profile.xpTotal,
                            streakDays = profile.streakDays,
                            maxStreak = profile.maxStreak,
                            badgeCount = profile.badges.count { it.isUnlocked }
                        )
                        Spacer(Modifier.height(8.dp))
                    }

                    // Stats row
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        StatCell("Followers", profile.followerCount.toString())
                        StatCell("Following", profile.followingCount.toString())
                        StatCell("Collections", profile.collectionsCount.toString())
                    }

                    if (profile.createdAt.isNotBlank()) {
                        val joined = profile.createdAt.take(10)
                        Spacer(Modifier.height(8.dp))
                        Text("Joined $joined", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
                    }

                    // Badges
                    if (profile.badges.isNotEmpty()) {
                        Spacer(Modifier.height(12.dp))
                        HorizontalDivider()
                        Spacer(Modifier.height(8.dp))
                        Text("Badges (${profile.badges.count { it.isUnlocked }})", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(4.dp))
                        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            profile.badges.filter { it.isUnlocked }.take(12).forEach { badge ->
                                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(4.dp)) {
                                    Text(badge.icon, fontSize = 24.sp)
                                    Text(badge.name, fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                                }
                            }
                        }
                    }

                    // Collections
                    if (profile.collections.isNotEmpty()) {
                        Spacer(Modifier.height(12.dp))
                        HorizontalDivider()
                        Spacer(Modifier.height(8.dp))
                        Text("Collections", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                        profile.collections.forEach { col ->
                            Row(
                                Modifier.fillMaxWidth().clickable { onNavigateToUrl("https://roamtheweb.app/collections/${col.slug}") }.padding(vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(col.name, style = MaterialTheme.typography.bodyMedium)
                                Text("${col.itemCount} items", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun StatCell(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}