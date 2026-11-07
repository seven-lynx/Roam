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
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.roam.android.R
import app.roam.android.model.COMPILER_COLS
import app.roam.android.model.COMPILER_ROWS
import app.roam.android.model.COMPILER_SHAPES
import app.roam.android.model.GameId
import app.roam.android.model.LINES_PER_LEVEL
import app.roam.android.model.clearLines
import app.roam.android.model.collides
import app.roam.android.model.compilerSpeedFor
import app.roam.android.model.emptyCompilerBoard
import app.roam.android.model.makeRunId
import app.roam.android.model.mergePiece
import app.roam.android.model.program
import app.roam.android.model.randomShapeIndex
import app.roam.android.model.rotatePiece
import app.roam.android.model.spawnColumn
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Panel2
import app.roam.android.ui.theme.TealBright
import app.roam.android.util.SoundManager
import app.roam.android.util.Steer
import app.roam.android.util.resolveSteer
import kotlinx.coroutines.delay
import kotlin.math.min

/**
 * COMPILER.EXE — falling data shards. A native Compose port of the web
 * `TetrisProgram` (zeli-web-games "MiniTetris", Apache-2.0): a 10×20 board on a
 * single Canvas, transport keys plus swipe, and a level every five lines.
 */

/** Shard colours, matching the web phosphor palette. */
private val SHARD_COLORS = listOf(
    Color(0xFF59B3AE),
    Color(0xFFE0B45F),
    Color(0xFFD98A4A),
    Color(0xFF6A9FD8),
    Color(0xFFC98F3A),
    Color(0xFF7FE3D8),
    Color(0xFFFF5C7A),
)

private val BOARD_BG = Color(0xFF0A1518)

@Composable
fun CompilerProgram(
    soundEnabled: Boolean,
    signedIn: Boolean,
    onAward: GameAward,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = remember { requireNotNull(program("tetris")) { "COMPILER missing from registry" } }
    val context = LocalContext.current
    val runId = rememberSaveable { makeRunId() }
    val levels = rememberGameLevel(GameId.TETRIS, runId, signedIn, onAward, timeLimitFor = { l -> (90 - (l - 1) * 5).coerceAtLeast(45) })

    var running by rememberSaveable { mutableStateOf(false) }
    var board by remember { mutableStateOf(emptyCompilerBoard()) }
    var shapeIdx by remember { mutableIntStateOf(randomShapeIndex()) }
    var piece by remember { mutableStateOf(COMPILER_SHAPES[shapeIdx]) }
    var row by remember { mutableIntStateOf(0) }
    var col by remember { mutableIntStateOf(spawnColumn(COMPILER_SHAPES[shapeIdx])) }
    var lines by remember { mutableIntStateOf(0) }
    levels.getScore = { lines }

    fun sfx(resId: Int) {
        if (soundEnabled) SoundManager.play(context, resId)
    }

    fun moveBy(delta: Int) {
        if (!levels.isPlaying) return
        if (!collides(board, piece, row, col + delta)) col += delta
    }

    fun rotate() {
        if (!levels.isPlaying) return
        val rotated = rotatePiece(piece)
        if (!collides(board, rotated, row, col)) piece = rotated
    }

    fun drop() {
        if (!levels.isPlaying) return
        if (!collides(board, piece, row + 1, col)) {
            row += 1
            return
        }
        // The shard lands: stamp it, compile out full lines, echo the next shard.
        val merged = mergePiece(board, piece, row, col, shapeIdx + 1)
        val clear = clearLines(merged)
        board = clear.board
        if (clear.cleared > 0) {
            lines += clear.cleared
            sfx(R.raw.click)
        }
        if (lines >= levels.level * LINES_PER_LEVEL) {
            sfx(R.raw.generic_success)
            levels.completeLevel()
        }

        val idx = randomShapeIndex()
        val next = COMPILER_SHAPES[idx]
        val startCol = spawnColumn(next)
        shapeIdx = idx
        piece = next
        row = 0
        col = startCol
        if (collides(clear.board, next, 0, startCol)) {
            sfx(R.raw.click_heavy)
            levels.gameOver(lines)
        }
    }

    fun reset() {
        board = emptyCompilerBoard()
        lines = 0
        levels.resetLevels()
        val idx = randomShapeIndex()
        shapeIdx = idx
        piece = COMPILER_SHAPES[idx]
        row = 0
        col = spawnColumn(piece)
    }

    LaunchedEffect(levels.phase, levels.level, running) {
        if (!running) return@LaunchedEffect
        while (levels.isPlaying) {
            delay(compilerSpeedFor(levels.level))
            drop()
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
                    Text(
                        "LVL ${levels.level} · LINES $lines · TIME ${formatGameTime(levels.timeLeft)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = Fog,
                    )
                    Spacer(Modifier.height(8.dp))
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CompilerBoard(
                            board = board,
                            piece = piece,
                            shapeIdx = shapeIdx,
                            row = row,
                            col = col,
                            onSwipe = { steer ->
                                when (steer) {
                                    Steer.LEFT -> moveBy(-1)
                                    Steer.RIGHT -> moveBy(1)
                                    Steer.DOWN -> drop()
                                    Steer.UP -> rotate()
                                }
                            },
                            overlay = {
                                ProgramOverlay(
                                    phase = levels.phase,
                                    level = levels.level,
                                    countdown = levels.countdown,
                                    lastXp = levels.lastXp,
                                    signedIn = signedIn,
                                    overTitle = "BUFFER OVERFLOW",
                                    scoreLabel = "LINES",
                                    score = lines,
                                    onStart = { levels.begin() },
                                    onRestart = { reset() },
                                )
                            },
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        ProgramKey("◀") { moveBy(-1) }
                        ProgramKey("↻") { rotate() }
                        ProgramKey("▼") { drop() }
                        ProgramKey("▶") { moveBy(1) }
                    }
                }
            }
        }
    }
}

