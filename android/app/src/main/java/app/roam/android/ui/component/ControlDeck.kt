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
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.navigationBars
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
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.R
import app.roam.android.ui.theme.Abyss
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Brass
import app.roam.android.ui.theme.Danger
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.GoldBright
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.LocalHardwarePalette
import app.roam.android.ui.theme.NeonGreen
import app.roam.android.ui.theme.Ok
import app.roam.android.ui.theme.Oxide
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
    systemMessage: String,
    unreadNotificationCount: Int,
    xpFlash: Int?,
    focusModeEnabled: Boolean,
    hasRatedUp: Boolean,
    muted: Boolean,
    menuOpen: Boolean,
    onRoam: () -> Unit,
    onThumbsUp: () -> Unit,
    onThumbsDown: () -> Unit,
    onNavigate: (String) -> Unit,
    onOpenMenu: () -> Unit,
    onOpenComms: () -> Unit,
    onToggleMute: () -> Unit,
    onFeedback: (Int) -> Unit,
    deckLayout: String = "line",
    deckSize: String = "medium",
    deckShape: String = "round",
    deckLabels: Boolean = false,
    texture: String = "plastic",
    systemMessageSpeed: Int = 5,
    systemMessageDisplay: String = "eink",
    backlightEnabled: Boolean = false,
    backlightColor: Color = Color(0xFF8FD8FF),
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val materialBrush = remember(texture) { deckTextureBrush(context, DeckTexture.fromKey(texture)) }
    val palette = LocalHardwarePalette.current
    val deckTop = lerp(Oxide3, palette.primary, 0.30f)
    val navBarBottom = with(LocalDensity.current) {
        WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding().toPx()
    }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(deckTop, Abyss)))
            .drawBehind {
                drawRect(materialBrush, alpha = 0.40f)
                drawRect(deckNoiseShader, alpha = 0.05f)
                drawRect(
                    brush = Brush.verticalGradient(
                        listOf(Color.White.copy(alpha = 0.08f), Color.Transparent, Color.Black.copy(alpha = 0.12f)),
                    ),
                )
                // Corner screws, inset to clear the mute (top-left) and comms (top-right) keys.
                val r = 3.5.dp.toPx()
                val inset = 6.dp.toPx()
                val xs = listOf(inset + r, size.width - inset - r)
                val ys = listOf(inset + r, size.height - navBarBottom - inset - r)
                for (x in xs) for (y in ys) {
                    drawCircle(Bone, radius = r, center = Offset(x, y))
                    drawCircle(Oxide, radius = r, center = Offset(x, y), style = Stroke(width = 1.dp.toPx()))
                    drawLine(Oxide, Offset(x - r * 0.55f, y), Offset(x + r * 0.55f, y), strokeWidth = 1.dp.toPx())
                }
            }
            .navigationBarsPadding(),
    ) {

        StatusLine(
            isOnline = isOnline,
            hotQueueSize = hotQueueSize,
            warmQueueSize = warmQueueSize,
            systemMessage = systemMessage,
            systemMessageSpeed = systemMessageSpeed,
            systemMessageDisplay = systemMessageDisplay,
            xpFlash = xpFlash,
            unreadNotificationCount = unreadNotificationCount,
            muted = muted,
            onToggleMute = onToggleMute,
            onOpenComms = onOpenComms,
            onFeedback = onFeedback,
        )

        // Palm Pilot–style key deck: Roam in the centre, trapezoid symmetrical side keys.
        KeyDeck(
            deckLayout = deckLayout,
            deckSize = deckSize,
            deckShape = deckShape,
            deckLabels = deckLabels,
            backlightEnabled = backlightEnabled,
            backlightColor = backlightColor,
            currentRoute = currentRoute,
            focusModeEnabled = focusModeEnabled,
            hasRatedUp = hasRatedUp,
            menuOpen = menuOpen,
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
    systemMessage: String,
    systemMessageSpeed: Int,
    systemMessageDisplay: String = "eink",
    xpFlash: Int?,
    unreadNotificationCount: Int,
    muted: Boolean,
    onToggleMute: () -> Unit,
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
    val palette = LocalHardwarePalette.current
    val ledColor = if (isOnline) palette.led else Danger

    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
            Box(
                Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(if (muted) Danger else LineColor.copy(alpha = 0.4f)),
            )
            DeckKey(
                onClick = onToggleMute,
                soundRes = R.raw.click,
                onFeedback = onFeedback,
                size = 28.dp,
                icon = if (muted) RoamOsIcons.Muted else RoamOsIcons.Unmuted,
                tint = if (muted) Danger else Fog,
                description = "Mute",
                modifier = Modifier.padding(start = 5.dp),
            )
        }
        Spacer(Modifier.width(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(ledColor.copy(alpha = ledAlpha)))
            Text(" ROAM-OS", style = MaterialTheme.typography.labelMedium, color = Fog)
        }
        Spacer(Modifier.width(8.dp))
        LedModule(hotQueueSize, "READY", ledColor)
        Spacer(Modifier.width(6.dp))
        LedModule(warmQueueSize, "BUFFER", ledColor)
        Spacer(Modifier.width(8.dp))
        SystemReadout(
            message = systemMessage,
            color = ledColor,
            speed = systemMessageSpeed,
            display = systemMessageDisplay,
            modifier = Modifier.weight(1f),
        )
        if (xpFlash != null) {
            Text(
                "+$xpFlash XP",
                style = MaterialTheme.typography.labelMedium,
                color = palette.primaryBright,
                modifier = Modifier.padding(start = 8.dp, top = 4.dp),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(start = 10.dp, top = 2.dp),
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
private fun LedModule(value: Int, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier
                .width(40.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(Color.Black.copy(alpha = 0.55f))
                .border(1.dp, LineColor, RoundedCornerShape(4.dp))
                .padding(horizontal = 4.dp, vertical = 2.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                value.toString().padStart(2, '0'),
                style = MaterialTheme.typography.labelMedium.copy(
                    fontFamily = SevenSegment,
                    letterSpacing = 1.sp,
                    color = color,
                    shadow = Shadow(color = color.copy(alpha = 0.85f), offset = Offset.Zero, blurRadius = 8f),
                ),
                maxLines = 1,
            )
        }
        Text(label, fontSize = 7.sp, color = Fog.copy(alpha = 0.75f), maxLines = 1)
    }
}

private val EInkPaper = Color(0xFF141B1D)
private val EInkInk = Bone
private val EInkFrame = Color(0xFF2A3336)

@Composable
private fun SystemReadout(message: String, color: Color, speed: Int = 5, display: String = "eink", modifier: Modifier = Modifier) {
    val eink = display == "eink"
    val textMeasurer = rememberTextMeasurer()
    val style = if (eink) {
        MaterialTheme.typography.labelMedium.copy(
            color = EInkInk,
            shadow = Shadow(color = EInkInk.copy(alpha = 0.4f), offset = Offset.Zero, blurRadius = 5f),
        )
    } else {
        MaterialTheme.typography.labelMedium.copy(
            fontFamily = SevenSegment,
            letterSpacing = 1.sp,
            color = color,
            shadow = Shadow(color = color.copy(alpha = 0.85f), offset = Offset.Zero, blurRadius = 8f),
        )
    }
    // Seamless infinite stream: repeat the tile enough times to always cover the
    // container, then scroll by one tile width for a gap-free wrap.
    val density = LocalDensity.current
    val separatorPx = with(density) { 16.dp.toPx() }
    val copyWidth = remember(message, eink) { textMeasurer.measure(AnnotatedString(message), style).size.width }
    val tileWidth = (copyWidth + separatorPx).coerceAtLeast(1f)
    var containerWidth by remember { mutableIntStateOf(0) }
    val tiles = remember(containerWidth, tileWidth) {
        if (tileWidth <= 0f) 2 else (containerWidth / tileWidth).toInt() + 2
    }
    val pxPerSec = 20f + speed.coerceIn(1, 10) * 8f
    val loopMs = (tileWidth / pxPerSec * 1000f).toInt().coerceAtLeast(1)
    val transition = key(speed, eink) { rememberInfiniteTransition(label = "readout-stream") }
    val t by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(loopMs, easing = LinearEasing), RepeatMode.Restart),
        label = "readout-stream-t",
    )
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(4.dp))
                .background(if (eink) EInkPaper else Color.Black.copy(alpha = 0.55f))
                .border(1.dp, if (eink) EInkFrame else LineColor, RoundedCornerShape(4.dp))
                .onSizeChanged { containerWidth = it.width },
        ) {
            Box(
                Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                Row(Modifier.graphicsLayer { translationX = -t * tileWidth }) {
                    repeat(tiles) {
                        Text(message, style = style, maxLines = 1, softWrap = false)
                        Spacer(Modifier.width(16.dp))
                    }
                }
            }
        }
        Text("SYS", fontSize = 7.sp, color = Fog.copy(alpha = 0.75f), maxLines = 1)
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
    active: Boolean = false,
    backlight: Boolean = false,
    backlightColor: Color = Color.White,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val depressed = pressed || active
    val scale by animateFloatAsState(if (depressed) 0.9f else 1f, label = "deck-key-scale")
    val density = LocalDensity.current
    val dropPx = with(density) { 2.dp.toPx() }
    val radiusPx = with(density) { size.toPx() * 1.6f }
    val shape = if (square) RoundedCornerShape(8.dp) else CircleShape

    val palette = LocalHardwarePalette.current
    val keyTop = lerp(Oxide3, palette.keyTint, 0.45f)
    val keyBottom = lerp(Oxide2, palette.keyTint, 0.35f)
    val top = if (depressed) lerp(Oxide2, palette.keyTint, 0.3f) else if (hero) palette.primaryBright else keyTop
    val bottom = if (depressed) Abyss else if (hero) palette.primary else keyBottom

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
                    translationY = if (depressed) dropPx else 0f
                }
                .shadow(
                    elevation = if (backlight) 16.dp else if (depressed) 1.dp else 5.dp,
                    shape = shape,
                    ambientColor = if (backlight) backlightColor.copy(alpha = 0.6f) else Color.Black,
                    spotColor = if (backlight) backlightColor else Color.Black,
                )
                .clip(shape)
                .background(Brush.radialGradient(listOf(top, bottom), center = Offset(0.3f, 0.25f), radius = radiusPx))
                .drawBehind {
                    drawRect(deckNoiseShader, alpha = 0.06f)
                    if (backlight) drawRect(backlightColor.copy(alpha = 0.12f))
                }
                .border(1.dp, if (hero) palette.primary else if (backlight) backlightColor.copy(alpha = 0.7f) else LineColor, shape)
                .clickable(interactionSource = interaction, indication = null) {
                    onFeedback(soundRes)
                    onClick()
                },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                icon,
                contentDescription = description,
                tint = if (depressed) tint.copy(alpha = 0.75f) else tint,
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
    "large" -> DeckSizes(64.dp, 52.dp)
    "small" -> DeckSizes(48.dp, 40.dp)
    else -> DeckSizes(56.dp, 46.dp)
}

