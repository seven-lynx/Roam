package app.roam.android.ui.component

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.roam.android.R
import app.roam.android.model.program
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Danger
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.Gold
import app.roam.android.ui.theme.GoldBright
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Panel2
import app.roam.android.ui.theme.Panel3
import app.roam.android.ui.theme.TealBright
import app.roam.android.util.SoundManager
import app.roam.android.util.Steer
import app.roam.android.util.resolveSteer
import kotlinx.coroutines.delay
import kotlin.math.max
import kotlin.random.Random

/**
 * RELAY.EXE — the signal serpent. Adapted from zeli-web-games "Snake"
 * (Apache-2.0); reskinned to the Roam palette and relabeled. Mirrors the web
 * `SnakeProgram` in look, feel and tick rate, but is a native Compose game: a
 * single Canvas board redrawn once per tick, plus either an on-screen D-pad or
 * swipe gestures.
 */

private const val GRID = 15
private const val SPEED_MS = 110L

private data class Pt(val x: Int, val y: Int)

private data class RelaySnapshot(
    val snake: List<Pt> = listOf(Pt(7, 7)),
    val food: Pt = Pt(10, 10),
    val score: Int = 0,
    val over: Boolean = false,
)

private fun spawnFood(snake: List<Pt>): Pt {
    var f: Pt
    do {
        f = Pt(Random.nextInt(GRID), Random.nextInt(GRID))
    } while (f in snake)
    return f
}

@Composable
fun RelayProgram(
    soundEnabled: Boolean,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = remember { requireNotNull(program("snake")) }
    val context = LocalContext.current

    var snapshot by remember { mutableStateOf(RelaySnapshot()) }
    var direction by remember { mutableStateOf(Pt(1, 0)) }
    var active by remember { mutableStateOf(true) }
    var showGuide by remember { mutableStateOf(true) }
    var about by remember { mutableStateOf(false) }
    // D-pad by default; swipe is opt-in and survives configuration changes.
    var swipeEnabled by rememberSaveable { mutableStateOf(false) }

    fun sfx(resId: Int) {
        if (soundEnabled) SoundManager.play(context, resId)
    }

    fun reset() {
        snapshot = RelaySnapshot()
        direction = Pt(1, 0)
        active = true
    }

    fun steer(dx: Int, dy: Int) {
        if (dx == -direction.x && dy == -direction.y) return // no 180° reversals
        direction = Pt(dx, dy)
    }

    fun applySteer(s: Steer) {
        when (s) {
            Steer.UP -> steer(0, -1)
            Steer.DOWN -> steer(0, 1)
            Steer.LEFT -> steer(-1, 0)
            Steer.RIGHT -> steer(1, 0)
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            delay(SPEED_MS)
            if (showGuide || !active) continue
            val s = snapshot
            val d = direction
            val head = Pt(s.snake.first().x + d.x, s.snake.first().y + d.y)
            val hit = head.x !in 0 until GRID || head.y !in 0 until GRID || s.snake.contains(head)
            if (hit) {
                active = false
                snapshot = s.copy(over = true)
                sfx(R.raw.relay_tick)
                continue
            }
            val next = listOf(head) + s.snake
            if (head == s.food) {
                snapshot = RelaySnapshot(snake = next, food = spawnFood(next), score = s.score + 1)
                sfx(R.raw.click)
            } else {
                snapshot = s.copy(snake = next.dropLast(1))
            }
        }
    }

    RoamOsWindow(title = meta.title, onClose = onClose, modifier = modifier) {
        Box(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().padding(12.dp)) {
                // Kicker: DOS path + ABOUT toggle (mirrors the web program-shell).
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        meta.file,
                        style = MaterialTheme.typography.labelSmall,
                        color = Fog,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        if (about) "CLOSE" else "ABOUT",
                        style = MaterialTheme.typography.labelSmall,
                        color = TealBright,
                        modifier = Modifier.clickable { about = !about }.padding(horizontal = 8.dp, vertical = 4.dp),
                    )
                }

                if (about) {
                    Spacer(Modifier.height(8.dp))
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(6.dp))
                            .background(Panel2)
                            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
                            .padding(10.dp),
                    ) {
                        Text(meta.title, style = MaterialTheme.typography.labelLarge, color = TealBright)
                        Text(meta.file, style = MaterialTheme.typography.labelSmall, color = Fog)
                        Spacer(Modifier.height(6.dp))
                        Text(meta.tagline, style = MaterialTheme.typography.bodySmall, color = Bone)
                        Spacer(Modifier.height(4.dp))
                        Text("CONTROLS — ${meta.controls}", style = MaterialTheme.typography.labelSmall, color = Fog)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "${meta.license.name} (${meta.license.spdx}) · adapted from ${meta.source}",
                            style = MaterialTheme.typography.labelSmall,
                            color = Fog,
                        )
                    }
                }

                Spacer(Modifier.height(8.dp))

                // Score + control-mode toggle.
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Row {
                        Text("PKT ", style = MaterialTheme.typography.labelSmall, color = Fog)
                        Text("${snapshot.score}", style = MaterialTheme.typography.labelSmall, color = TealBright)
                    }
                    Spacer(Modifier.weight(1f))
                    Text(
                        if (swipeEnabled) "SWIPE" else "D-PAD",
                        style = MaterialTheme.typography.labelSmall,
                        color = TealBright,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Panel3)
                            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
                            .clickable { swipeEnabled = !swipeEnabled }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }

                Spacer(Modifier.height(8.dp))

                // Board, sized to the largest square that fits the remaining space.
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    val side = minOf(maxWidth, maxHeight)
                    RelayBoard(
                        snapshot = snapshot,
                        gestureEnabled = swipeEnabled,
                        onSteer = ::applySteer,
                        onRestart = ::reset,
                        modifier = Modifier.size(side),
                    )
                }

                Spacer(Modifier.height(8.dp))

                if (swipeEnabled) {
                    Text(
                        "// swipe to steer",
                        style = MaterialTheme.typography.labelSmall,
                        color = Fog,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                    )
                } else {
                    RelayDpad(onSteer = ::applySteer)
                }
            }

            if (showGuide) {
                RelayGuide(meta = meta, onStart = { showGuide = false })
            }
        }
    }
}

