package app.roam.android.ui.component

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers the deck system-readout marquee maths (`ControlDeck.kt`). The strip is
 * drawn by repeating the message tile enough times to cover it plus one whole
 * tile, so scrolling by exactly one tile width wraps without a gap — the row has
 * to be measured unbounded or every copy after the first collapses to nothing.
 */
class ControlDeckReadoutTest {

    @Test
    fun `tile width adds the gap and never collapses`() {
        assertEquals(116f, readoutTileWidth(100f, 16f), 0.001f)
        assertEquals(1f, readoutTileWidth(0f, 0f), 0.001f)
    }

    @Test
    fun `tile count covers the strip plus one whole tile`() {
        val cases = listOf(
            100f to 40f,
            300f to 41.5f,
            297f to 401f, // message wider than the strip
            1200f to 16f, // very short message on a wide strip
        )
        for ((container, tile) in cases) {
            val tiles = readoutTileCount(container, tile)
            assertTrue("$tiles tiles cover $container px with $tile px tiles", tiles * tile >= container + tile)
            assertTrue("$tiles tiles is enough to fill the strip", tiles >= 2)
        }
    }

    @Test
    fun `tile count falls back to two before anything is measured`() {
        assertEquals(2, readoutTileCount(0f, 100f))
        assertEquals(2, readoutTileCount(400f, 0f))
    }

    @Test
    fun `loop time shortens as speed rises and never drops below half a second`() {
        val slow = readoutLoopMs(600f, 1)
        val fast = readoutLoopMs(600f, 10)
        assertTrue("fast ($fast ms) should beat slow ($slow ms)", fast < slow)
        assertEquals(500, readoutLoopMs(1f, 10))
    }

    @Test
    fun `out of range speeds clamp to the settings slider range`() {
        assertEquals(readoutLoopMs(600f, 1), readoutLoopMs(600f, 0))
        assertEquals(readoutLoopMs(600f, 10), readoutLoopMs(600f, 42))
    }
}
