package app.roam.android.ui.component

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.roam.android.R
import app.roam.android.ui.theme.Abyss
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Brass
import app.roam.android.ui.theme.Danger
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.GoldBright
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Ok
import app.roam.android.ui.theme.Oxide2
import app.roam.android.ui.theme.Oxide3
import app.roam.android.ui.theme.TealBright

@Composable
fun ControlDeck(
    currentRoute: String,
    isOnline: Boolean,
    hotQueueSize: Int,
    warmQueueSize: Int,
    unreadNotificationCount: Int,
    xpFlash: Int?,
    focusModeEnabled: Boolean,
    hasRatedUp: Boolean,
    onRoam: () -> Unit,
    onThumbsUp: () -> Unit,
    onThumbsDown: () -> Unit,
    onNavigate: (String) -> Unit,
    onOpenMenu: () -> Unit,
    onOpenNotifications: () -> Unit,
    onFeedback: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Oxide3, Abyss)))
            .navigationBarsPadding(),
    ) {
        StatusLine(
            isOnline = isOnline,
            hotQueueSize = hotQueueSize,
            warmQueueSize = warmQueueSize,
            xpFlash = xpFlash,
            unreadNotificationCount = unreadNotificationCount,
            onOpenNotifications = onOpenNotifications,
            onFeedback = onFeedback,
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 16.dp, top = 2.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                DeckKey(
                    onClick = onThumbsDown, soundRes = R.raw.skip, onFeedback = onFeedback,
                    size = 42.dp, icon = Icons.Filled.ThumbDown,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant, description = "Skip",
                )
                DeckKey(
                    onClick = { onNavigate(RoamTab.You.route) }, soundRes = R.raw.click,
                    onFeedback = onFeedback, size = 32.dp, icon = Icons.Filled.Person,
                    tint = if (currentRoute == RoamTab.You.route) TealBright else Fog,
                    description = "You",
                )
            }

            DeckKey(
                onClick = {
                    if (currentRoute == RoamTab.Roam.route) onRoam() else onNavigate(RoamTab.Roam.route)
                },
                soundRes = R.raw.click, onFeedback = onFeedback, size = 64.dp,
                icon = Icons.Filled.Explore, hero = true,
                tint = if (focusModeEnabled) MaterialTheme.colorScheme.tertiary else GoldBright,
                description = "Roam",
            )

            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                DeckKey(
                    onClick = onThumbsUp, soundRes = R.raw.like, onFeedback = onFeedback,
                    size = 42.dp, icon = Icons.Filled.ThumbUp,
                    tint = if (hasRatedUp) Ok else MaterialTheme.colorScheme.onSurfaceVariant,
                    description = "Like",
                )
                DeckKey(
                    onClick = onOpenMenu, soundRes = R.raw.click, onFeedback = onFeedback,
                    size = 32.dp, icon = Icons.Filled.Menu, tint = Fog, description = "Menu",
                )
            }
        }
    }
}

@Composable
private fun StatusLine(
    isOnline: Boolean,
    hotQueueSize: Int,
    warmQueueSize: Int,
    xpFlash: Int?,
    unreadNotificationCount: Int,
    onOpenNotifications: () -> Unit,
    onFeedback: (Int) -> Unit,
) {
    val transition = rememberInfiniteTransition(label = "deck-led")
    val ledAlpha by transition.animateFloat(
        initialValue = 0.5f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(if (isOnline) 1400 else 480, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "deck-led-alpha",
    )
    val ledColor = if (isOnline) Ok else Danger
    val readout = "READY $hotQueueSize · BUFFER $warmQueueSize · " +
        if (isOnline) "SIG LOCK" else "SIG LOST"

    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(ledColor.copy(alpha = ledAlpha)))
        Text(" ROAM-OS", style = MaterialTheme.typography.labelMedium, color = Fog)
        Text(" · ", style = MaterialTheme.typography.labelMedium, color = Fog.copy(alpha = 0.4f))
        Text(
            readout,
            style = MaterialTheme.typography.labelMedium,
            color = if (isOnline) MaterialTheme.colorScheme.onSurfaceVariant else Danger,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (xpFlash != null) {
            Text(
                "+$xpFlash XP",
                style = MaterialTheme.typography.labelMedium,
                color = GoldBright,
                modifier = Modifier.padding(start = 8.dp),
            )
        }
        Box(
            Modifier
                .padding(start = 10.dp)
                .clickable { onFeedback(R.raw.click); onOpenNotifications() },
        ) {
            Icon(Icons.Filled.Notifications, "Notifications", tint = Fog, modifier = Modifier.size(20.dp))
            if (unreadNotificationCount > 0) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 6.dp, y = (-6).dp)
                        .size(14.dp)
                        .clip(CircleShape)
                        .background(Danger),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        if (unreadNotificationCount > 9) "9+" else unreadNotificationCount.toString(),
                        style = MaterialTheme.typography.labelSmall,
                        color = Bone,
                    )
                }
            }
        }
    }
}

@Composable
private fun DeckKey(
    onClick: () -> Unit,
    soundRes: Int,
    onFeedback: (Int) -> Unit,
    size: Dp,
    icon: ImageVector,
    tint: Color,
    description: String,
    hero: Boolean = false,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.9f else 1f, label = "deck-key-scale")
    val density = LocalDensity.current
    val dropPx = with(density) { 2.dp.toPx() }

    val top = if (pressed) Oxide2 else if (hero) GoldBright else Oxide3
    val bottom = if (pressed) Abyss else if (hero) Brass else Oxide2

    Box(
        modifier = Modifier
            .size(size)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                translationY = if (pressed) dropPx else 0f
            }
            .shadow(if (pressed) 1.dp else 5.dp, CircleShape)
            .clip(CircleShape)
            .background(Brush.verticalGradient(listOf(top, bottom)))
            .border(1.dp, if (hero) Brass else LineColor, CircleShape)
            .clickable(interactionSource = interaction, indication = null) {
                onFeedback(soundRes)
                onClick()
            },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = description,
            tint = if (pressed) tint.copy(alpha = 0.75f) else tint,
            modifier = Modifier.size(if (hero) size * 0.42f else size * 0.5f),
        )
    }
}



