package app.roam.android.ui.component

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import app.roam.android.model.GameId
import app.roam.android.model.GameXpKind
import app.roam.android.model.LEVEL_XP
import app.roam.android.model.WIN_LEVEL
import app.roam.android.model.WIN_XP
import app.roam.android.model.XP_LEVEL_CAP
import app.roam.android.model.gameOverXp
import kotlinx.coroutines.delay

/**
 * The shared level loop for the in-OS action games — a Compose port of the web
 * `useGameLevel` hook (`web/src/components/programs/useGameLevel.ts`), so the
 * handheld runs the same READY → play → LEVEL COMPLETE → LEVEL START → play
 * cycle and awards exactly the same XP.
 */

/** Where a run currently sits in the level loop. */
enum class GamePhase { READY, PLAYING, COMPLETE, START, OVER }

/** How long the LEVEL COMPLETE interstitial stays up before the countdown. */
private const val COMPLETE_MS = 1400L

/** One step of the LEVEL START countdown. */
private const val COUNTDOWN_STEP_MS = 700L

/** Countdown start value for the LEVEL START interstitial. */
const val COUNTDOWN_FROM = 3

/** Awards game XP through `game-action`: game, kind, runId, level, score. */
typealias GameAward = (GameId, GameXpKind, String, Int?, Int?) -> Unit

/**
 * Drives the shared level loop. Games read [phase] / [level] inside their own
 * loops to pause during the interstitials and to apply per-level difficulty,
 * and call [completeLevel] / [gameOver] when the run ends.
 */
@Stable
class GameLevelController(
    val game: GameId,
    val runId: String,
    private val award: GameAward,
) {
    /** Current level (1-based). */
    var level by mutableIntStateOf(1)
        private set

    /** Current phase of the level loop. */
    var phase by mutableStateOf(GamePhase.READY)
        private set

    /** Countdown value while [phase] is [GamePhase.START]. */
    var countdown by mutableIntStateOf(COUNTDOWN_FROM)
        private set

    /** Most recent XP award (level clear or game over), for display. */
    var lastXp by mutableIntStateOf(0)
        private set

    /** Whether a user is signed in — guests play the same games but earn nothing. */
    var signedIn: Boolean = false

    /** True while the run should accept input. */
    val isPlaying: Boolean get() = phase == GamePhase.PLAYING

    /** Start the current level from the initial READY screen. */
    fun begin() {
        if (phase != GamePhase.READY) return
        phase = GamePhase.PLAYING
    }

    /** Call when the current level's win condition is met. */
    fun completeLevel() {
        if (phase != GamePhase.PLAYING) return
        val lvl = level
        val isWin = lvl == WIN_LEVEL
        phase = GamePhase.COMPLETE

        if (signedIn) {
            // Optimistic display: the server pays exactly these amounts, and the
            // award is idempotent so a retry cannot double-pay.
            lastXp = if (isWin) LEVEL_XP + WIN_XP else LEVEL_XP
            award(game, GameXpKind.LEVEL, runId, lvl, null)
            if (isWin) award(game, GameXpKind.WIN, runId, null, null)
        } else {
            lastXp = 0
        }
    }

    /** Call on death. Awards game-over XP only past [XP_LEVEL_CAP]. */
    fun gameOver(score: Int) {
        phase = GamePhase.OVER
        if (signedIn && level > XP_LEVEL_CAP) {
            val xp = gameOverXp(score)
            lastXp = xp
            if (xp > 0) award(game, GameXpKind.OVER, runId, level, score)
        } else {
            lastXp = 0
        }
    }

    /** Reset back to level 1 (restart). Keeps the runId so XP stays idempotent. */
    fun resetLevels() {
        level = 1
        countdown = COUNTDOWN_FROM
        lastXp = 0
        phase = GamePhase.READY
    }

    /** COMPLETE → the next level's countdown. */
    internal fun advance() {
        if (phase != GamePhase.COMPLETE) return
        level += 1
        countdown = COUNTDOWN_FROM
        phase = GamePhase.START
    }

    /** One countdown step; ends the interstitial once it reaches zero. */
    internal fun tickCountdown() {
        if (phase != GamePhase.START) return
        if (countdown <= 0) {
            phase = GamePhase.PLAYING
        } else {
            countdown -= 1
        }
    }
}

/**
 * Remembers a [GameLevelController] and runs its interstitial timers. The
 * controller keeps running across recompositions; only the run identity
 * ([game] + [runId]) resets it.
 */
@Composable
fun rememberGameLevel(
    game: GameId,
    runId: String,
    signedIn: Boolean,
    onAward: GameAward,
): GameLevelController {
    val controller = remember(game, runId) { GameLevelController(game, runId, onAward) }
    controller.signedIn = signedIn

    LaunchedEffect(controller.phase) {
        if (controller.phase == GamePhase.COMPLETE) {
            delay(COMPLETE_MS)
            controller.advance()
        }
    }

    LaunchedEffect(controller.phase, controller.countdown) {
        if (controller.phase == GamePhase.START) {
            delay(COUNTDOWN_STEP_MS)
            controller.tickCountdown()
        }
    }

    return controller
}