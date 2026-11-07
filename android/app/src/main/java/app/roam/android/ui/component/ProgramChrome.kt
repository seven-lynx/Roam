package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.roam.android.model.Program
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Danger
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Panel3
import app.roam.android.ui.theme.TealBright
import app.roam.android.util.Steer
import app.roam.android.util.resolveSteer
import kotlin.math.hypot

/**
 * Shared chrome for the in-OS programs: the boot-time controls guide, the
 * READY / LEVEL COMPLETE / LEVEL START / game-over overlay, the on-screen D-pad
 * and the analog stick. Ported from the web `ProgramWindow` guide,
 * `GameLevelOverlay` and `AnalogStick` so both surfaces behave the same.
 */

/** A single on-screen game key (D-pad arrow, transport control, fire). */
@Composable
fun ProgramKey(
    label: String,
    modifier: Modifier = Modifier,
    width: Dp = 46.dp,
    height: Dp = 38.dp,
    tint: Color = Bone,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .size(width = width, height = height)
            .clip(RoundedCornerShape(6.dp))
            .background(Panel3)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = tint)
    }
}

/**
 * A press-and-hold key: reports [onDown] while pressed and [onUp] on release,
 * for games that hold a direction (DEBRIS thrust and rotation).
 */
@Composable
fun ProgramHoldKey(
    label: String,
    onDown: () -> Unit,
    onUp: () -> Unit,
    modifier: Modifier = Modifier,
    width: Dp = 46.dp,
    height: Dp = 38.dp,
) {
    Box(
        modifier
            .size(width = width, height = height)
            .clip(RoundedCornerShape(6.dp))
            .background(Panel3)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = {
                        onDown()
                        tryAwaitRelease()
                        onUp()
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = Bone)
    }
}

/** A pill-shaped action key (START / RESTART / FIRE). */
@Composable
fun ProgramActionKey(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Panel3)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = TealBright)
    }
}

/** The on-screen four-way pad shared by RELAY, COMPILER and FIREWALK. */
@Composable
fun ProgramDpad(onSteer: (Steer) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        ProgramKey("▲") { onSteer(Steer.UP) }
        Spacer(Modifier.height(4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            ProgramKey("◀") { onSteer(Steer.LEFT) }
            ProgramKey("▼") { onSteer(Steer.DOWN) }
            ProgramKey("▶") { onSteer(Steer.RIGHT) }
        }
    }
}

/**
 * A virtual analog stick: a thumb-drag knob over a four-way base. Deflection is
 * resolved through the same [resolveSteer] axis logic as swipes and reported
 * continuously via [onHold] (`null` on release), for games that hold a
 * direction — DEBRIS thrust and rotation.
 */
@Composable
fun AnalogStick(
    onHold: (Steer?) -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 104.dp,
    label: String = "Analog stick",
) {
    val density = LocalDensity.current
    val radiusPx = with(density) { (size / 2).toPx() }
    val knobPx = with(density) { (size * 0.42f).toPx() }
    val maxPx = (radiusPx - knobPx / 2f).coerceAtLeast(1f)

    var deflection by remember { mutableStateOf(Offset.Zero) }
    var current by remember { mutableStateOf<Steer?>(null) }

    fun release() {
        deflection = Offset.Zero
        if (current != null) {
            current = null
            onHold(null)
        }
    }

    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(Panel3)
            .border(1.dp, LineColor, CircleShape)
            .semantics { contentDescription = label }
            .pointerInput(maxPx, radiusPx) {
                detectDragGestures(
                    onDragStart = { deflection = Offset.Zero },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        val raw = deflection + dragAmount
                        val d = hypot(raw.x, raw.y)
                        deflection = if (d > maxPx) raw * (maxPx / d) else raw
                        val dir = resolveSteer(deflection.x, deflection.y, radiusPx * 0.28f)
                        if (dir != current) {
                            current = dir
                            onHold(dir)
                        }
                    },
                    onDragEnd = { release() },
                    onDragCancel = { release() },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        Text("▲", style = MaterialTheme.typography.labelSmall, color = Fog, modifier = Modifier.align(Alignment.TopCenter).padding(top = 4.dp))
        Text("▼", style = MaterialTheme.typography.labelSmall, color = Fog, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 4.dp))
        Text("◀", style = MaterialTheme.typography.labelSmall, color = Fog, modifier = Modifier.align(Alignment.CenterStart).padding(start = 6.dp))
        Text("▶", style = MaterialTheme.typography.labelSmall, color = Fog, modifier = Modifier.align(Alignment.CenterEnd).padding(end = 6.dp))
        Box(
            Modifier
                .offset(
                    x = with(density) { deflection.x.toDp() },
                    y = with(density) { deflection.y.toDp() },
                )
                .size(size * 0.42f)
                .clip(CircleShape)
                .background(TealBright),
        )
    }
}

