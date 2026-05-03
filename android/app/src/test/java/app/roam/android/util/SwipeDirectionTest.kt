package app.roam.android.util

import org.junit.Assert.*
import org.junit.Test

class SwipeDirectionTest {

    // ─── Threshold boundary ────────────────────────────────────────────────────

    @Test
    fun `downward drag exactly at threshold does not trigger`() {
        assertNull(resolveSwipeAction(0f, DEFAULT_SWIPE_THRESHOLD_PX))
    }

    @Test
    fun `downward drag just above threshold triggers roam`() {
        assertEquals("roam", resolveSwipeAction(0f, DEFAULT_SWIPE_THRESHOLD_PX + 1f))
    }

    @Test
    fun `rightward drag exactly at threshold does not trigger`() {
        assertNull(resolveSwipeAction(DEFAULT_SWIPE_THRESHOLD_PX, 0f))
    }

    @Test
    fun `rightward drag just above threshold triggers like`() {
        assertEquals("like", resolveSwipeAction(DEFAULT_SWIPE_THRESHOLD_PX + 1f, 0f))
    }

    @Test
    fun `leftward drag exactly at threshold does not trigger`() {
        assertNull(resolveSwipeAction(-DEFAULT_SWIPE_THRESHOLD_PX, 0f))
    }

    @Test
    fun `leftward drag just beyond threshold triggers skip`() {
        assertEquals("skip", resolveSwipeAction(-(DEFAULT_SWIPE_THRESHOLD_PX + 1f), 0f))
    }

    // ─── Dominant axis ────────────────────────────────────────────────────────

    @Test
    fun `diagonal where dx dominates triggers like`() {
        assertEquals("like", resolveSwipeAction(dx = 200f, dy = 50f))
    }

    @Test
    fun `diagonal where dy dominates triggers roam`() {
        assertEquals("roam", resolveSwipeAction(dx = 50f, dy = 200f))
    }

    @Test
    fun `diagonal where negative dx dominates triggers skip`() {
        assertEquals("skip", resolveSwipeAction(dx = -200f, dy = 50f))
    }

    @Test
    fun `perfect diagonal 45 degrees returns null because axes are equal`() {
        // abs(dx) == abs(dy) so no axis dominates
        assertNull(resolveSwipeAction(200f, 200f))
    }

    // ─── Short swipe ──────────────────────────────────────────────────────────

    @Test
    fun `zero drag returns null`() {
        assertNull(resolveSwipeAction(0f, 0f))
    }

    @Test
    fun `small drag in all directions returns null`() {
        assertNull(resolveSwipeAction(10f, 10f))
        assertNull(resolveSwipeAction(-10f, 10f))
        assertNull(resolveSwipeAction(10f, -10f))
    }

    // ─── Upward swipe is not a recognized action ───────────────────────────────

    @Test
    fun `upward swipe returns null regardless of magnitude`() {
        // dy is negative for upward drag; only positive dy maps to "roam"
        assertNull(resolveSwipeAction(0f, -500f))
    }

    // ─── Custom threshold ─────────────────────────────────────────────────────

    @Test
    fun `custom threshold overrides the default`() {
        // With threshold = 200, a 150 dy drag should NOT trigger
        assertNull(resolveSwipeAction(0f, 150f, threshold = 200f))
        // But a 250 dy drag SHOULD trigger
        assertEquals("roam", resolveSwipeAction(0f, 250f, threshold = 200f))
    }

    @Test
    fun `custom threshold of zero triggers for any nonzero dominant drag`() {
        assertEquals("roam", resolveSwipeAction(0f, 1f, threshold = 0f))
        assertEquals("like", resolveSwipeAction(1f, 0f, threshold = 0f))
        assertEquals("skip", resolveSwipeAction(-1f, 0f, threshold = 0f))
    }
}
