package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.roam.android.model.CategoryItem
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.Gold
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Panel2

/**
 * Diegetic congratulations shown when the operator upvotes a page the catalog
 * doesn't know yet. ROAM-OS speaks in its terminal register; Roam Classic gets
 * the plainer web-app voice.
 */
@Composable
private fun SubmitSignalNotice(isClassic: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Panel2)
            .border(1.dp, if (isClassic) LineColor else Gold, RoundedCornerShape(8.dp))
            .padding(12.dp),
    ) {
        Text(
            text = if (isClassic) "New signal" else "// uncharted signal",
            style = MaterialTheme.typography.labelSmall,
            color = Fog,
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = "SIGNAL FOUND",
            style = MaterialTheme.typography.labelLarge,
            color = if (isClassic) Bone else Gold,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = if (isClassic) {
                "Nobody has logged this page before. Good find, wanderer — add it and it's here for everyone who comes after you."
            } else {
                "This page isn't in ~/roam yet. You found it first — log it and every wanderer after you gets it too."
            },
            style = MaterialTheme.typography.bodySmall,
            color = if (isClassic) Fog else Bone,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SubmitBottomSheet(
    url: String?,
    categories: List<CategoryItem>,
    onSubmit: (url: String, categoryId: String) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    signalFound: Boolean = false,
    isClassic: Boolean = false,
) {
    var urlText by remember { mutableStateOf(url ?: "") }
    var selectedId by remember { mutableStateOf<String?>(null) }

    RoamOsWindow(title = "SUBMIT", onClose = onDismiss, modifier = modifier) {
        Column(Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(12.dp),
            ) {
                if (signalFound) {
                    SubmitSignalNotice(isClassic = isClassic)
                    Spacer(modifier = Modifier.height(12.dp))
                }
                Text(
                    text = "// push a new page to the network",
                    style = MaterialTheme.typography.labelSmall,
                    color = Fog,
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = urlText,
                    onValueChange = { urlText = it },
                    label = { Text("URL") },
                    placeholder = { Text("https://example.com/article") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Pick a category",
                    style = MaterialTheme.typography.labelMedium,
                    // Fixed palette, not colorScheme: the window chrome above is a
                    // hardcoded dark panel in both shells, so onSurface would go
                    // near-black under Roam Classic's light scheme.
                    color = Fog,
                )
                Spacer(modifier = Modifier.height(8.dp))

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    categories.forEach { cat ->
                        FilterChip(
                            selected = selectedId == cat.id,
                            onClick = { selectedId = if (selectedId == cat.id) null else cat.id },
                            label = { CategoryIconLabel(cat.icon, cat.name) },
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = { selectedId?.let { onSubmit(urlText.trim(), it) } },
                    enabled = selectedId != null && urlText.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Submit")
                }
            }
            Box(Modifier.fillMaxWidth().height(1.dp).background(LineColor))
            Text(
                "queue: mod · payload: pending",
                style = MaterialTheme.typography.labelSmall,
                color = Fog,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
    }
}


@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SubmitBottomSheet(
    url: String?,
    categories: List<CategoryItem>,
    onSubmit: (categoryId: String) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var selectedId by remember { mutableStateOf<String?>(null) }

    RoamOsWindow(title = "SUBMIT", onClose = onDismiss, modifier = modifier) {
        Column(Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(12.dp),
            ) {
                Text(
                    text = "// push this page to the network",
                    style = MaterialTheme.typography.labelSmall,
                    color = Fog,
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
                    categories.forEach { cat ->
                        FilterChip(
                            selected = selectedId == cat.id,
                            onClick = { selectedId = if (selectedId == cat.id) null else cat.id },
                            label = { CategoryIconLabel(cat.icon, cat.name) },
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
            Box(Modifier.fillMaxWidth().height(1.dp).background(LineColor))
            Text(
                "queue: mod · payload: 1 page",
                style = MaterialTheme.typography.labelSmall,
                color = Fog,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
    }
}