@Composable
private fun KeyDeck(
    deckLayout: String,
    deckSize: String,
    deckShape: String,
    deckLabels: Boolean,
    backlightEnabled: Boolean,
    backlightColor: Color,
    currentRoute: String,
    focusModeEnabled: Boolean,
    hasRatedUp: Boolean,
    menuOpen: Boolean,
    onRoam: () -> Unit,
    onThumbsUp: () -> Unit,
    onThumbsDown: () -> Unit,
    onOpenMenu: () -> Unit,
    onNavigate: (String) -> Unit,
    onFeedback: (Int) -> Unit,
) {
    val palette = LocalHardwarePalette.current
    val sizes = deckSizes(deckSize)
    val square = deckShape == "square"
    val dislikeTint = MaterialTheme.colorScheme.onSurfaceVariant
    val likeTint = if (hasRatedUp) Ok else MaterialTheme.colorScheme.onSurfaceVariant
    val roamTint = if (focusModeEnabled) MaterialTheme.colorScheme.tertiary else palette.primaryBright
    val settingsTint = if (currentRoute == RoamTab.SettingsHub.route) palette.secondary else Fog
    val settingsActive = currentRoute.startsWith("settings")

    val dislikeKey: @Composable (Modifier) -> Unit = { mod ->
        DeckKey(onThumbsDown, R.raw.skip, onFeedback, sizes.side, RoamOsIcons.Dislike, dislikeTint, "Dislike", square = square, showLabel = deckLabels, backlight = backlightEnabled, backlightColor = backlightColor, modifier = mod)
    }
    val likeKey: @Composable (Modifier) -> Unit = { mod ->
        DeckKey(onThumbsUp, R.raw.like, onFeedback, sizes.side, RoamOsIcons.Like, likeTint, "Like", square = square, showLabel = deckLabels, backlight = backlightEnabled, backlightColor = backlightColor, modifier = mod)
    }
    val roamKey: @Composable (Modifier) -> Unit = { mod ->
        DeckKey(
            { if (currentRoute == RoamTab.Roam.route) onRoam() else onNavigate(RoamTab.Roam.route) },
            R.raw.click_heavy, onFeedback, sizes.roam, RoamOsIcons.Roam, roamTint, "Roam", hero = true, showLabel = deckLabels, backlight = backlightEnabled, backlightColor = backlightColor, modifier = mod,
        )
    }
    val menuKey: @Composable (Modifier) -> Unit = { mod ->
        DeckKey(onOpenMenu, R.raw.click, onFeedback, sizes.side, RoamOsIcons.Menu, Fog, "Menu", square = square, active = menuOpen, showLabel = deckLabels, backlight = backlightEnabled, backlightColor = backlightColor, modifier = mod)
    }
    val settingsKey: @Composable (Modifier) -> Unit = { mod ->
        DeckKey(
            { if (currentRoute == RoamTab.Roam.route) onNavigate(RoamTab.SettingsHub.route) else onNavigate(RoamTab.Roam.route) },
            R.raw.click, onFeedback, sizes.side, RoamOsIcons.Settings, settingsTint, "Settings", square = square, active = settingsActive, showLabel = deckLabels, backlight = backlightEnabled, backlightColor = backlightColor, modifier = mod,
        )
    }

    when (deckLayout) {
        "line" -> Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            dislikeKey(Modifier); menuKey(Modifier); roamKey(Modifier); settingsKey(Modifier); likeKey(Modifier)
        }
        "grid" -> Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                dislikeKey(Modifier)
                menuKey(Modifier)
            }
            roamKey(Modifier)
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
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
    val inset = sizes.side * 0.35f
    val topInset = if (inverted) inset else 0.dp
    val bottomInset = if (inverted) 0.dp else inset
    val labelSpace = if (deckLabels) 16.dp else 0.dp
    Box(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .width(sizes.roam + sizes.side * 2 + 36.dp)
                .height(sizes.roam + sizes.side * 2 + 36.dp + labelSpace),
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



