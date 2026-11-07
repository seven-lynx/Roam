package app.roam.android.model

import kotlin.math.abs
import kotlin.random.Random

/**
 * BOTFIELD board rules — the Kotlin port of `MinesweeperProgram.tsx`
 * (zeli-web-games "Minesweeper", Apache-2.0). Pure data + functions so the
 * board logic unit-tests without Compose.
 */

/** Grid dimension on level 1; each level adds two rows and two columns. */
const val BOTFIELD_BASE_SIZE = 8

/** Buried bots on level 1; each level buries five more. */
const val BOTFIELD_BASE_MINES = 10

/** Grid dimension per level: 8 → 10 → 12 → … */
fun botfieldSize(level: Int): Int = BOTFIELD_BASE_SIZE + (level - 1) * 2

/** Buried bots per level: 10 → 15 → 20 → … */
fun botfieldMines(level: Int): Int = BOTFIELD_BASE_MINES + (level - 1) * 5

/** One sector of the board. */
data class BotCell(
    val mine: Boolean = false,
    val revealed: Boolean = false,
    val flagged: Boolean = false,
    /** Adjacent bots; only meaningful on a non-mine cell. */
    val count: Int = 0,
)

/** A square board; `board[row][col]`. */
typealias BotBoard = List<List<BotCell>>

/** Deals a fresh board: [mines] buried at random, neighbour counts filled in. */
fun createBotfield(size: Int, mines: Int, random: Random = Random.Default): BotBoard {
    val cells = MutableList(size) { MutableList(size) { BotCell() } }
    var placed = 0
    // Guard against an impossible board rather than looping forever.
    val target = mines.coerceAtMost(size * size)
    while (placed < target) {
        val r = random.nextInt(size)
        val c = random.nextInt(size)
        if (!cells[r][c].mine) {
            cells[r][c] = cells[r][c].copy(mine = true)
            placed++
        }
    }
    for (r in 0 until size) {
        for (c in 0 until size) {
            if (cells[r][c].mine) continue
            var neighbours = 0
            for (dr in -1..1) {
                for (dc in -1..1) {
                    val nr = r + dr
                    val nc = c + dc
                    if (nr in 0 until size && nc in 0 until size && cells[nr][nc].mine) neighbours++
                }
            }
            cells[r][c] = cells[r][c].copy(count = neighbours)
        }
    }
    return cells.map { it.toList() }
}

/** Replaces one cell, leaving the rest of the board untouched. */
private fun BotBoard.with(row: Int, col: Int, cell: BotCell): BotBoard =
    mapIndexed { r, cells -> if (r == row) cells.toMutableList().also { it[col] = cell } else cells }

/**
 * The classic flood fill: reveals [row]/[col] and, for every empty sector it
 * touches, its eight neighbours. Flagged and already-revealed sectors stop it.
 */
fun floodReveal(board: BotBoard, row: Int, col: Int): BotBoard {
    require(board.isNotEmpty()) { "board must not be empty" }
    val size = board.size
    val cells = board.map { it.toMutableList() }.toMutableList()
    val stack = ArrayDeque<Pair<Int, Int>>()
    stack.addLast(row to col)
    while (stack.isNotEmpty()) {
        val (r, c) = stack.removeLast()
        if (r !in 0 until size || c !in 0 until size) continue
        val cell = cells[r][c]
        if (cell.revealed || cell.flagged) continue
        cells[r][c] = cell.copy(revealed = true)
        if (cell.count == 0 && !cell.mine) {
            for (dr in -1..1) {
                for (dc in -1..1) {
                    stack.addLast((r + dr) to (c + dc))
                }
            }
        }
    }
    return cells.map { it.toList() }
}

/** True when every clean sector has been swept. */
fun isBotfieldCleared(board: BotBoard): Boolean =
    board.all { row -> row.all { it.mine || it.revealed } }

/** Reveals every buried bot — the game-over board. */
fun revealAllBots(board: BotBoard): BotBoard =
    board.map { row -> row.map { if (it.mine) it.copy(revealed = true) else it } }

