package app.roam.android.ui.component

import app.roam.android.model.GameId
import app.roam.android.model.GameXpKind
import app.roam.android.model.LEVEL_XP
import app.roam.android.model.WIN_LEVEL
import app.roam.android.model.WIN_XP
import app.roam.android.model.XP_LEVEL_CAP
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers the shared level loop — the Compose port of the web `useGameLevel`
 * hook: phases, XP awards and the win level.
 */
class GameLevelTest {

    private class Award(val kind: GameXpKind, val level: Int?, val score: Int?)

    private class Recorder {
        val awards = mutableListOf<Award>()
    }

    private fun controller(signedIn: Boolean = true, recorder: Recorder = Recorder()): GameLevelController =
        GameLevelController(GameId.SNAKE, "run-1") { _, kind, _, level, score ->
            recorder.awards += Award(kind, level, score)
        }.also { it.signedIn = signedIn }

    /** Clears the current level, then runs the countdown back into play. */
    private fun GameLevelController.clearAndContinue() {
        completeLevel()
        advance()
        repeat(COUNTDOWN_FROM + 1) { tickCountdown() }
        assertEquals(GamePhase.PLAYING, phase)
    }

    @Test
    fun `a new run starts ready on level one`() {
        val levels = controller()
        assertEquals(1, levels.level)
        assertEquals(GamePhase.READY, levels.phase)
        assertFalse(levels.isPlaying)
        assertEquals(0, levels.lastXp)
    }

    @Test
    fun `begin moves into play once`() {
        val levels = controller()
        levels.begin()
        assertEquals(GamePhase.PLAYING, levels.phase)
        assertTrue(levels.isPlaying)
    }

    @Test
    fun `clearing a level pays the flat level XP`() {
        val recorder = Recorder()
        val levels = controller(recorder = recorder)
        levels.begin()
        levels.completeLevel()

        assertEquals(GamePhase.COMPLETE, levels.phase)
        assertEquals(LEVEL_XP, levels.lastXp)
        assertEquals(1, recorder.awards.size)
        assertEquals(GameXpKind.LEVEL, recorder.awards.first().kind)
        assertEquals(1, recorder.awards.first().level)
    }

    @Test
    fun `advance counts down into the next level`() {
        val levels = controller()
        levels.begin()
        levels.completeLevel()
        levels.advance()

        assertEquals(2, levels.level)
        assertEquals(GamePhase.START, levels.phase)

        repeat(COUNTDOWN_FROM) { levels.tickCountdown() }
        assertEquals(0, levels.countdown)

        levels.tickCountdown()
        assertEquals(GamePhase.PLAYING, levels.phase)
    }

    @Test
    fun `clearing the win level also pays the win bonus`() {
        val recorder = Recorder()
        val levels = controller(recorder = recorder)
        levels.begin()
        repeat(WIN_LEVEL - 1) { levels.clearAndContinue() }
        assertEquals(WIN_LEVEL, levels.level)
        recorder.awards.clear()

        levels.completeLevel()

        assertEquals(LEVEL_XP + WIN_XP, levels.lastXp)
        assertEquals(2, recorder.awards.size)
        assertEquals(listOf(GameXpKind.LEVEL, GameXpKind.WIN), recorder.awards.map { it.kind })
    }

    @Test
    fun `game over pays nothing before the level cap`() {
        val recorder = Recorder()
        val levels = controller(recorder = recorder)
        levels.begin()
        levels.gameOver(900)

        assertEquals(GamePhase.OVER, levels.phase)
        assertEquals(0, levels.lastXp)
        assertTrue(recorder.awards.isEmpty())
    }

    @Test
    fun `game over past the cap pays the score bonus`() {
        val recorder = Recorder()
        val levels = controller(recorder = recorder)
        levels.begin()
        repeat(XP_LEVEL_CAP) { levels.clearAndContinue() }
        assertTrue(levels.level > XP_LEVEL_CAP)
        // The cap loop above recorded 100 LEVEL awards (plus the WIN at level 10);
        // clear them so the assertions below see only the game-over award.
        recorder.awards.clear()

        levels.gameOver(500)

        assertEquals(1, recorder.awards.size)
        assertEquals(GameXpKind.OVER, recorder.awards.first().kind)
        assertEquals(500, recorder.awards.first().score)
        assertEquals(50, levels.lastXp)
    }

    @Test
    fun `a guest plays the same run but earns nothing`() {
        val recorder = Recorder()
        val levels = controller(signedIn = false, recorder = recorder)
        levels.begin()
        levels.completeLevel()

        assertEquals(GamePhase.COMPLETE, levels.phase)
        assertEquals(0, levels.lastXp)
        assertTrue(recorder.awards.isEmpty())
    }

    @Test
    fun `reset returns to a fresh ready level one`() {
        val levels = controller()
        levels.begin()
        levels.completeLevel()
        levels.advance()
        levels.begin()
        levels.gameOver(0)

        levels.resetLevels()

        assertEquals(1, levels.level)
        assertEquals(GamePhase.READY, levels.phase)
        assertEquals(0, levels.lastXp)
    }
}