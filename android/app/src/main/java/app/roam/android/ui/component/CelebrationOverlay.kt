package app.roam.android.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.model.CelebrationEvent
import app.roam.android.model.LevelSystem
import kotlin.math.sin
import kotlin.random.Random
import kotlinx.coroutines.delay

/**
 * Full-screen celebration overlay for gamification moments (badge unlocked,
 * level up, challenge complete). Rendered at the top level of MainScreen so it
 * overlays every tab.
 *
 * Auto-dismisses after a few seconds; tapping anywhere dismisses immediately.
 */
@Composable
fun CelebrationOverlay(
    event: CelebrationEvent,
    onDismiss: () -> Unit,
) {
    val colors = celebrationColors(event)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.72f))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            ) { onDismiss() },
        contentAlignment = Alignment.Center,
    ) {
        key(event) {
            var visible by remember { mutableStateOf(false) }
            LaunchedEffect(Unit) {
                visible = true
                delay(3_200)
                onDismiss()
            }

            Confetti(colors = colors, modifier = Modifier.fillMaxSize())

            AnimatedVisibility(
                visible = visible,
                enter = fadeIn(tween(180)) + scaleIn(
                    initialScale = 0.5f,
                    animationSpec = spring(
                        dampingRatio = Spring.DampingRatioMediumBouncy,
                        stiffness = Spring.StiffnessMediumLow,
                    ),
                ),
            ) {
                CelebrationCard(event = event, accent = colors)
            }
        }
    }
}
@Composable
private fun CelebrationCard(event: CelebrationEvent, accent: List<Color>) {
    val gradient = accent.ifEmpty { listOf(Color(0xFF7C3AED), Color(0xFF2563EB)) }
    Surface(
        shape = RoundedCornerShape(28.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 8.dp,
        modifier = Modifier.padding(horizontal = 40.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 28.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            when (event) {
                is CelebrationEvent.BadgeUnlocked -> {
                    Text(text = event.badge.icon.ifBlank { "\uD83C\uDFC5" }, fontSize = 84.sp)
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = "Badge Unlocked!",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = event.badge.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    )
                    if (event.badge.xpReward > 0) {
                        Spacer(Modifier.height(12.dp))
                        XpPill("+${event.badge.xpReward} XP", gradient)
                    }
                }

                is CelebrationEvent.LevelUp -> {
                    Text(
                        text = "Level Up!",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(8.dp))
                    Box(
                        modifier = Modifier
                            .size(112.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(gradient)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = event.newLevel.toString(),
                            color = Color.White,
                            fontSize = 48.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = LevelSystem.rankTitle(event.newLevel),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                    )
                    if (event.xpTotal > 0) {
                        Spacer(Modifier.height(12.dp))
                        Text(
                            text = "%,d total XP".format(event.xpTotal),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        )
                    }
                }

                is CelebrationEvent.ChallengeComplete -> {
                    Text(text = "\u2714\uFE0F", fontSize = 84.sp)
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = "Challenge Complete!",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = event.title,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    )
                    if (event.xpReward > 0) {
                        Spacer(Modifier.height(12.dp))
                        XpPill("+${event.xpReward} XP", gradient)
                    }
                }
            }
        }
    }
}

@Composable
private fun XpPill(text: String, gradient: List<Color>) {
    Text(
        text = text,
        color = Color.White,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(Brush.linearGradient(gradient))
            .padding(horizontal = 16.dp, vertical = 6.dp),
    )
}

private fun celebrationColors(event: CelebrationEvent): List<Color> = when (event) {
    is CelebrationEvent.BadgeUnlocked -> listOf(Color(0xFF7C3AED), Color(0xFF2563EB), Color(0xFFFBBF24))
    is CelebrationEvent.LevelUp -> listOf(Color(0xFF22C55E), Color(0xFF3B82F6), Color(0xFFFBBF24))
    is CelebrationEvent.ChallengeComplete -> listOf(Color(0xFFF97316), Color(0xFFFBBF24), Color(0xFF22C55E))
}
private class ConfettiParticle(
    val startX: Float,
    val size: Float,
    val color: Color,
    val spin: Float,
    val delay: Float,
)

@Composable
private fun Confetti(
    colors: List<Color>,
    modifier: Modifier = Modifier,
) {
    val particles = remember {
        val rnd = Random(System.currentTimeMillis())
        List(90) {
            ConfettiParticle(
                startX = rnd.nextFloat(),
                size = 6f + rnd.nextFloat() * 9f,
                color = colors[rnd.nextInt(colors.size)],
                spin = rnd.nextFloat() * 360f,
                delay = rnd.nextFloat() * 0.25f,
            )
        }
    }
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        progress.animateTo(1f, tween(durationMillis = 1_500, easing = LinearEasing))
    }

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        particles.forEach { p ->
            val t = ((progress.value - p.delay) / (1f - p.delay)).coerceIn(0f, 1f)
            if (t <= 0f) return@forEach
            val sway = (sin(p.spin + t * 6.0) * 30.0).toFloat()
            val x = p.startX * w + sway
            val y = -24f + t * (h + 48f)
            val alpha = (1f - t).coerceIn(0f, 1f)
            drawCircle(
                color = p.color.copy(alpha = alpha),
                radius = p.size,
                center = Offset(x, y),
            )
        }
    }
}


