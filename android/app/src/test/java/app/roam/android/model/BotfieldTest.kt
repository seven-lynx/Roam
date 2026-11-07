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

    private fun boardFrom(rows: List<String>): BotBoard {
        val size = rows.size
        val cells = rows.map { row -> row.map { ch -> BotCell(mine = ch == '*') }.toMutableList() }.toMutableList()
        for (r in 0 until size) {
            for (c in 0 until size) {
                if (cells[r][c].mine) continue
                var n = 0
                for (dr in -1..1) for (dc in -1..1) {
                    val nr = r + dr
                    val nc = c + dc
                    if (nr in 0 until size && nc in 0 until size && cells[nr][nc].mine) n++
                }
                cells[r][c] = cells[r][c].copy(count = n)
            }
        }
        return cells.map { it.toList() }
    }

    @Test
    fun `the first sweep never hits a bot and opens an area`() {
        for (seed in 0 until 40) {
            val board = createBotfield(8, 10, Random(seed + 1))
            val safe = ensureFirstClickSafe(board, 3, 3, Random(seed + 500))
            for (dr in -1..1) for (dc in -1..1) {
                val r = 3 + dr
                val c = 3 + dc
                if (r in 0 until 8 && c in 0 until 8) assertFalse("bot under $r,$c", safe[r][c].mine)
            }
            assertEquals(0, safe[3][3].count)
            assertEquals(10, safe.sumOf { row -> row.count { it.mine } })
            assertTrue(countSwept(floodReveal(safe, 3, 3)) > 1)
        }
    }

    @Test
    fun `chording opens neighbours when flags match the number`() {
        val board = boardFrom(listOf("*.", "..")).map { it.toMutableList() }.toMutableList()
        board[0][1] = board[0][1].copy(revealed = true)
        board[0][0] = board[0][0].copy(flagged = true)
        val result = chordReveal(board.map { it.toList() }, 0, 1)
        assertFalse(result.hitMine)
        assertTrue(result.board[1][0].revealed)
        assertTrue(result.board[1][1].revealed)
    }

    @Test
    fun `chording does nothing when flags do not match`() {
        val board = boardFrom(listOf("*.", "..")).map { it.toMutableList() }.toMutableList()
        board[0][1] = board[0][1].copy(revealed = true)
        val frozen = board.map { it.toList() }
        val result = chordReveal(frozen, 0, 1)
        assertFalse(result.hitMine)
        assertTrue(result.board === frozen)
        assertFalse(result.board[1][0].revealed)
    }

    @Test
    fun `chording detonates when a wrong flag leaves a real bot unmarked`() {
        val board = boardFrom(listOf(".*", "..")).map { it.toMutableList() }.toMutableList()
        board[0][0] = board[0][0].copy(revealed = true)
        board[1][0] = board[1][0].copy(flagged = true)
        val result = chordReveal(board.map { it.toList() }, 0, 0)
        assertTrue(result.hitMine)
        assertTrue(result.board[0][1].revealed)
    }

    @Test
    fun `chording ignores a covered sector or a mine`() {
        val board = boardFrom(listOf("*.", ".."))
        assertTrue(chordReveal(board, 0, 1).board === board)
        assertTrue(chordReveal(board, 0, 0).board === board)
    }
}