/** Toggles the flag on a sector that has not been swept yet. */
fun toggleBotFlag(board: BotBoard, row: Int, col: Int): BotBoard {
    val cell = board[row][col]
    if (cell.revealed) return board
    return board.with(row, col, cell.copy(flagged = !cell.flagged))
}

/** Number of flagged sectors. */
fun countFlags(board: BotBoard): Int = board.sumOf { row -> row.count { it.flagged } }

/** Number of clean sectors swept — the score shown on the overlay. */
fun countSwept(board: BotBoard): Int = board.sumOf { row -> row.count { it.revealed && !it.mine } }

/**
 * Guarantees the first sweep of a level is safe and opens an area: any bot in
 * the 3×3 around [row]/[col] is relocated to a random clean sector outside that
 * zone, then the neighbour counts are rebuilt. Modern Minesweeper never lets the
 * opening click hit a mine.
 */
fun ensureFirstClickSafe(board: BotBoard, row: Int, col: Int, random: Random = Random.Default): BotBoard {
    val size = board.size
    val cells = board.map { it.toMutableList() }.toMutableList()

    var removed = 0
    for (dr in -1..1) {
        for (dc in -1..1) {
            val r = row + dr
            val c = col + dc
            if (r in 0 until size && c in 0 until size && cells[r][c].mine) {
                cells[r][c] = cells[r][c].copy(mine = false)
                removed++
            }
        }
    }

    // Candidate clean sectors outside the safe zone to receive the moved bots.
    val candidates = mutableListOf<Pair<Int, Int>>()
    for (r in 0 until size) {
        for (c in 0 until size) {
            val inZone = abs(r - row) <= 1 && abs(c - col) <= 1
            if (!inZone && !cells[r][c].mine) candidates.add(r to c)
        }
    }
    var moved = 0
    while (moved < removed && candidates.isNotEmpty()) {
        val (r, c) = candidates.removeAt(random.nextInt(candidates.size))
        cells[r][c] = cells[r][c].copy(mine = true)
        moved++
    }

    // Recompute neighbour counts from the new layout.
    for (r in 0 until size) {
        for (c in 0 until size) {
            if (cells[r][c].mine) {
                cells[r][c] = cells[r][c].copy(count = 0)
                continue
            }
            var neighbours = 0
            for (dr in -1..1) {
                for (dc in -1..1) {
                    val nr = r + dr
                    val nc = c + dc
                    if (nr in 0 until size && nc in 0 until size && cells[nr][nc].mine) neighbours++
                }
            }
            cells[r][c] = cells[r][c].copy(count = neighbours)
        }
    }
    return cells.map { it.toList() }
}

/** Outcome of a chord: the resulting board and whether it set off a mine. */
data class ChordResult(val board: BotBoard, val hitMine: Boolean)

/**
 * Chording: clicking an already-revealed number whose adjacent flags equal that
 * number opens the remaining (unflagged) neighbours. If a flag is wrong and a
 * real mine sits under one of those neighbours, the board detonates and
 * [ChordResult.hitMine] is true (all mines revealed).
 */
fun chordReveal(board: BotBoard, row: Int, col: Int): ChordResult {
    val size = board.size
    val cell = board[row][col]
    if (!cell.revealed || cell.mine || cell.count == 0) return ChordResult(board, false)

    var adjacentFlags = 0
    val toOpen = mutableListOf<Pair<Int, Int>>()
    for (dr in -1..1) {
        for (dc in -1..1) {
            if (dr == 0 && dc == 0) continue
            val r = row + dr
            val c = col + dc
            if (r !in 0 until size || c !in 0 until size) continue
            val n = board[r][c]
            when {
                n.flagged -> adjacentFlags++
                !n.revealed -> toOpen.add(r to c)
            }
        }
    }

    if (adjacentFlags != cell.count || toOpen.isEmpty()) return ChordResult(board, false)
    if (toOpen.any { (r, c) -> board[r][c].mine }) return ChordResult(revealAllBots(board), true)

    var next = board
    for ((r, c) in toOpen) next = floodReveal(next, r, c)
    return ChordResult(next, false)
}