package app.roam.android.ui.component

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Shader
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.R
import app.roam.android.ui.theme.Abyss
import app.roam.android.ui.theme.Brass
import app.roam.android.ui.theme.Danger
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.GoldBright
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Ok
import app.roam.android.ui.theme.Oxide2
import app.roam.android.ui.theme.Oxide3
import app.roam.android.ui.theme.SevenSegment
import app.roam.android.ui.theme.TealBright
import kotlin.random.Random

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
    onOpenComms: () -> Unit,
    onFeedback: (Int) -> Unit,
    deckLayout: String = "trapezoid",
    deckSize: String = "medium",
    deckShape: String = "round",
    deckLabels: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Oxide3, Abyss)))
            .drawBehind { drawRect(deckNoiseShader, alpha = 0.05f) }
            .navigationBarsPadding(),
    ) {

        StatusLine(
            isOnline = isOnline,
            hotQueueSize = hotQueueSize,
            warmQueueSize = warmQueueSize,
            xpFlash = xpFlash,
            unreadNotificationCount = unreadNotificationCount,
            onOpenComms = onOpenComms,
            onFeedback = onFeedback,
        )

        // Palm Pilot–style key deck: Roam in the centre, trapezoid symmetrical side keys.
        KeyDeck(
            deckLayout = deckLayout,
            deckSize = deckSize,
            deckShape = deckShape,
            deckLabels = deckLabels,
            currentRoute = currentRoute,
            focusModeEnabled = focusModeEnabled,
            hasRatedUp = hasRatedUp,
            onRoam = onRoam,
            onThumbsUp = onThumbsUp,
            onThumbsDown = onThumbsDown,
            onOpenMenu = onOpenMenu,
            onNavigate = onNavigate,
            onFeedback = onFeedback,
        )
    }
}

@Composable
private fun StatusLine(
    isOnline: Boolean,
    hotQueueSize: Int,
    warmQueueSize: Int,
    xpFlash: Int?,
    unreadNotificationCount: Int,
    onOpenComms: () -> Unit,
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
        Box(
            Modifier
                .weight(1f)
                .clip(RoundedCornerShape(4.dp))
                .background(Color.Black.copy(alpha = 0.55f))
                .border(1.dp, LineColor, RoundedCornerShape(4.dp))
                .padding(horizontal = 8.dp, vertical = 2.dp),
        ) {
            Text(
                readout,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontFamily = SevenSegment,
                    letterSpacing = 1.5.sp,
                    color = ledColor,
                    shadow = Shadow(color = ledColor.copy(alpha = 0.85f), offset = Offset.Zero, blurRadius = 9f),
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (xpFlash != null) {
            Text(
                "+$xpFlash XP",
                style = MaterialTheme.typography.labelMedium,
                color = GoldBright,
                modifier = Modifier.padding(start = 8.dp),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(start = 10.dp),
        ) {
            Box(
                Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(if (unreadNotificationCount > 0) Danger else LineColor.copy(alpha = 0.4f)),
            )
            DeckKey(
                onClick = onOpenComms,
                soundRes = R.raw.click,
                onFeedback = onFeedback,
                size = 28.dp,
                icon = RoamOsIcons.Comms,
                tint = Fog,
                description = "Comms",
                modifier = Modifier.padding(start = 6.dp),
            )
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
    square: Boolean = false,
    showLabel: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.9f else 1f, label = "deck-key-scale")
    val density = LocalDensity.current
    val dropPx = with(density) { 2.dp.toPx() }
    val radiusPx = with(density) { size.toPx() * 1.6f }
    val shape = if (square) RoundedCornerShape(8.dp) else CircleShape

    val top = if (pressed) Oxide2 else if (hero) GoldBright else Oxide3
    val bottom = if (pressed) Abyss else if (hero) Brass else Oxide2

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier,
    ) {
        Box(
            modifier = Modifier
                .size(size)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    translationY = if (pressed) dropPx else 0f
                }
                .shadow(if (pressed) 1.dp else 5.dp, shape)
                .clip(shape)
                .background(Brush.radialGradient(listOf(top, bottom), center = Offset(0.3f, 0.25f), radius = radiusPx))
                .drawBehind { drawRect(deckNoiseShader, alpha = 0.06f) }
                .border(1.dp, if (hero) Brass else LineColor, shape)
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
                modifier = Modifier.size(if (hero) size * 0.5f else size * 0.55f),
            )
        }
        if (showLabel) {
            Text(
                text = description,
                color = tint.copy(alpha = 0.85f),
                fontSize = 9.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private data class DeckSizes(val roam: Dp, val side: Dp)

private fun deckSizes(sizeKey: String): DeckSizes = when (sizeKey) {
    "large" -> DeckSizes(56.dp, 46.dp)
    "small" -> DeckSizes(42.dp, 34.dp)
    else -> DeckSizes(48.dp, 40.dp)
}

@Composable
private fun KeyDeck(
    deckLayout: String,
    deckSize: String,
    deckShape: String,
    deckLabels: Boolean,
    currentRoute: String,
    focusModeEnabled: Boolean,
    hasRatedUp: Boolean,
    onRoam: () -> Unit,
    onThumbsUp: () -> Unit,
    onThumbsDown: () -> Unit,
    onOpenMenu: () -> Unit,
    onNavigate: (String) -> Unit,
    onFeedback: (Int) -> Unit,
) {
    val sizes = deckSizes(deckSize)
    val square = deckShape == "square"
    val dislikeTint = MaterialTheme.colorScheme.onSurfaceVariant
    val likeTint = if (hasRatedUp) Ok else MaterialTheme.colorScheme.onSurfaceVariant
    val roamTint = if (focusModeEnabled) MaterialTheme.colorScheme.tertiary else GoldBright
    val settingsTint = if (currentRoute == RoamTab.SettingsHub.route) TealBright else Fog

    val dislikeKey: @Composable (Modifier) -> Unit = { mod ->
        DeckKey(onThumbsDown, R.raw.skip, onFeedback, sizes.side, RoamOsIcons.Dislike, dislikeTint, "Dislike", square = square, showLabel = deckLabels, modifier = mod)
    }
    val likeKey: @Composable (Modifier) -> Unit = { mod ->
        DeckKey(onThumbsUp, R.raw.like, onFeedback, sizes.side, RoamOsIcons.Like, likeTint, "Like", square = square, showLabel = deckLabels, modifier = mod)
    }
    val roamKey: @Composable (Modifier) -> Unit = { mod ->
        DeckKey(
            { if (currentRoute == RoamTab.Roam.route) onRoam() else onNavigate(RoamTab.Roam.route) },
            R.raw.click_heavy, onFeedback, sizes.roam, RoamOsIcons.Roam, roamTint, "Roam", hero = true, showLabel = deckLabels, modifier = mod,
        )
    }
    val menuKey: @Composable (Modifier) -> Unit = { mod ->
        DeckKey(onOpenMenu, R.raw.click, onFeedback, sizes.side, RoamOsIcons.Menu, Fog, "Menu", square = square, showLabel = deckLabels, modifier = mod)
    }
    val settingsKey: @Composable (Modifier) -> Unit = { mod ->
        DeckKey(
            { if (currentRoute == RoamTab.Roam.route) onNavigate(RoamTab.SettingsHub.route) else onNavigate(RoamTab.Roam.route) },
            R.raw.click, onFeedback, sizes.side, RoamOsIcons.Settings, settingsTint, "Settings", square = square, showLabel = deckLabels, modifier = mod,
        )
    }

    when (deckLayout) {
        "line" -> Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            dislikeKey(Modifier); menuKey(Modifier); roamKey(Modifier); settingsKey(Modifier); likeKey(Modifier)
        }
        "grid" -> Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                dislikeKey(Modifier)
                menuKey(Modifier)
            }
            roamKey(Modifier)
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                likeKey(Modifier)
                settingsKey(Modifier)
            }
        }
        "trapezoid_inverted" -> TrapezoidDeck(
            sizes, inverted = true, deckLabels = deckLabels, dislikeKey, likeKey, roamKey, menuKey, settingsKey,
        )
        else -> TrapezoidDeck(  // "trapezoid" + legacy "diagonal"
            sizes, inverted = false, deckLabels = deckLabels, dislikeKey, likeKey, roamKey, menuKey, settingsKey,
        )
    }
}

