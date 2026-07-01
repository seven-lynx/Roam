package app.roam.android.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.CollectionsBookmark
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

private data class WalkthroughStep(
    val icon: ImageVector,
    val title: String,
    val description: String,
)

private val WALKTHROUGH_STEPS = listOf(
    WalkthroughStep(
        icon = Icons.Filled.Explore,
        title = "Discover the web",
        description = "Tap Roam to discover a new page from across the internet, hand-picked for you.",
    ),
    WalkthroughStep(
        icon = Icons.Filled.ThumbUp,
        title = "Rate what you find",
        description = "Thumbs up pages you love, thumbs down the ones you don't. Your ratings shape the community.",
    ),
    WalkthroughStep(
        icon = Icons.Filled.BookmarkBorder,
        title = "Save for later",
        description = "Bookmark any page to read later. Your saved pages sync across the web app and this app.",
    ),
    WalkthroughStep(
        icon = Icons.Filled.CollectionsBookmark,
        title = "Build collections",
        description = "Organize your favorite finds into collections and share them with the Roam community.",
    ),
)

@Composable
fun FeatureWalkthrough(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var currentStep by remember { mutableIntStateOf(0) }
    val step = WALKTHROUGH_STEPS[currentStep]
    val isLastStep = currentStep == WALKTHROUGH_STEPS.lastIndex

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background.copy(alpha = 0.97f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Skip button in top-right corner
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                if (!isLastStep) {
                    TextButton(onClick = onDismiss) {
                        Text("Skip")
                    }
                }
            }

            Spacer(Modifier.height(32.dp))

            // Step indicator dots
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                WALKTHROUGH_STEPS.indices.forEach { index ->
                    Box(
                        modifier = Modifier
                            .size(if (index == currentStep) 10.dp else 8.dp)
                            .clip(CircleShape)
                            .background(
                                if (index == currentStep) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
                            ),
                    )
                }
            }

            Spacer(Modifier.height(48.dp))

            // Step icon
            Card(
                modifier = Modifier.size(96.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                ),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = step.icon,
                        contentDescription = step.title,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }

            Spacer(Modifier.height(32.dp))

            // Step title
            Text(
                text = step.title,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(16.dp))

            // Step description
            Text(
                text = step.description,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(48.dp))

            // Navigation buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (currentStep > 0) {
                    OutlinedButton(
                        onClick = { currentStep-- },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Back")
                    }
                }
                Button(
                    onClick = {
                        if (isLastStep) onDismiss()
                        else currentStep++
                    },
                    modifier = Modifier.weight(1f),
                ) {
                    Text(if (isLastStep) "Get Started" else "Next")
                }
            }
        }
    }
}