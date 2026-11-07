package app.roam.android.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** Covers the FIREWALK movement rules (the Kotlin port of the web frogger). */
class FirewalkTest {

    @Test
    fun `the board is fifteen rows with ports at the top`() {
        assertEquals(15, FIREWALK_ROW_KINDS.size)
        assertEquals(FirewalkRow.GOAL, FIREWALK_ROW_KINDS.first())
        assertEquals(FirewalkRow.START, FIREWALK_ROW_KINDS.last())
        assertEquals(5, FIREWALK_GOAL_COLS.size)
    }

    @Test
    fun `a fresh run starts on the launch pad with three lives`() {
        val state = newFirewalk(1, Random(1))
        assertEquals(FIREWALK_ROWS - 1, state.playerRow)
        assertEquals(FIREWALK_START_COL * FIREWALK_CELL, state.playerX, 0.01f)
        assertEquals(3, state.lives)
        assertEquals(0, state.score)
        assertEquals(FIREWALK_GOAL_COUNT, state.goals.size)
        assertFalse(state.over)
    }

    @Test
    fun `every lane row is populated and faster each level`() {
        val level1 = buildLanes(1, Random(2))
        val level2 = buildLanes(2, Random(2))
        assertTrue(level1.isNotEmpty())
        val row = level1.keys.first()
        assertTrue(requireNotNull(level2[row]).first().speed > requireNotNull(level1[row]).first().speed)
    }

    @Test
    fun `hopping up from the launch pad enters the buffer row`() {
        val state = hop(newFirewalk(1, Random(3)), 0, -1)
        assertEquals(FIREWALK_ROWS - 2, state.playerRow)
        assertEquals(3, state.lives)
    }

    @Test
    fun `hopping below the launch pad is blocked without a life lost`() {
        val state = hop(newFirewalk(1, Random(4)), 0, 1)
        assertEquals(FIREWALK_ROWS - 1, state.playerRow)
        assertEquals(3, state.lives)
    }

    @Test
    fun `hopping off the left edge costs a life`() {
        var state = newFirewalk(1, Random(5))
        repeat(FIREWALK_START_COL + 1) { state = hop(state, -1, 0) }
        assertEquals(2, state.lives)
        assertEquals(FIREWALK_START_COL * FIREWALK_CELL, state.playerX, 0.01f)
    }

    @Test
    fun `losing the last life ends the run`() {
        var state = newFirewalk(1, Random(6))
        var guard = 0
        // Walk off the left edge repeatedly: three deaths end the run.
        while (!state.over && guard++ < 200) {
            state = hop(state, -1, 0)
        }
        assertTrue(state.over)
        assertEquals(0, state.lives)
    }

    @Test
    fun `stepping into empty static without a carrier costs a life`() {
        var state = newFirewalk(1, Random(7))
        // Row 13 is a buffer, so climb into it, then into the static at row 12? No:
        // row 13 is BUFFER, row 12 is FILTER. Rebuild the probe directly onto a
        // static row instead, with no carrier beneath it.
        state = state.copy(playerRow = 7, playerX = 0f, lanes = emptyMap())
        val after = hop(state, 0, 1) // into row 8 (STATIC) with no carriers
        assertTrue(after.lives < state.lives || after.over)
    }

    @Test
    fun `reaching every port clears the level`() {
        var state = newFirewalk(1, Random(8))
        val goals = state.goals.toMutableList().also { it.indices.forEach { i -> it[i] = true } }
        state = state.copy(goals = goals)
        assertTrue(isFirewalkComplete(state))
        assertEquals(FIREWALK_GOAL_COUNT, openPortCount(state))
    }

    @Test
    fun `a frame drifts every lane entity`() {
        val state = newFirewalk(1, Random(9))
        val stepped = stepFirewalk(state)
        assertEquals(state.frame + 1, stepped.frame)
        assertNotNull(stepped.lanes)
        val row = state.lanes.keys.first()
        assertTrue(
            requireNotNull(state.lanes[row]).first().x != requireNotNull(stepped.lanes[row]).first().x,
        )
    }
}