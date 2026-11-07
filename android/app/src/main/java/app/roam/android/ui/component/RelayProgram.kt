package app.roam.android.ui.component

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.unit.dp
import app.roam.android.R
import app.roam.android.model.GameId
import app.roam.android.model.makeRunId
import app.roam.android.model.program
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.GoldBright
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.TealBright
import app.roam.android.util.SoundManager
import app.roam.android.util.Steer
import app.roam.android.util.resolveSteer
import kotlinx.coroutines.delay
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

/**
 * RELAY.EXE — the signal serpent. Adapted from zeli-web-games "Snake"
 * (Apache-2.0); reskinned to the Roam palette and relabeled. Mirrors the web
 * `SnakeProgram` in look, feel and pacing: a single Canvas board redrawn once
 * per tick, five packets per level, a tightening tick, and either an on-screen
 * D-pad or swipe gestures.
 */

private const val GRID = 15

/** Packets swallowed before the link level advances. */
private const val PACKETS_PER_LEVEL = 5

private const val BASE_SPEED_MS = 135L
private const val MIN_SPEED_MS = 68L

/** Tick interval (ms) tightens as the level climbs. */
private fun speedFor(level: Int): Long = max(MIN_SPEED_MS, BASE_SPEED_MS - (level - 1) * 8L)

private data class Pt(val x: Int, val y: Int)

private data class RelaySnapshot(
    val snake: List<Pt> = listOf(Pt(7, 7)),
    val food: Pt = Pt(10, 10),
    val score: Int = 0,
    val over: Boolean = false,
)

private fun spawnFood(snake: List<Pt>): Pt {
    var food: Pt
    do {
        food = Pt(Random.nextInt(GRID), Random.nextInt(GRID))
    } while (food in snake)
    return food
}

@Composable
fun RelayProgram(
    soundEnabled: Boolean,
    signedIn: Boolean = false,
    onAward: GameAward = { _, _, _, _, _ -> },
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = remember { requireNotNull(program("snake")) { "RELAY missing from registry" } }
    val context = LocalContext.current
    val runId = rememberSaveable { makeRunId() }
    val levels = rememberGameLevel(GameId.SNAKE, runId, signedIn, onAward)

    var running by rememberSaveable { mutableStateOf(false) }
    var snapshot by remember { mutableStateOf(RelaySnapshot()) }
    var dir by remember { mutableStateOf(Pt(1, 0)) }
    var queued by remember { mutableStateOf<Pt?>(null) }

    fun sfx(resId: Int) {
        if (soundEnabled) SoundManager.play(context, resId)
    }

    fun reset() {
        snapshot = RelaySnapshot()
        dir = Pt(1, 0)
        queued = null
        levels.resetLevels()
    }

    fun steer(next: Pt) {
        // No 180° reversals, and only one turn per tick.
        if (next.x == -dir.x && next.y == -dir.y) return
        queued = next
    }

    fun onSteer(steerDir: Steer) {
        when (steerDir) {
            Steer.UP -> steer(Pt(0, -1))
            Steer.DOWN -> steer(Pt(0, 1))
            Steer.LEFT -> steer(Pt(-1, 0))
            Steer.RIGHT -> steer(Pt(1, 0))
        }
    }

    LaunchedEffect(levels.phase, levels.level, running) {
        if (!running) return@LaunchedEffect
        while (levels.isPlaying) {
            delay(speedFor(levels.level))
            queued?.let {
                dir = it
                queued = null
            }
            val head = snapshot.snake.first()
            val next = Pt(head.x + dir.x, head.y + dir.y)
            if (next.x !in 0 until GRID || next.y !in 0 until GRID || snapshot.snake.contains(next)) {
                snapshot = snapshot.copy(over = true)
                sfx(R.raw.click_heavy)
                levels.gameOver(snapshot.score)
                return@LaunchedEffect
            }
            val ate = next == snapshot.food
            val snake = listOf(next) + if (ate) snapshot.snake else snapshot.snake.dropLast(1)
            val score = if (ate) snapshot.score + 1 else snapshot.score
            snapshot = RelaySnapshot(
                snake = snake,
                food = if (ate) spawnFood(snake) else snapshot.food,
                score = score,
            )
            if (ate) sfx(R.raw.relay_tick)
            if (score >= levels.level * PACKETS_PER_LEVEL) {
                sfx(R.raw.generic_success)
                levels.completeLevel()
            }
        }
    }

    RoamOsWindow(title = meta.title, onClose = onClose, modifier = modifier) {
        Box(Modifier.fillMaxSize()) {
            if (!running) {
                ProgramGuide(meta) {
                    running = true
                    levels.begin()
                }
            } else {
                Column(
                    Modifier.fillMaxSize().padding(10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("LVL ${levels.level}", style = MaterialTheme.typography.labelSmall, color = Fog)
                        Text("PKT ${snapshot.score}", style = MaterialTheme.typography.labelSmall, color = Fog)
                    }
                    Spacer(Modifier.height(8.dp))
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        RelayBoard(snapshot = snapshot, onSteer = { onSteer(it) }) {
                            ProgramOverlay(
                                phase = levels.phase,
                                level = levels.level,
                                countdown = levels.countdown,
                                lastXp = levels.lastXp,
                                signedIn = signedIn,
                                overTitle = "SIGNAL LOST",
                                scoreLabel = "PKT",
                                score = snapshot.score,
                                onStart = { levels.begin() },
                                onRestart = { reset() },
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    ProgramDpad(onSteer = { onSteer(it) })
                }
            }
        }
    }
}

/** The board: one Canvas snapshot per tick, with swipe steering and the overlay. */
@Composable
private fun RelayBoard(
    snapshot: RelaySnapshot,
    onSteer: (Steer) -> Unit,
    overlay: @Composable BoxScope.() -> Unit,
) {
    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                var drift = Offset.Zero
                detectDragGestures(
                    onDragStart = { drift = Offset.Zero },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        drift += dragAmount
                        val dir = resolveSteer(drift.x, drift.y, 32f)
                        if (dir != null) {
                            onSteer(dir)
                            drift = Offset.Zero
                        }
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        val board = min(maxWidth.value, maxHeight.value)
        Box(
            Modifier
                .size(board.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF07100F))
                .border(1.dp, LineColor, RoundedCornerShape(8.dp))
                .padding(6.dp),
        ) {
            Canvas(Modifier.fillMaxSize()) {
                val cell = size.width / GRID

                // Grid guide.
                for (i in 1 until GRID) {
                    drawRect(Color(0x14E6DCC3), Offset(i * cell, 0f), Size(1f, size.height))
                    drawRect(Color(0x14E6DCC3), Offset(0f, i * cell), Size(size.width, 1f))
                }

                // The packet.
                drawRoundRect(
                    color = GoldBright,
                    topLeft = Offset(snapshot.food.x * cell + cell * 0.2f, snapshot.food.y * cell + cell * 0.2f),
                    size = Size(cell * 0.6f, cell * 0.6f),
                    cornerRadius = CornerRadius(cell * 0.3f),
                )

                // The link.
                snapshot.snake.forEachIndexed { index, segment ->
                    drawRoundRect(
                        color = if (index == 0) TealBright else Color(0xFF3E8C88),
                        topLeft = Offset(segment.x * cell + 1f, segment.y * cell + 1f),
                        size = Size(cell - 2f, cell - 2f),
                        cornerRadius = CornerRadius(cell * 0.25f),
                    )
                }
            }
            overlay()
        }
    }
}