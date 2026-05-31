package app.roam.android.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.roam.android.viewmodel.MainViewModel

/**
 * Shown once, immediately after a new user completes OAuth.
 *
 * The user picks ≥ 1 interest category (or specific topics), then taps "Start Roaming".
 * Tapping "Skip" goes straight to Discover without saving any categories.
 * [onComplete] transitions [AuthViewModel] to [AuthState.Authenticated].
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CategoryOnboardingScreen(
    vm: MainViewModel,
    onComplete: () -> Unit,
) {
    val categories by vm.categories.collectAsState()
    val subcategories by vm.subcategories.collectAsState()
    val selectedPillars by vm.userCategoryIds.collectAsState()
    val selectedTopics by vm.userTopicIds.collectAsState()
    val interestMode by vm.interestMode.collectAsState()

    val hasSelection = if (interestMode == "pillars") selectedPillars.isNotEmpty()
                       else selectedTopics.isNotEmpty()

    // Group subcategories by category for topic mode
    val subcatsByCategory = subcategories.groupBy { it.categoryId }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item {
            Spacer(Modifier.height(40.dp))
            Text(
                text = "What are you into?",
                style = MaterialTheme.typography.headlineMedium,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Pick interests to personalise your discoveries. You can change these anytime in Profile.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f),
            )
            Spacer(Modifier.height(24.dp))
        }

        if (interestMode == "pillars") {
            item {
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    categories.forEach { category ->
                        val selected = category.id in selectedPillars
                        FilterChip(
                            selected = selected,
                            onClick = { vm.toggleCategory(category.id, !selected) },
                            label = { Text("${category.icon}  ${category.name}") },
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                if (subcategories.isNotEmpty()) {
                    TextButton(
                        onClick = { vm.setInterestMode("topics") },
                        modifier = Modifier.wrapContentWidth(Alignment.Start),
                    ) {
                        Text("Choose specific topics instead →")
                    }
                }
                Spacer(Modifier.height(32.dp))
            }
        } else {
            item {
                TextButton(
                    onClick = { vm.setInterestMode("pillars") },
                    modifier = Modifier.wrapContentWidth(Alignment.Start),
                ) {
                    Text("← Choose categories instead")
                }
                Spacer(Modifier.height(8.dp))
            }
            items(categories) { category ->
                val subcats = subcatsByCategory[category.id] ?: emptyList()
                if (subcats.isEmpty()) return@items
                Text(
                    text = "${category.icon}  ${category.name}",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                )
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    subcats.forEach { sc ->
                        val selected = sc.id in selectedTopics
                        FilterChip(
                            selected = selected,
                            onClick = { vm.toggleTopic(sc.id, !selected) },
                            label = { Text(sc.name) },
                        )
                    }
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }
            item { Spacer(Modifier.height(16.dp)) }
        }

        item {
            Button(
                onClick = onComplete,
                enabled = hasSelection,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
            ) {
                Text("Start Roaming")
            }

            TextButton(onClick = onComplete) {
                Text(
                    "Skip for now",
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                )
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