/**
 * The playfield: a single Canvas drawing the stacked shards and the active one,
 * sized to the window's aspect (10:20), with swipe steering and the overlay.
 */
@Composable
private fun CompilerBoard(
    board: List<List<Int>>,
    piece: List<List<Int>>,
    shapeIdx: Int,
    row: Int,
    col: Int,
    onSwipe: (Steer) -> Unit,
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
                        val dir = resolveSteer(drift.x, drift.y, 40f)
                        if (dir != null) {
                            onSwipe(dir)
                            drift = Offset.Zero
                        }
                    },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        val boardWidth = min(maxWidth.value, maxHeight.value * COMPILER_COLS / COMPILER_ROWS)
        val boardHeight = boardWidth * COMPILER_ROWS / COMPILER_COLS
        Box(
            Modifier
                .size(boardWidth.dp, boardHeight.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(BOARD_BG)
                .border(1.dp, LineColor, RoundedCornerShape(6.dp)),
        ) {
            Canvas(Modifier.fillMaxSize()) {
                val cellW = size.width / COMPILER_COLS
                val cellH = size.height / COMPILER_ROWS

                // Stacked shards.
                for (r in 0 until COMPILER_ROWS) {
                    for (c in 0 until COMPILER_COLS) {
                        val value = board[r][c]
                        if (value == 0) continue
                        drawRect(
                            color = SHARD_COLORS.getOrElse(value - 1) { Bone },
                            topLeft = Offset(c * cellW + 1f, r * cellH + 1f),
                            size = Size(cellW - 2f, cellH - 2f),
                        )
                    }
                }

                // The falling shard.
                for (pr in piece.indices) {
                    for (pc in piece[pr].indices) {
                        if (piece[pr][pc] == 0) continue
                        val nr = row + pr
                        if (nr < 0) continue
                        drawRect(
                            color = SHARD_COLORS.getOrElse(shapeIdx) { Bone },
                            topLeft = Offset((col + pc) * cellW + 1f, nr * cellH + 1f),
                            size = Size(cellW - 2f, cellH - 2f),
                        )
                    }
                }
            }
            overlay()
        }
    }
}