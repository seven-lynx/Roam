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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.roam.android.R
import app.roam.android.model.FIREWALK_CELL
import app.roam.android.model.FIREWALK_COLS
import app.roam.android.model.FIREWALK_GOAL_COLS
import app.roam.android.model.FIREWALK_GOAL_COUNT
import app.roam.android.model.FIREWALK_ROWS
import app.roam.android.model.FIREWALK_ROW_KINDS
import app.roam.android.model.FirewalkRow
import app.roam.android.model.FirewalkState
import app.roam.android.model.GameId
import app.roam.android.model.buildLanes
import app.roam.android.model.hop
import app.roam.android.model.isFirewalkComplete
import app.roam.android.model.makeRunId
import app.roam.android.model.newFirewalk
import app.roam.android.model.openPortCount
import app.roam.android.model.program
import app.roam.android.model.respawn
import app.roam.android.model.stepFirewalk
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.TealBright
import app.roam.android.util.SoundManager
import app.roam.android.util.Steer
import app.roam.android.util.resolveSteer
import kotlinx.coroutines.delay
import kotlin.math.min
import kotlin.math.sin

/**
 * FIREWALK.EXE — guide a probe packet through the perimeter. A native Compose
 * port of the web `FroggerProgram`: shifting rule-filters kill the probe,
 * carrier packets ferry it across the dark static, and five open ports clear
 * the level. Swipes steer the hop, and an on-screen D-pad or analog stick can
 * be toggled, exactly as in DEBRIS.
 */

/** One animation frame, matching the web's 60 fps drift speed. */
private const val FIREWALK_FRAME_MS = 16L

/** How long the analog stick holds a direction before the probe hops again. */
internal const val FIREWALK_STICK_REPEAT_MS = 200L

// Fixed phosphor palette (a self-contained vector program, like DEBRIS).
private val BG = Color(0xFF0A1518)
private val GRID = Color(0x21E6DCC3)
private val BUFFER = Color(0x1F78968C)
private val STATIC = Color(0xFF0E1F28)
private val STATIC_LINE = Color(0x4759B3AE)
private val CARRIER = Color(0xFF59B3AE)
private val GUARD = Color(0xFFE0B45F)
private val GUARD_EDGE = Color(0xFF8A6D33)
private val PORT = Color(0xFF59B3AE)
private val PORT_FILLED = Color(0xFF7FE3D8)
private val WALL = Color(0xFF2A2418)
private val PROBE = Color(0xFF7FE3D8)

/**
 * The row/column delta for one hop in [steer]'s direction. Row 0 is the ports
 * and the launch pad is the bottom row, so steering up is a negative row. One
 * place for the convention shared by swipes, the D-pad and the analog stick.
 */
internal fun firewalkHopDelta(steer: Steer): Pair<Int, Int> = when (steer) {
    Steer.UP -> 0 to -1
    Steer.DOWN -> 0 to 1
    Steer.LEFT -> -1 to 0
    Steer.RIGHT -> 1 to 0
}