@Composable
private fun TrapezoidDeck(
    sizes: DeckSizes,
    inverted: Boolean,
    deckLabels: Boolean,
    dislikeKey: @Composable (Modifier) -> Unit,
    likeKey: @Composable (Modifier) -> Unit,
    roamKey: @Composable (Modifier) -> Unit,
    menuKey: @Composable (Modifier) -> Unit,
    settingsKey: @Composable (Modifier) -> Unit,
) {
    // Shift one pair of side keys inward so the deck reads as a trapezoid:
    // inverted = narrow top / wide bottom; standard = wide top / narrow bottom.
    val inset = sizes.side * 0.55f
    val topInset = if (inverted) inset else 0.dp
    val bottomInset = if (inverted) 0.dp else inset
    val labelSpace = if (deckLabels) 16.dp else 0.dp
    Box(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .width(sizes.roam + sizes.side * 2 + 24.dp)
                .height(sizes.roam + sizes.side * 2 + 24.dp + labelSpace),
        ) {
            dislikeKey(Modifier.align(Alignment.TopStart).offset(x = topInset))
            likeKey(Modifier.align(Alignment.TopEnd).offset(x = -topInset))
            roamKey(Modifier.align(Alignment.Center))
            menuKey(Modifier.align(Alignment.BottomStart).offset(x = bottomInset))
            settingsKey(Modifier.align(Alignment.BottomEnd).offset(x = -bottomInset))
        }
    }
}

private val deckNoiseShader by lazy {
    ShaderBrush(BitmapShader(createDeckNoiseBitmap(), Shader.TileMode.REPEAT, Shader.TileMode.REPEAT))
}

private fun createDeckNoiseBitmap(): Bitmap {
    val size = 128
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val pixels = IntArray(size * size)
    val rng = Random(7)
    for (i in pixels.indices) {
        val v = rng.nextInt(256)
        pixels[i] = (0xFF shl 24) or (v shl 16) or (v shl 8) or v
    }
    bmp.setPixels(pixels, 0, size, 0, 0, size, size)
    return bmp
}



