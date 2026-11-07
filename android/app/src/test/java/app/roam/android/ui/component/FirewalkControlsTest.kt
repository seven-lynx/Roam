package app.roam.android.ui.component

import app.roam.android.util.Steer
import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.math.abs

/**
 * Covers FIREWALK's steering maths (`FirewalkProgram.kt`). Swipes, the on-screen
 * D-pad and the analog stick all resolve a [Steer] through `firewalkHopDelta`, so
 * the row/column convention is stated once: row 0 is the ports, the launch pad is
 * the bottom row, and a steering intent is always one orthogonal hop.
 */
class FirewalkControlsTest {

    @Test
    fun `steering up climbs toward the ports`() {
        assertEquals(0 to -1, firewalkHopDelta(Steer.UP))
    }

    @Test
    fun `steering down drops toward the launch pad`() {
        assertEquals(0 to 1, firewalkHopDelta(Steer.DOWN))
    }

    @Test
    fun `steering left and right move one column on the same row`() {
        assertEquals(-1 to 0, firewalkHopDelta(Steer.LEFT))
        assertEquals(1 to 0, firewalkHopDelta(Steer.RIGHT))
    }

    @Test
    fun `every steer is a single orthogonal hop`() {
        for (steer in Steer.entries) {
            val (dc, dr) = firewalkHopDelta(steer)
            assertEquals("$steer must hop exactly one cell", 1, abs(dc) + abs(dr))
        }
    }
}