@Composable
fun FirewalkProgram(
    soundEnabled: Boolean,
    signedIn: Boolean,
    onAward: GameAward,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = remember { requireNotNull(program("frogger")) { "FIREWALK missing from registry" } }
    val context = LocalContext.current
    val runId = rememberSaveable { makeRunId() }
    val levels = rememberGameLevel(GameId.FROGGER, runId, signedIn, onAward, timeLimitFor = { l -> (40 - (l - 1) * 2).coerceAtLeast(20) })

    var running by rememberSaveable { mutableStateOf(false) }
    var stickMode by rememberSaveable { mutableStateOf(false) }
    var stickHeld by remember { mutableStateOf<Steer?>(null) }
    var state by remember { mutableStateOf(newFirewalk(1)) }
    var laneLevel by remember { mutableIntStateOf(1) }
    levels.getScore = { state.score }

    fun sfx(resId: Int) {
        if (soundEnabled) SoundManager.play(context, resId)
    }

    fun move(dc: Int, dr: Int) {
        if (!levels.isPlaying) return
        val livesBefore = state.lives
        val next = hop(state, dc, dr)
        state = next
        when {
            next.over -> {
                sfx(R.raw.click_heavy)
                levels.gameOver(next.score)
            }

            next.lives < livesBefore -> sfx(R.raw.click_nav)

            isFirewalkComplete(next) -> {
                sfx(R.raw.generic_success)
                levels.completeLevel()
            }

            else -> sfx(R.raw.click)
        }
    }

    fun reset() {
        state = newFirewalk(1)
        laneLevel = 1
        levels.resetLevels()
    }

    fun moveSteer(steer: Steer) {
        val (dc, dr) = firewalkHopDelta(steer)
        move(dc, dr)
    }

    LaunchedEffect(levels.phase, levels.level, running) {
        if (!running) return@LaunchedEffect
        while (levels.isPlaying) {
            delay(FIREWALK_FRAME_MS)
            if (laneLevel != levels.level) {
                laneLevel = levels.level
                state = respawn(
                    state.copy(
                        lanes = buildLanes(levels.level),
                        goals = List(FIREWALK_GOAL_COUNT) { false },
                    ),
                )
            }
            val livesBefore = state.lives
            val next = stepFirewalk(state)
            state = next
            if (next.over) {
                sfx(R.raw.click_heavy)
                levels.gameOver(next.score)
            } else if (next.lives < livesBefore) {
                sfx(R.raw.click_nav)
            }
        }
    }

    // STICK mode: one hop the moment a direction is pushed, then keep hopping
    // while it stays held — the repeat a held arrow key gives the web game.
    LaunchedEffect(stickHeld, levels.phase) {
        val direction = stickHeld ?: return@LaunchedEffect
        while (levels.isPlaying) {
            moveSteer(direction)
            delay(FIREWALK_STICK_REPEAT_MS)
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
                    Modifier.fillMaxSize().padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("DEPTH ${levels.level}", style = MaterialTheme.typography.labelSmall, color = Fog)
                        Text("SCORE ${state.score}", style = MaterialTheme.typography.labelSmall, color = Fog)
                        Text(
                            "PORTS ${openPortCount(state)}/$FIREWALK_GOAL_COUNT",
                            style = MaterialTheme.typography.labelSmall,
                            color = Fog,
                        )
                        Text("RETRY ${state.lives}", style = MaterialTheme.typography.labelSmall, color = Fog)
                        Text("TIME ${formatGameTime(levels.timeLeft)}", style = MaterialTheme.typography.labelSmall, color = Fog)
                    }
                    Spacer(Modifier.height(6.dp))
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        FirewalkBoard(
                            state = state,
                            onSwipe = { steer -> moveSteer(steer) },
                            overlay = {
                                ProgramOverlay(
                                    phase = levels.phase,
                                    level = levels.level,
                                    countdown = levels.countdown,
                                    lastXp = levels.lastXp,
                                    signedIn = signedIn,
                                    overTitle = "SIGNAL DROPPED",
                                    scoreLabel = "SCORE",
                                    score = state.score,
                                    onStart = { levels.begin() },
                                    onRestart = { reset() },
                                )
                            },
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    if (stickMode) {
                        AnalogStick(
                            onHold = { stickHeld = it },
                            label = "Hop stick",
                            size = 112.dp,
                        )
                    } else {
                        ProgramDpad(onSteer = { steer -> moveSteer(steer) })
                    }
                    Spacer(Modifier.height(4.dp))
                    ProgramActionKey(if (stickMode) "STICK ⇄ D-PAD" else "D-PAD ⇄ STICK") {
                        stickMode = !stickMode
                        stickHeld = null
                    }
                }
            }
        }
    }
}