/**
 * The boot-time controls guide every program shows before its first run: title,
 * file path, tagline, controls, and a RUN key.
 */
@Composable
fun ProgramGuide(meta: Program, modifier: Modifier = Modifier, onStart: () -> Unit) {
    Box(
        modifier.fillMaxSize().background(Color(0xF207100F)).padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(meta.title, style = MaterialTheme.typography.titleLarge, color = TealBright)
            Spacer(Modifier.height(4.dp))
            Text(meta.file, style = MaterialTheme.typography.labelSmall, color = Fog)
            Spacer(Modifier.height(14.dp))
            Text("// HOW TO PLAY", style = MaterialTheme.typography.labelSmall, color = Fog)
            Spacer(Modifier.height(6.dp))
            Text(meta.tagline, style = MaterialTheme.typography.bodySmall, color = Bone, textAlign = TextAlign.Center)
            Spacer(Modifier.height(12.dp))
            Text(
                "CONTROLS — ${meta.controls}",
                style = MaterialTheme.typography.labelMedium,
                color = TealBright,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            ProgramActionKey("RUN // START", onStart)
        }
    }
}

/**
 * The shared interstitial overlay drawn over a program's playfield: READY,
 * LEVEL COMPLETE (with the XP award), the LEVEL START countdown, and a unified
 * game-over card. Mirrors the web `GameLevelOverlay`.
 */
@Composable
fun ProgramOverlay(
    phase: GamePhase,
    level: Int,
    countdown: Int,
    lastXp: Int,
    signedIn: Boolean,
    overTitle: String,
    modifier: Modifier = Modifier,
    scoreLabel: String? = null,
    score: Int? = null,
    onStart: (() -> Unit)? = null,
    onRestart: (() -> Unit)? = null,
) {
    if (phase == GamePhase.PLAYING) return

    Box(
        modifier.fillMaxSize().background(Color(0xC807100F)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            when (phase) {
                GamePhase.READY -> {
                    Text("LEVEL $level", style = MaterialTheme.typography.labelLarge, color = TealBright)
                    onStart?.let {
                        Spacer(Modifier.height(10.dp))
                        ProgramActionKey("START", it)
                    }
                }

                GamePhase.COMPLETE -> {
                    Text("LEVEL $level CLEAR", style = MaterialTheme.typography.labelLarge, color = TealBright)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        if (signedIn) "+$lastXp XP" else "GUEST SESSION",
                        style = MaterialTheme.typography.labelSmall,
                        color = Fog,
                    )
                }

                GamePhase.START -> {
                    Text("LEVEL $level", style = MaterialTheme.typography.labelLarge, color = TealBright)
                    Text(
                        if (countdown > 0) countdown.toString() else "GO",
                        style = MaterialTheme.typography.titleLarge,
                        color = Bone,
                    )
                }

                GamePhase.OVER -> {
                    Text(overTitle, style = MaterialTheme.typography.labelLarge, color = Danger)
                    if (scoreLabel != null && score != null) {
                        Spacer(Modifier.height(4.dp))
                        Text("$scoreLabel $score", style = MaterialTheme.typography.labelSmall, color = Fog)
                    }
                    if (signedIn && lastXp > 0) {
                        Text("+$lastXp XP", style = MaterialTheme.typography.labelSmall, color = Fog)
                    }
                    onRestart?.let {
                        Spacer(Modifier.height(10.dp))
                        ProgramActionKey("RESTART", it)
                    }
                }

                GamePhase.PLAYING -> Unit
            }
        }
    }
}