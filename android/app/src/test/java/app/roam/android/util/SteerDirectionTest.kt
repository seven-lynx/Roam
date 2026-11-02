package app.roam.android.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SteerDirectionTest {

    @Test
    fun `right swipe steers right`() {
        assertEquals(Steer.RIGHT, resolveSteer(STEER_SWIPE_THRESHOLD_PX + 1f, 0f))
    }

    @Test
    fun `left swipe steers left`() {
        assertEquals(Steer.LEFT, resolveSteer(-(STEER_SWIPE_THRESHOLD_PX + 1f), 0f))
    }

    @Test
    fun `down swipe steers down`() {
        assertEquals(Steer.DOWN, resolveSteer(0f, STEER_SWIPE_THRESHOLD_PX + 1f))
    }

    @Test
    fun `up swipe steers up`() {
        assertEquals(Steer.UP, resolveSteer(0f, -(STEER_SWIPE_THRESHOLD_PX + 1f)))
    }

    @Test
    fun `below threshold returns null`() {
        assertNull(resolveSteer(STEER_SWIPE_THRESHOLD_PX, 0f))
        assertNull(resolveSteer(0f, STEER_SWIPE_THRESHOLD_PX))
    }

    @Test
    fun `dominant axis wins on diagonals`() {
        assertEquals(Steer.RIGHT, resolveSteer(200f, 50f))
        assertEquals(Steer.DOWN, resolveSteer(50f, 200f))
        assertEquals(Steer.LEFT, resolveSteer(-200f, 50f))
        assertEquals(Steer.UP, resolveSteer(50f, -200f))
    }

    @Test
    fun `perfect diagonal returns null`() {
        assertNull(resolveSteer(200f, 200f))
    }
}
