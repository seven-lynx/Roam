package app.roam.android.model

import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * FIREWALK board rules — the Kotlin port of `FroggerProgram.tsx`, an original
 * Roam-OS game. A probe packet climbs fifteen rows: rule-filter lanes kill it,
 * carrier packets ferry it across the dark static, and five open ports must be
 * reached. Pure data + functions so the movement logic unit-tests without
 * Compose.
 */

const val FIREWALK_COLS = 13
const val FIREWALK_ROWS = 15
const val FIREWALK_CELL = 34f
const val FIREWALK_START_COL = 6
const val FIREWALK_BOARD_WIDTH = FIREWALK_COLS * FIREWALK_CELL

val FIREWALK_GOAL_COLS = listOf(1, 3, 5, 7, 9)
const val FIREWALK_GOAL_COUNT = 5

/** What sits in a row. */
enum class FirewalkRow { GOAL, BUFFER, FILTER, STATIC, START }

/** Row 0 is the ports; the bottom row is the launch pad. */
val FIREWALK_ROW_KINDS: List<FirewalkRow> = listOf(
    FirewalkRow.GOAL,
    FirewalkRow.BUFFER,
    FirewalkRow.FILTER,
    FirewalkRow.FILTER,
    FirewalkRow.BUFFER,
    FirewalkRow.FILTER,
    FirewalkRow.FILTER,
    FirewalkRow.BUFFER,
    FirewalkRow.STATIC,
    FirewalkRow.STATIC,
    FirewalkRow.BUFFER,
    FirewalkRow.FILTER,
    FirewalkRow.FILTER,
    FirewalkRow.BUFFER,
    FirewalkRow.START,
)

/** One moving thing in a lane: a rule-filter or a carrier packet. */
data class LaneEntity(
    val x: Float,
    /** `1` drifts right, `-1` drifts left. */
    val dir: Int,
    /** Speed in pixels per animation frame. */
    val speed: Float,
    /** Width in cells. */
    val cells: Int,
)

/** A lane spec: direction, width, base speed, spacing and count. */
private data class LaneSpec(
    val dir: Int,
    val cells: Int,
    val baseSpeed: Float,
    val gap: Int,
    val count: Int,
)

private val LANE_SPECS: Map<Int, LaneSpec> = mapOf(
    2 to LaneSpec(1, 1, 1.15f, 6, 4),
    3 to LaneSpec(-1, 1, 1.35f, 7, 4),
    5 to LaneSpec(1, 2, 0.95f, 8, 3),
    6 to LaneSpec(-1, 1, 1.25f, 6, 4),
    11 to LaneSpec(1, 1, 1.05f, 6, 4),
    12 to LaneSpec(-1, 2, 0.85f, 8, 3),
    8 to LaneSpec(-1, 3, 0.70f, 9, 3),
    9 to LaneSpec(1, 3, 0.82f, 9, 3),
)

/** Builds every lane for [level]; each level shifts the traffic 12% faster. */
fun buildLanes(level: Int, random: Random = Random.Default): Map<Int, List<LaneEntity>> {
    val scale = 1f + (level - 1) * 0.12f
    return LANE_SPECS.mapValues { (_, spec) ->
        List(spec.count) { i ->
            LaneEntity(
                x = i * spec.gap * FIREWALK_CELL + random.nextFloat() * FIREWALK_CELL,
                dir = spec.dir,
                speed = spec.baseSpeed * scale,
                cells = spec.cells,
            )
        }
    }
}

/** The whole playfield state. */
data class FirewalkState(
    val playerX: Float,
    val playerRow: Int,
    /** Row the probe is riding, or null on the ground. */
    val rideRow: Int? = null,
    /** Index into that row's lane. */
    val rideIndex: Int? = null,
    /** Offset from the carrier's left edge, in pixels. */
    val rideOffset: Float = 0f,
    val lanes: Map<Int, List<LaneEntity>>,
    val goals: List<Boolean>,
    val score: Int = 0,
    val lives: Int = 3,
    val over: Boolean = false,
    val frame: Int = 0,
)

/** A fresh run at [level]. */
fun newFirewalk(level: Int = 1, random: Random = Random.Default): FirewalkState =
    FirewalkState(
        playerX = FIREWALK_START_COL * FIREWALK_CELL,
        playerRow = FIREWALK_ROWS - 1,
        lanes = buildLanes(level, random),
        goals = List(FIREWALK_GOAL_COUNT) { false },
    )

