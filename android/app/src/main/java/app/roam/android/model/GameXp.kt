package app.roam.android.model

import kotlinx.serialization.Serializable
import java.util.UUID
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * Game XP for the in-device programs — the Kotlin mirror of
 * `web/src/lib/game-xp.ts`, so the handheld awards exactly what the webapp does.
 *
 * Games award ordinary Roam XP through the unified `game-action` edge function
 * (which calls `apply_xp()`), not a separate game economy. Badges, level-ups and
 * celebrations then arrive through the normal notification pipeline that
 * [app.roam.android.model.CelebrationEvent] already consumes.
 */

/**
 * The games the handheld ships. A subset of the `game-action` GAMES allow-list:
 * the webapp's text adventures (UNDERWEB, SUBSTRATE) have no Android build.
 */
enum class GameId(val slug: String) {
    SNAKE("snake"),
    MINESWEEPER("minesweeper"),
    TETRIS("tetris"),
    ASTEROIDS("asteroids"),
    FROGGER("frogger"),
}

/** What a game event is: a cleared level, a completed run, or a scored death. */
enum class GameXpKind(val slug: String) {
    LEVEL("level"),
    OVER("over"),
    WIN("win"),
}

/** Flat XP awarded for clearing a single level (levels 1..[XP_LEVEL_CAP]). */
const val LEVEL_XP = 10

/**
 * Flat XP awarded for winning a game — an arcade game clearing [WIN_LEVEL]
 * (this shelf's games have no natural end state).
 */
const val WIN_XP = 100

/**
 * Arcade games (RELAY / BOTFIELD / COMPILER / DEBRIS / FIREWALK) are endless, so
 * "win" is defined as clearing this level — near the difficulty cap for all of
 * them, so the win badge is a real milestone rather than a trivial clear.
 */
const val WIN_LEVEL = 10

/** The highest level that still awards per-level XP; after this the run is endless. */
const val XP_LEVEL_CAP = 100

/** Unique per-run id for idempotent XP awards. */
fun makeRunId(): String = UUID.randomUUID().toString()

/**
 * Game-over bonus XP, only awarded after a run has cleared [XP_LEVEL_CAP].
 * `min(500, floor(score / 10))` — score is whatever the game reports.
 */
fun gameOverXp(score: Int): Int {
    val s = max(0, floor(score.toDouble()).toInt())
    return min(500, s / 10)
}

/** The award the edge function reports back, for the in-game XP flash. */
@Serializable
data class GameXpAward(
    val xpAwarded: Int = 0,
    val newLevel: Int = 0,
    val newXpTotal: Long = 0,
)