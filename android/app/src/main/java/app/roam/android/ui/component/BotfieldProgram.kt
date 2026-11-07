package app.roam.android.ui.component

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.roam.android.R
import app.roam.android.model.BotBoard
import app.roam.android.model.BotCell
import app.roam.android.model.GameId
import app.roam.android.model.botfieldMines
import app.roam.android.model.botfieldSize
import app.roam.android.model.countFlags
import app.roam.android.model.countSwept
import app.roam.android.model.createBotfield
import app.roam.android.model.floodReveal
import app.roam.android.model.isBotfieldCleared
import app.roam.android.model.makeRunId
import app.roam.android.model.program
import app.roam.android.model.revealAllBots
import app.roam.android.model.toggleBotFlag
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Danger
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.GoldBright
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Panel2
import app.roam.android.ui.theme.Panel3
import app.roam.android.ui.theme.TealBright
import app.roam.android.util.SoundManager
import kotlin.math.min

/**
 * BOTFIELD.EXE — ten bots buried in an eight-by-eight grid. A native Compose
 * port of the web `MinesweeperProgram` (zeli-web-games "Minesweeper",
 * Apache-2.0): tap to sweep, long-press (or FLAG MODE) to flag, and every
 * cleared board advances a level.
 */

/** Count colours for 1..8 adjacent bots, matching the web palette. */
private val COUNT_COLORS = listOf(
    Bone,
    TealBright,
    GoldBright,
    Danger,
    Bone,
    Danger,
    Bone,
    Fog,
)

@Composable
fun BotfieldProgram(
    soundEnabled: Boolean,
    signedIn: Boolean,
    onAward: GameAward,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = remember { requireNotNull(program("minesweeper")) { "BOTFIELD missing from registry" } }
    val context = LocalContext.current
    val runId = rememberSaveable { makeRunId() }
    val levels = rememberGameLevel(GameId.MINESWEEPER, runId, signedIn, onAward)

    var running by rememberSaveable { mutableStateOf(false) }
    var flagMode by rememberSaveable { mutableStateOf(false) }
    var restartNonce by remember { mutableIntStateOf(0) }
    var board by remember(levels.level, restartNonce) {
        mutableStateOf(createBotfield(botfieldSize(levels.level), botfieldMines(levels.level)))
    }

    fun sfx(resId: Int) {
        if (soundEnabled) SoundManager.play(context, resId)
    }

    fun reset() {
        flagMode = false
        restartNonce++
        board = createBotfield(botfieldSize(1), botfieldMines(1))
        levels.resetLevels()
    }

    fun sweep(row: Int, col: Int) {
        if (!levels.isPlaying) return
        val cell = board[row][col]
        if (cell.flagged || cell.revealed) return
        if (cell.mine) {
            val exploded = revealAllBots(board)
            board = exploded
            sfx(R.raw.click_heavy)
            levels.gameOver(countSwept(exploded))
            return
        }
        val next = floodReveal(board, row, col)
        board = next
        if (isBotfieldCleared(next)) {
            sfx(R.raw.generic_success)
            levels.completeLevel()
        } else {
            sfx(R.raw.click)
        }
    }

    fun flag(row: Int, col: Int) {
        if (!levels.isPlaying) return
        board = toggleBotFlag(board, row, col)
        sfx(R.raw.click_nav)
    }

    RoamOsWindow(title = meta.title, onClose = onClose, modifier = modifier) {
        Box(Modifier.fillMaxSize()) {
            if (!running) {
                ProgramGuide(meta) {
                    running = true
                    levels.begin()
                }
            } else {
                BotfieldBoard(
                    board = board,
                    level = levels.level,
                    mines = botfieldMines(levels.level),
                    flagMode = flagMode,
                    onToggleFlagMode = { flagMode = !flagMode },
                    onSweep = { r, c -> sweep(r, c) },
                    onFlag = { r, c -> flag(r, c) },
                    overlay = {
                        ProgramOverlay(
                            phase = levels.phase,
                            level = levels.level,
                            countdown = levels.countdown,
                            lastXp = levels.lastXp,
                            signedIn = signedIn,
                            overTitle = "SECTOR COMPROMISED",
                            scoreLabel = "SWEPT",
                            score = countSwept(board),
                            onStart = { levels.begin() },
                            onRestart = { reset() },
                        )
                    },
                )
            }
        }
    }
}

/**
 * The board itself: the HUD line, the square grid sized to fit the window, the
 * game overlay on top, and the FLAG MODE toggle underneath.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BotfieldBoard(
    board: BotBoard,
    level: Int,
    mines: Int,
    flagMode: Boolean,
    onToggleFlagMode: () -> Unit,
    onSweep: (Int, Int) -> Unit,
    onFlag: (Int, Int) -> Unit,
    overlay: @Composable BoxScope.() -> Unit,
) {
    val size = board.size
    val flags = countFlags(board)
    val swept = countSwept(board)

    Column(
        Modifier.fillMaxSize().padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "LVL $level · ● $mines · ⚑ $flags · $swept/${size * size - mines}",
            style = MaterialTheme.typography.labelSmall,
            color = Fog,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val cell = min(maxWidth.value, maxHeight.value) / size
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(
                    Modifier
                        .size(cell.dp * size)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Panel2)
                        .border(1.dp, LineColor, RoundedCornerShape(8.dp))
                        .padding(2.dp),
                ) {
                    for (r in 0 until size) {
                        Row {
                            for (c in 0 until size) {
                                BotfieldCellView(
                                    cell = board[r][c],
                                    cellSize = (cell - 0.5f).dp,
                                    onClick = { if (flagMode) onFlag(r, c) else onSweep(r, c) },
                                    onLongClick = { onFlag(r, c) },
                                )
                            }
                        }
                    }
                }
                overlay()
            }
        }
        Spacer(Modifier.height(6.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            ProgramActionKey(if (flagMode) "⚑ FLAG MODE" else "⚑ FLAG", onToggleFlagMode)
            Text(
                if (flagMode) "TAP to flag" else "TAP to sweep",
                style = MaterialTheme.typography.labelSmall,
                color = Fog,
            )
        }
    }
}

/** One sector: flag glyph, bot glyph, or the adjacent-bot count. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun BotfieldCellView(
    cell: BotCell,
    cellSize: Dp,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    val shown = when {
        cell.flagged && !cell.revealed -> "⚑"
        cell.revealed && cell.mine -> "●"
        cell.revealed && cell.count > 0 -> cell.count.toString()
        else -> ""
    }
    val background = when {
        cell.revealed && cell.mine -> Danger.copy(alpha = 0.25f)
        cell.revealed -> Panel3
        else -> Panel2
    }
    val foreground = if (cell.revealed && !cell.mine && cell.count > 0) {
        COUNT_COLORS.getOrElse(cell.count - 1) { Bone }
    } else {
        Bone
    }

    Box(
        Modifier
            .padding(1.dp)
            .size(cellSize)
            .clip(RoundedCornerShape(3.dp))
            .background(background)
            .border(1.dp, LineColor.copy(alpha = 0.5f), RoundedCornerShape(3.dp))
            .combinedClickable(onClick = onClick, onLongClick = onLongClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            shown,
            style = MaterialTheme.typography.labelMedium,
            color = foreground,
            textAlign = TextAlign.Center,
        )
    }
}