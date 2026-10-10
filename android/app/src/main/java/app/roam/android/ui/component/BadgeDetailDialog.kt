package app.roam.android.ui.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import app.roam.android.model.Badge
import app.roam.android.model.TierInfo

@Composable
fun BadgeDetailDialog(
    badge: Badge,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Icon — large
                Text(
                    text = if (badge.isHidden && !badge.isUnlocked) "❓" else badge.icon,
                    fontSize = 48.sp,
                )

                Spacer(Modifier.height(8.dp))

                // Name
                Text(
                    text = if (badge.isHidden && !badge.isUnlocked) "???" else badge.name,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )

                Spacer(Modifier.height(4.dp))

                // Tier name (if applicable)
                if (badge.tier > 0) {
                    val tierName = TierInfo.names[badge.tier] ?: ""
                    if (tierName.isNotBlank()) {
                        Text(
                            text = tierName,
                            style = MaterialTheme.typography.labelLarge,
                            color = tierColor(badge.tier),
                        )
                        Spacer(Modifier.height(4.dp))
                    }
                }

                Spacer(Modifier.height(4.dp))
                HorizontalDivider()
                Spacer(Modifier.height(8.dp))

                // Description — shows how to unlock or what it means
                Text(
                    text = "How to unlock",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = badge.description.ifBlank { "Keep using Roam to unlock this badge." },
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.9f),
                )

                Spacer(Modifier.height(12.dp))

                // Progress bar (if not unlocked and has a target)
                if (!badge.isUnlocked && badge.requiredCount != null && badge.requiredCount > 0) {
                    val progressPercent = ((badge.progressCurrent.toFloat() / badge.requiredCount) * 100)
                        .toInt().coerceIn(0, 100)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                    ) {
                        LinearProgressIndicator(
                            progress = { progressPercent / 100f },
                            modifier = Modifier
                                .weight(1f)
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = Color(0xFF3B82F6),
                            trackColor = Color(0xFFE5E7EB),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "${badge.progressCurrent}/${badge.requiredCount}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        )
                    }
                }

                // Unlock date
                if (badge.isUnlocked && badge.unlockedAt != null) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "Unlocked ${badge.unlockedAt.take(10)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    )
                }

                // Hidden badge hint
                if (badge.isHidden && !badge.isUnlocked) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "This is a hidden badge. Keep exploring to reveal it!",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                        textAlign = TextAlign.Center,
                    )
                }

                // XP reward
                if (badge.xpReward > 0) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "Reward: +${badge.xpReward} XP",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF7C3AED),
                        fontWeight = FontWeight.Medium,
                    )
                }

                Spacer(Modifier.height(16.dp))

                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                    ),
                ) {
                    Text("Close")
                }
            }
        }
    }
}

@Composable
private fun tierColor(tier: Int): Color = when (tier) {
    1 -> Color(0xFFB87333)  // Bronze
    2 -> Color(0xFF8B8B8B)  // Silver
    3 -> Color(0xFFFFB300)  // Gold
    4 -> Color(0xFF8EC8E8)  // Platinum
    5 -> Color(0xFFB8860B)  // Legendary
    else -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
}