/** Back to the launch pad. */
fun respawn(state: FirewalkState): FirewalkState =
    state.copy(
        playerX = FIREWALK_START_COL * FIREWALK_CELL,
        playerRow = FIREWALK_ROWS - 1,
        rideRow = null,
        rideIndex = null,
        rideOffset = 0f,
    )

/** Loses a life, or ends the run when the last one goes. */
fun die(state: FirewalkState): FirewalkState {
    if (state.over) return state
    val lives = state.lives - 1
    return if (lives <= 0) state.copy(lives = 0, over = true) else respawn(state.copy(lives = lives))
}

/**
 * One hop. Snaps back onto the grid (rides drift), then resolves the target:
 * off-board or a sealed port kills the probe, an open port scores, and stepping
 * into the dark static only works if a carrier packet is underfoot.
 */
fun hop(state: FirewalkState, dc: Int, dr: Int): FirewalkState {
    if (state.over) return state

    val snapped = (state.playerX / FIREWALK_CELL).roundToInt() * FIREWALK_CELL
    val grounded = state.copy(playerX = snapped, rideRow = null, rideIndex = null, rideOffset = 0f)

    val nextX = snapped + dc * FIREWALK_CELL
    val nextRow = grounded.playerRow + dr
    val nextCol = (nextX / FIREWALK_CELL).toInt()

    if (nextX < 0f || nextCol >= FIREWALK_COLS) return die(grounded)
    if (nextRow < 0) return die(grounded) // past the top of the board
    if (nextRow >= FIREWALK_ROWS) return grounded // blocked at the launch pad

    if (nextRow == 0) {
        val goalIndex = FIREWALK_GOAL_COLS.indexOf(nextCol)
        if (goalIndex >= 0 && !grounded.goals[goalIndex]) {
            val goals = grounded.goals.toMutableList().also { it[goalIndex] = true }
            return respawn(grounded.copy(goals = goals, score = grounded.score + 50))
        }
        return die(grounded) // sealed cell, or a port that is already open
    }

    var next = grounded.copy(playerX = nextX, playerRow = nextRow)

    if (FIREWALK_ROW_KINDS[nextRow] == FirewalkRow.STATIC) {
        val lane = next.lanes[nextRow].orEmpty()
        val carrier = lane.indexOfFirst { entity ->
            nextX + FIREWALK_CELL > entity.x + 2f &&
                nextX < entity.x + entity.cells * FIREWALK_CELL - 2f
        }
        next = if (carrier >= 0) {
            next.copy(rideRow = nextRow, rideIndex = carrier, rideOffset = nextX - lane[carrier].x)
        } else {
            die(next)
        }
    }

    return next
}

/**
 * One animation frame: drifts every lane entity, carries the probe along, and
 * checks for a lost ride or a rule-filter collision.
 */
fun stepFirewalk(state: FirewalkState): FirewalkState {
    if (state.over) return state.copy(frame = state.frame + 1)

    var next = state.copy(frame = state.frame + 1)

    next = next.copy(
        lanes = next.lanes.mapValues { (_, entities) ->
            entities.map { entity ->
                val width = entity.cells * FIREWALK_CELL
                var x = entity.x + entity.dir * entity.speed
                if (entity.dir == 1 && x > FIREWALK_BOARD_WIDTH) x = -width
                else if (entity.dir == -1 && x + width < 0f) x = FIREWALK_BOARD_WIDTH
                entity.copy(x = x)
            }
        },
    )

    val rideRow = next.rideRow
    val rideIndex = next.rideIndex
    if (rideRow != null && rideIndex != null) {
        val carrier = next.lanes[rideRow]?.getOrNull(rideIndex) ?: return die(next)
        val x = carrier.x + next.rideOffset
        next = next.copy(playerX = x)
        if (x < 0f || x + FIREWALK_CELL > FIREWALK_BOARD_WIDTH) return die(next)
    }

    if (FIREWALK_ROW_KINDS[next.playerRow] == FirewalkRow.FILTER) {
        val lane = next.lanes[next.playerRow].orEmpty()
        val x = next.playerX
        val hit = lane.any { entity ->
            x + FIREWALK_CELL - 4f > entity.x && x + 4f < entity.x + entity.cells * FIREWALK_CELL
        }
        if (hit) return die(next)
    }

    return next
}

/** True once every port is open (the level is complete). */
fun isFirewalkComplete(state: FirewalkState): Boolean = state.goals.all { it }

/** Number of open ports. */
fun openPortCount(state: FirewalkState): Int = state.goals.count { it }