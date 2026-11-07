package app.roam.android.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Covers the Kotlin mirror of `web/src/lib/game-xp.ts`. */
class GameXpTest {

    @Test
    fun `economy constants match the webapp`() {
        assertEquals(10, LEVEL_XP)
        assertEquals(100, WIN_XP)
        assertEquals(10, WIN_LEVEL)
        assertEquals(100, XP_LEVEL_CAP)
    }

    @Test
    fun `game-over XP is min of 500 and floor score over 10`() {
        assertEquals(0, gameOverXp(0))
        assertEquals(0, gameOverXp(9))
        assertEquals(1, gameOverXp(10))
        assertEquals(10, gameOverXp(100))
        assertEquals(123, gameOverXp(1234))
        assertEquals(500, gameOverXp(5000))
        assertEquals(500, gameOverXp(99999))
    }

    @Test
    fun `negative scores clamp to zero`() {
        assertEquals(0, gameOverXp(-5))
        assertEquals(0, gameOverXp(-500))
    }

    @Test
    fun `run ids are unique`() {
        val ids = List(50) { makeRunId() }
        assertEquals(ids.size, ids.toSet().size)
        assertTrue(ids.all { it.isNotBlank() })
        assertNotEquals(makeRunId(), makeRunId())
    }

    @Test
    fun `every handheld game has a server-accepted slug`() {
        // The GAMES allow-list in game-action/index.ts still covers the web-only
        // text adventures (underweb, substrate), which the handheld no longer ships.
        val accepted = setOf("snake", "minesweeper", "tetris", "asteroids", "frogger", "underweb", "substrate")
        val shipped = GameId.entries.map { it.slug }.toSet()
        assertTrue(accepted.containsAll(shipped))
    }

    @Test
    fun `award kinds serialise as the function expects`() {
        assertEquals("level", GameXpKind.LEVEL.slug)
        assertEquals("over", GameXpKind.OVER.slug)
        assertEquals("win", GameXpKind.WIN.slug)
    }
}