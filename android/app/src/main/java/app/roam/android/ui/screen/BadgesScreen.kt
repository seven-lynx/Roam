package app.roam.android.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.model.Badge
import app.roam.android.model.TierInfo
import app.roam.android.ui.component.BadgeDetailDialog
import app.roam.android.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun BadgesScreen(
    vm: MainViewModel,
    onNavigateBack: () -> Unit = {},
) {
    val badges by vm.badges.collectAsState()
    val badgesLoading by vm.badgesLoading.collectAsState()
    val badgesError by vm.badgesError.collectAsState()

    LaunchedEffect(Unit) { vm.loadBadges() }

    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var showUnlockedOnly by remember { mutableStateOf(false) }

    val filtered = badges.filter { b ->
        (selectedCategory == null || b.category == selectedCategory) &&
        (!showUnlockedOnly || b.isUnlocked)
    }

    val unlockedCount = badges.count { it.isUnlocked }

    var selectedBadge by remember { mutableStateOf<Badge?>(null) }
    selectedBadge?.let { badge ->
        BadgeDetailDialog(badge = badge, onDismiss = { selectedBadge = null })
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Badges ($unlockedCount unlocked)") },
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
                .navigationBarsPadding()
                .padding(horizontal = 16.dp),
        ) {
            // Filters
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                TierInfo.categoryLabels.entries.take(8).forEach { (key, label) ->
                    FilterChip(
                        selected = selectedCategory == key,
                        onClick = { selectedCategory = if (selectedCategory == key) null else key },
                        label = { Text(label, fontSize = 12.sp) },
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            FilterChip(
                selected = showUnlockedOnly,
                onClick = { showUnlockedOnly = !showUnlockedOnly },
                label = { Text("Unlocked only", fontSize = 12.sp) },
            )

            Spacer(Modifier.height(12.dp))

            // Content
            if (badgesLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Loading...",
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    )
                }
            } else if (badgesError != null) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = badgesError ?: "Failed to load badges",
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            } else if (filtered.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("\uD83C\uDFC5", fontSize = 48.sp)
                        Text(
                            text = "No badges match your filters",
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        )
                    }
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    contentPadding = PaddingValues(bottom = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(filtered) { badge ->
                        BadgeGridItem(badge = badge, onClick = { selectedBadge = badge })
                    }
                }
            }
        }
    }
}

@Composable
fun BadgeGridItem(badge: Badge, onClick: () -> Unit = {}) {
    val progressPercent = if (badge.requiredCount != null && badge.requiredCount > 0) {
        ((badge.progressCurrent.toFloat() / badge.requiredCount) * 100).toInt().coerceIn(0, 100)
    } else if (badge.progressCurrent > 0) 100 else 0

    val containerColor = if (badge.isUnlocked) {
        when (badge.tier) {
            4 -> Color(0xFFE0F7FA) // platinum
            3 -> Color(0xFFFFF9C4) // gold
            2 -> Color(0xFFF5F5F5) // silver
            1 -> Color(0xFFFFF3E0) // bronze
            5 -> Color(0xFFF3E5F5) // legendary
            else -> Color(0xFFF8F9FA)
        }
    } else {
        Color(0xFFF1F3F5).copy(alpha = 0.7f)
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = containerColor),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = if (badge.isUnlocked) 1.dp else 0.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onClick() }
                .padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = if (badge.isHidden && !badge.isUnlocked) "\u2753" else badge.icon,
                fontSize = 24.sp,
            )
            Text(
                text = if (badge.isHidden && !badge.isUnlocked) "???"
                    else badge.name,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 4.dp),
            )

            if (!badge.isUnlocked && badge.requiredCount != null) {
                Spacer(Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { progressPercent / 100f },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp)),
                    color = Color(0xFF3B82F6),
                    trackColor = Color(0xFFE5E7EB),
                )
                Text(
                    text = "${badge.progressCurrent}/${badge.requiredCount}",
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                )
            }
        }
    }
}