/** The playfield: grid, ports, lanes and the probe on one Canvas. */
@Composable
private fun FirewalkBoard(
    state: FirewalkState,
    onSwipe: (Steer) -> Unit,
    overlay: @Composable BoxScope.() -> Unit,
) {
    val boardWidth = FIREWALK_COLS * FIREWALK_CELL
    val boardHeight = FIREWALK_ROWS * FIREWALK_CELL

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
                        val dir = resolveSteer(drift.x, drift.y, 34f)
                        if (dir != null) {
                            onSwipe(dir)
                            drift = Offset.Zero
                        }
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        val width = min(maxWidth.value, maxHeight.value * (boardWidth / boardHeight))
        val height = width * boardHeight / boardWidth
        Box(
            Modifier
                .size(width.dp, height.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(BG)
                .border(1.dp, LineColor, RoundedCornerShape(10.dp)),
        ) {
            Canvas(Modifier.fillMaxSize()) {
                val scale = size.width / boardWidth
                fun px(value: Float) = value * scale

                // Grid.
                for (c in 1 until FIREWALK_COLS) {
                    drawRect(GRID, Offset(px(c * FIREWALK_CELL), 0f), Size(scale, size.height))
                }
                for (r in 1 until FIREWALK_ROWS) {
                    drawRect(GRID, Offset(0f, px(r * FIREWALK_CELL)), Size(size.width, scale))
                }

                for (r in 0 until FIREWALK_ROWS) {
                    val kind = FIREWALK_ROW_KINDS[r]
                    val top = px(r * FIREWALK_CELL)

                    if (kind == FirewalkRow.BUFFER || kind == FirewalkRow.START) {
                        drawRect(BUFFER, Offset(0f, top), Size(size.width, px(FIREWALK_CELL)))
                    }

                    if (kind == FirewalkRow.GOAL) {
                        for (c in 0 until FIREWALK_COLS) {
                            val left = px(c * FIREWALK_CELL)
                            val goalIndex = FIREWALK_GOAL_COLS.indexOf(c)
                            if (goalIndex >= 0) {
                                val filled = state.goals[goalIndex]
                                drawRect(
                                    if (filled) PORT_FILLED else PORT.copy(alpha = 0.16f),
                                    Offset(left + px(2f), top + px(2f)),
                                    Size(px(FIREWALK_CELL - 4f), px(FIREWALK_CELL - 4f)),
                                )
                            } else {
                                drawRect(WALL, Offset(left, top), Size(px(FIREWALK_CELL), px(FIREWALK_CELL)))
                            }
                        }
                    }

                    if (kind == FirewalkRow.STATIC) {
                        drawRect(STATIC, Offset(0f, top), Size(size.width, px(FIREWALK_CELL)))
                        val mid = top + px(FIREWALK_CELL / 2f)
                        var x = 0f
                        while (x <= size.width) {
                            val a = mid + sin(x * 0.3f + state.frame * 0.05f) * px(3f)
                            val b = mid + sin((x + px(4f)) * 0.3f + state.frame * 0.05f) * px(3f)
                            drawRect(STATIC_LINE, Offset(x, min(a, b)), Size(px(4f), kotlin.math.abs(b - a).coerceAtLeast(scale)))
                            x += px(8f)
                        }
                    }

                    val lane = state.lanes[r].orEmpty()
                    for (entity in lane) {
                        val left = px(entity.x)
                        val laneWidth = px(entity.cells * FIREWALK_CELL.toFloat())
                        if (kind == FirewalkRow.STATIC) {
                            drawRect(CARRIER, Offset(left, top + px(3f)), Size(laneWidth, px(FIREWALK_CELL - 6f)))
                        } else {
                            drawRect(GUARD, Offset(left, top + px(2f)), Size(laneWidth, px(FIREWALK_CELL - 4f)))
                            drawRect(GUARD_EDGE, Offset(left + 0.5f, top + px(2.5f)), Size(laneWidth - 1f, scale))
                        }
                    }
                }

                // The probe packet.
                val cx = px(state.playerX + FIREWALK_CELL / 2f)
                val cy = px(state.playerRow * FIREWALK_CELL + FIREWALK_CELL / 2f)
                val r = px(7f)
                val diamond = Path().apply {
                    moveTo(cx, cy - r)
                    lineTo(cx + r, cy)
                    lineTo(cx, cy + r)
                    lineTo(cx - r, cy)
                    close()
                }
                drawPath(diamond, PROBE)
            }
            overlay()
        }
    }
}