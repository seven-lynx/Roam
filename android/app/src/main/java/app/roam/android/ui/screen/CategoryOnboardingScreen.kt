package app.roam.android.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
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
 * The user picks ≥ 1 interest category, then taps "Start Roaming".
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
    val selectedIds by vm.userCategoryIds.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(40.dp))

        Text(
            text = "What are you into?",
            style = MaterialTheme.typography.headlineMedium,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Pick a few topics to personalise your discoveries. You can change these anytime in Profile.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f),
        )

        Spacer(Modifier.height(32.dp))

        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            categories.forEach { category ->
                val selected = category.id in selectedIds
                FilterChip(
                    selected = selected,
                    onClick = { vm.toggleCategory(category.id, !selected) },
                    label = {
                        Text("${category.icon}  ${category.name}")
                    },
                )
            }
        }

        Spacer(Modifier.height(40.dp))

        Button(
            onClick = onComplete,
            enabled = selectedIds.isNotEmpty(),
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
