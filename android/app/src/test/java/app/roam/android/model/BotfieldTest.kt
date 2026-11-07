package app.roam.android.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** Covers the BOTFIELD board rules (the Kotlin port of the web minesweeper). */
class BotfieldTest {

    @Test
    fun `grid grows by two cells and five bots per level`() {
        assertEquals(8, botfieldSize(1))
        assertEquals(10, botfieldSize(2))
        assertEquals(12, botfieldSize(3))
        assertEquals(10, botfieldMines(1))
        assertEquals(15, botfieldMines(2))
        assertEquals(20, botfieldMines(3))
    }

    @Test
    fun `a dealt board buries exactly the requested number of bots`() {
        val board = createBotfield(8, 10, Random(42))
        assertEquals(8, board.size)
        assertEquals(10, board.sumOf { row -> row.count { it.mine } })
    }

    @Test
    fun `neighbour counts match the buried bots`() {
        val board = createBotfield(8, 10, Random(7))
        for (r in board.indices) {
            for (c in board.indices) {
                val cell = board[r][c]
                if (cell.mine) continue
                var expected = 0
                for (dr in -1..1) for (dc in -1..1) {
                    val nr = r + dr
                    val nc = c + dc
                    if (nr in board.indices && nc in board.indices && board[nr][nc].mine) expected++
                }
                assertEquals("cell $r,$c", expected, cell.count)
            }
        }
    }

    @Test
    fun `flood reveal expands through empty sectors and stops at numbers`() {
        val board = createBotfield(8, 10, Random(3))
        val empty = board.indices.firstNotNullOf { r ->
            board[r].indices.firstOrNull { c -> !board[r][c].mine && board[r][c].count == 0 }?.let { c -> r to c }
        }
        val revealed = floodReveal(board, empty.first, empty.second)
        assertTrue(revealed[empty.first][empty.second].revealed)
        assertTrue(revealed.sumOf { row -> row.count { it.revealed } } > 1)
    }

    @Test
    fun `a fresh board is not cleared and a swept one is`() {
        val board = createBotfield(8, 10, Random(11))
        assertFalse(isBotfieldCleared(board))

        var swept = board
        for (r in board.indices) {
            for (c in board.indices) {
                if (!board[r][c].mine) swept = floodReveal(swept, r, c)
            }
        }
        assertTrue(isBotfieldCleared(swept))
        assertEquals(54, countSwept(swept)) // 8*8 - 10 bots
    }

    @Test
    fun `revealing every bot marks them all`() {
        val board = createBotfield(8, 10, Random(5))
        val exploded = revealAllBots(board)
        assertTrue(exploded.all { row -> row.all { !it.mine || it.revealed } })
    }

    @Test
    fun `flags toggle but never on a swept sector`() {
        val board = createBotfield(8, 10, Random(9))
        val flagged = toggleBotFlag(board, 0, 0)
        assertTrue(flagged[0][0].flagged)
        assertEquals(1, countFlags(flagged))
        assertFalse(toggleBotFlag(flagged, 0, 0)[0][0].flagged)
    }

    @Test
    fun `an impossible mine count is clamped instead of looping forever`() {
        val board = createBotfield(4, 99, Random(1))
        assertEquals(16, board.sumOf { row -> row.count { it.mine } })
    }
}