@Composable
private fun RelayBoard(
    snapshot: RelaySnapshot,
    gestureEnabled: Boolean,
    onSteer: (Steer) -> Unit,
    onRestart: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Panel2)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .then(
                if (gestureEnabled) {
                    Modifier.pointerInput(Unit) {
                        var accum = Offset.Zero
                        detectDragGestures(
                            onDragEnd = { accum = Offset.Zero },
                            onDragCancel = { accum = Offset.Zero },
                        ) { change, dragAmount ->
                            change.consume()
                            accum += dragAmount
                            resolveSteer(accum.x, accum.y)?.let {
                                onSteer(it)
                                accum = Offset.Zero
                            }
                        }
                    }
                } else {
                    Modifier
                },
            ),
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val cell = size.width / GRID
            for (x in 0 until GRID) {
                for (y in 0 until GRID) {
                    if ((x + y) % 3 == 0) {
                        drawCircle(
                            color = LineColor,
                            radius = cell * 0.045f,
                            center = Offset(x * cell + cell / 2, y * cell + cell / 2),
                        )
                    }
                }
            }

            val foodCenter = Offset(snapshot.food.x * cell + cell / 2, snapshot.food.y * cell + cell / 2)
            drawCircle(color = Gold.copy(alpha = 0.22f), radius = cell * 0.30f, center = foodCenter)
            drawCircle(color = Gold, radius = cell * 0.18f, center = foodCenter)

            snapshot.snake.forEachIndexed { i, seg ->
                val isHead = i == 0
                val alpha = 1f - (i.toFloat() / max(1, snapshot.snake.size)) * 0.55f
                val color = if (isHead) GoldBright else TealBright.copy(alpha = alpha)
                val inset = cell * 0.045f
                drawRoundRect(
                    color = color,
                    topLeft = Offset(seg.x * cell + inset, seg.y * cell + inset),
                    size = Size(cell - inset * 2, cell - inset * 2),
                    cornerRadius = CornerRadius(if (isHead) cell * 0.14f else cell * 0.09f),
                )
            }
        }

        if (snapshot.over) {
            Column(
                Modifier.fillMaxSize().background(Color(0xB807100F)),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("SIGNAL LOST", style = MaterialTheme.typography.labelLarge, color = Danger)
                Spacer(Modifier.height(4.dp))
                Text("PKT ${snapshot.score}", style = MaterialTheme.typography.labelSmall, color = Fog)
                Spacer(Modifier.height(10.dp))
                Box(
                    Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Panel3)
                        .border(1.dp, LineColor, RoundedCornerShape(6.dp))
                        .clickable { onRestart() }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    Text("RESTART", style = MaterialTheme.typography.labelMedium, color = TealBright)
                }
            }
        }
    }
}

@Composable
private fun RelayDpad(onSteer: (Steer) -> Unit) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        DpadKey("▲") { onSteer(Steer.UP) }
        Spacer(Modifier.height(4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            DpadKey("◀") { onSteer(Steer.LEFT) }
            DpadKey("▼") { onSteer(Steer.DOWN) }
            DpadKey("▶") { onSteer(Steer.RIGHT) }
        }
    }
}

@Composable
private fun DpadKey(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(width = 46.dp, height = 38.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(Panel3)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = Bone)
    }
}

@Composable
private fun RelayGuide(meta: app.roam.android.model.Program, onStart: () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(Color(0xF207100F)).padding(24.dp),
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
            Text("CONTROLS — ${meta.controls}", style = MaterialTheme.typography.labelMedium, color = TealBright, textAlign = TextAlign.Center)
            Spacer(Modifier.height(16.dp))
            Box(
                Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(Panel3)
                    .border(1.dp, LineColor, RoundedCornerShape(6.dp))
                    .clickable { onStart() }
                    .padding(horizontal = 20.dp, vertical = 10.dp),
            ) {
                Text("RUN // START", style = MaterialTheme.typography.labelMedium, color = Bone)
            }
        }
    }
}
