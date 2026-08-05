package app.roam.android.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.model.ChallengeData
import app.roam.android.viewmodel.MainViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChallengesScreen(
    vm: MainViewModel,
    onNavigateBack: () -> Unit = {}
) {
    val challenges by vm.challenges.collectAsState()
    val challengesLoading by vm.challengesLoading.collectAsState()
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        scope.launch { vm.loadChallenges() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Challenges") },
                navigationIcon = {
                    TextButton(onClick = onNavigateBack) {
                        Text("Back", color = MaterialTheme.colorScheme.primary)
                    }
                }
            )
        }
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = challengesLoading,
            onRefresh = { scope.launch { vm.loadChallenges() } },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (challenges.isEmpty() && !challengesLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "No active challenges. Come back later!",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                val dailies = challenges.filter { it.challenge.type == "daily" }
                val weeklies = challenges.filter { it.challenge.type == "weekly" }
                val monthlies = challenges.filter { it.challenge.type == "monthly" }

                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (dailies.isNotEmpty()) {
                        item { SectionHeader("Daily") }
                        items(dailies) { challenge -> ChallengeCard(challenge) }
                    }
                    if (weeklies.isNotEmpty()) {
                        item { SectionHeader("Weekly") }
                        items(weeklies) { challenge -> ChallengeCard(challenge) }
                    }
                    if (monthlies.isNotEmpty()) {
                        item { SectionHeader("Monthly") }
                        items(monthlies) { challenge -> ChallengeCard(challenge) }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        fontSize = 14.sp,
        fontWeight = FontWeight.Medium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
    )
}

@Composable
private fun ChallengeCard(challenge: ChallengeData) {
    val progress = if (challenge.challenge.goalCount > 0) {
        (challenge.progressCurrent.toFloat() / challenge.challenge.goalCount.toFloat()).coerceIn(0f, 1f)
    } else 0f
    val isCompleted = challenge.completedAt != null
    val typeColor = when (challenge.challenge.type) {
        "daily" -> Color(0xFF3B82F6)
        "weekly" -> Color(0xFFA855F7)
        "monthly" -> Color(0xFFD97706)
        else -> Color(0xFF6B7280)
    }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isCompleted)
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            else
                MaterialTheme.colorScheme.surface
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = challenge.challenge.type.uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = typeColor
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = challenge.challenge.title,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                if (isCompleted) {
                    Text(
                        text = "✓",
                        fontSize = 20.sp,
                        color = Color(0xFF22C55E)
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = challenge.challenge.goalDescription,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Progress bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${challenge.progressCurrent} / ${challenge.challenge.goalCount}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "+${challenge.challenge.xpReward} XP",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp),
                color = if (isCompleted) Color(0xFF22C55E) else typeColor,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
        }
    }
}