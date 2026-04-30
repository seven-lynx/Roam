package app.roam.android.ui.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// Fixed pillar category UUIDs — match the migration seed data exactly.
// Passed as `subcategory_id` to the submit-url Edge Function (same convention as the extension).
private data class Category(val label: String, val id: String)

private val CATEGORIES = listOf(
    Category("🔬 Science",           "c1000000-0000-0000-0000-000000000001"),
    Category("💻 Technology",        "c1000000-0000-0000-0000-000000000002"),
    Category("🎨 Arts & Culture",    "c1000000-0000-0000-0000-000000000003"),
    Category("📜 History & Ideas",   "c1000000-0000-0000-0000-000000000004"),
    Category("🎮 Games & Hobbies",   "c1000000-0000-0000-0000-000000000005"),
    Category("🌀 Weird & Wonderful", "c1000000-0000-0000-0000-000000000006"),
    Category("🌍 People & Places",   "c1000000-0000-0000-0000-000000000007"),
    Category("🧠 Mind & Body",       "c1000000-0000-0000-0000-000000000008"),
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SubmitBottomSheet(
    url: String?,
    onSubmit: (categoryId: String) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedId by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .padding(bottom = 16.dp),
        ) {
            Text(
                text = "Submit this page",
                style = MaterialTheme.typography.titleMedium,
            )
            url?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    maxLines = 2,
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Pick a category",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
            )
            Spacer(modifier = Modifier.height(8.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                CATEGORIES.forEach { cat ->
                    FilterChip(
                        selected = selectedId == cat.id,
                        onClick = { selectedId = if (selectedId == cat.id) null else cat.id },
                        label = { Text(cat.label) },
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = { selectedId?.let { onSubmit(it) } },
                enabled = selectedId != null,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Submit")
            }
        }
    }
}

