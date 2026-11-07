package app.roam.android.model

import kotlin.math.max
import kotlin.random.Random

/**
 * COMPILER board rules — the Kotlin port of `TetrisProgram.tsx` (zeli-web-games
 * "MiniTetris", Apache-2.0). Pure data + functions, so the grid logic is unit
 * tested without Compose.
 */

const val COMPILER_COLS = 10
const val COMPILER_ROWS = 20

/** Lines that must compile out before the level advances. */
const val LINES_PER_LEVEL = 5

const val COMPILER_BASE_DROP_MS = 500L
const val COMPILER_MIN_DROP_MS = 200L

/** Drop interval (ms) tightens as the level climbs. */
fun compilerSpeedFor(level: Int): Long =
    max(COMPILER_MIN_DROP_MS, COMPILER_BASE_DROP_MS - (level - 1) * 30L)

/** The seven falling shards; `1` marks a filled cell. */
val COMPILER_SHAPES: List<List<List<Int>>> = listOf(
    listOf(listOf(1, 1, 1, 1)),
    listOf(listOf(1, 1), listOf(1, 1)),
    listOf(listOf(0, 1, 0), listOf(1, 1, 1)),
    listOf(listOf(1, 0), listOf(1, 0), listOf(1, 1)),
    listOf(listOf(0, 1), listOf(0, 1), listOf(1, 1)),
    listOf(listOf(0, 1, 1), listOf(1, 1, 0)),
    listOf(listOf(1, 1, 0), listOf(0, 1, 1)),
)

/** An empty 10×20 board; every cell holds 0 (empty) or a 1-based shard colour. */
fun emptyCompilerBoard(): List<List<Int>> =
    List(COMPILER_ROWS) { List(COMPILER_COLS) { 0 } }

/** A random shard index. */
fun randomShapeIndex(random: Random = Random.Default): Int = random.nextInt(COMPILER_SHAPES.size)

/** Column that centres [shape] on the board. */
fun spawnColumn(shape: List<List<Int>>): Int = (COMPILER_COLS - shape.first().size) / 2

/** Rotates a shard 90° clockwise. */
fun rotatePiece(shape: List<List<Int>>): List<List<Int>> {
    val rows = shape.size
    val cols = shape.first().size
    return List(cols) { c -> List(rows) { r -> shape[rows - 1 - r][c] } }
}

/**
 * True when [shape] cannot sit at ([row], [col]) — off the board, or overlapping
 * a stacked shard.
 */
fun collides(board: List<List<Int>>, shape: List<List<Int>>, row: Int, col: Int): Boolean {
    for (r in shape.indices) {
        for (c in shape[r].indices) {
            if (shape[r][c] == 0) continue
            val nr = row + r
            val nc = col + c
            if (nr < 0 || nr >= COMPILER_ROWS || nc < 0 || nc >= COMPILER_COLS) return true
            if (board[nr][nc] != 0) return true
        }
    }
    return false
}

/** Stamps [shape] into [board] with the shard's [color]. */
fun mergePiece(
    board: List<List<Int>>,
    shape: List<List<Int>>,
    row: Int,
    col: Int,
    color: Int,
): List<List<Int>> {
    val next = board.map { it.toMutableList() }.toMutableList()
    for (r in shape.indices) {
        for (c in shape[r].indices) {
            if (shape[r][c] == 0) continue
            val nr = row + r
            val nc = col + c
            if (nr in 0 until COMPILER_ROWS && nc in 0 until COMPILER_COLS) next[nr][nc] = color
        }
    }
    return next.map { it.toList() }
}

/** Result of compiling full lines out of the board. */
data class CompilerClear(val board: List<List<Int>>, val cleared: Int)

/** Removes every full row and drops the rest down. */
fun clearLines(board: List<List<Int>>): CompilerClear {
    val kept = board.filter { row -> row.any { it == 0 } }
    val cleared = COMPILER_ROWS - kept.size
    val next = if (cleared == 0) board else List(cleared) { List(COMPILER_COLS) { 0 } } + kept
    return CompilerClear(next, cleared)
}