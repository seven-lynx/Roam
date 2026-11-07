package app.roam.android.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** Covers the COMPILER board rules (the Kotlin port of the web MiniTetris). */
class CompilerTest {

    @Test
    fun `seven shards, each with at least one filled cell`() {
        assertEquals(7, COMPILER_SHAPES.size)
        COMPILER_SHAPES.forEach { shape ->
            assertTrue(shape.isNotEmpty())
            assertTrue(shape.all { row -> row.isNotEmpty() })
            assertTrue(shape.any { row -> row.any { it == 1 } })
        }
    }

    @Test
    fun `rotating four times returns the original shard`() {
        COMPILER_SHAPES.forEach { shape ->
            var rotated = shape
            repeat(4) { rotated = rotatePiece(rotated) }
            assertEquals(shape, rotated)
        }
    }

    @Test
    fun `rotating the long shard transposes it`() {
        val bar = listOf(listOf(1, 1, 1, 1))
        val rotated = rotatePiece(bar)
        assertEquals(4, rotated.size)
        assertEquals(1, rotated.first().size)
    }

    @Test
    fun `an empty board accepts a shard in the middle but not off the edges`() {
        val board = emptyCompilerBoard()
        val square = COMPILER_SHAPES[1]
        assertFalse(collides(board, square, 0, 0))
        assertTrue(collides(board, square, 0, -1))
        assertTrue(collides(board, square, 0, COMPILER_COLS - 1))
        assertTrue(collides(board, square, COMPILER_ROWS - 1, 0))
    }

    @Test
    fun `a stacked shard blocks the one above it`() {
        val board = mergePiece(emptyCompilerBoard(), COMPILER_SHAPES[1], COMPILER_ROWS - 2, 4, 1)
        assertTrue(collides(board, COMPILER_SHAPES[1], COMPILER_ROWS - 2, 4))
        assertFalse(collides(board, COMPILER_SHAPES[1], 0, 4))
    }

    @Test
    fun `a full row compiles out and everything above drops`() {
        val full = List(COMPILER_ROWS) { row ->
            List(COMPILER_COLS) { col -> if (row == COMPILER_ROWS - 1) 1 else if (col == 0) 1 else 0 }
        }
        val cleared = clearLines(full)
        assertEquals(1, cleared.cleared)
        assertEquals(COMPILER_ROWS, cleared.board.size)
        // The single remaining block has fallen to the bottom row.
        assertEquals(1, cleared.board[COMPILER_ROWS - 1][0])
    }

    @Test
    fun `an incomplete board clears nothing`() {
        val board = mergePiece(emptyCompilerBoard(), COMPILER_SHAPES[0], 0, 0, 1)
        val cleared = clearLines(board)
        assertEquals(0, cleared.cleared)
        assertEquals(board, cleared.board)
    }

    @Test
    fun `the drop interval tightens then clamps at 200ms`() {
        assertEquals(500L, compilerSpeedFor(1))
        assertEquals(470L, compilerSpeedFor(2))
        assertEquals(200L, compilerSpeedFor(20))
        assertEquals(200L, compilerSpeedFor(99))
    }

    @Test
    fun `spawn column centres the shard`() {
        assertEquals(4, spawnColumn(COMPILER_SHAPES[1])) // 2 wide -> (10-2)/2
        assertEquals(3, spawnColumn(COMPILER_SHAPES[0])) // 4 wide -> (10-4)/2
    }

    @Test
    fun `random shard index stays in range`() {
        val random = Random(4)
        repeat(100) {
            val index = randomShapeIndex(random)
            assertTrue(index in COMPILER_SHAPES.indices)
        }
    }
}