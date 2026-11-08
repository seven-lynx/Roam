package app.roam.android.viewmodel

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers the deck readout copy (`DeckReadout`). The strip is a one-line marquee
 * tile, so every line has to stay inside [DeckReadout.MAX_LINE] and report real
 * state — see the state-line cases below.
 */
class DeckReadoutTest {

    private fun status(
        signedIn: Boolean = true,
        online: Boolean = true,
        savedCount: Int = 7,
        unreadCount: Int = 2,
        hotQueueSize: Int = 4,
        warmQueueSize: Int = 9,
        level: Int = 12,
        streakDays: Int = 3,
        xpToNextLevel: Long? = 240,
        focusActive: Boolean = false,
        collectionActive: Boolean = false,
        translating: Boolean = false,
    ) = DeckStatus(
        signedIn = signedIn,
        online = online,
        savedCount = savedCount,
        unreadCount = unreadCount,
        hotQueueSize = hotQueueSize,
        warmQueueSize = warmQueueSize,
        level = level,
        streakDays = streakDays,
        xpToNextLevel = xpToNextLevel,
        focusActive = focusActive,
        collectionActive = collectionActive,
        translating = translating,
    )

    @Test
    fun `base flavor is unique, non blank and fits the marquee`() {
        val pool = DeckReadout.BASE_FLAVOR
        assertTrue("base pool should have grown past the original ten", pool.size >= 20)
        assertEquals("base pool should not repeat a line", pool.size, pool.distinct().size)
        for (line in pool) {
            assertTrue("blank line in base pool", line.isNotBlank())
            assertTrue("over-long line: '$line'", line.length <= DeckReadout.MAX_LINE)
        }
    }

    @Test
    fun `idle pool grows with live state but never breaks the line budget`() {
        // Worst case: signed in, offline, every counter maxed out.
        val worst = status(
            online = false,
            savedCount = 999,
            unreadCount = 999,
            hotQueueSize = 99,
            warmQueueSize = 99,
            level = 100,
            streakDays = 999,
            xpToNextLevel = 10_000,
            focusActive = true,
            collectionActive = true,
            translating = true,
        )
        val pool = DeckReadout.idleMessages(worst)
        assertEquals("state lines must not repeat", pool.size, pool.distinct().size)
        assertTrue("state lines should extend the base pool", pool.size > DeckReadout.BASE_FLAVOR.size)
        for (line in pool) {
            assertTrue("blank line in idle pool", line.isNotBlank())
            assertTrue("over-long line: '$line'", line.length <= DeckReadout.MAX_LINE)
        }
    }

    @Test
    fun `idle pool reports archive, buffer, unread tray and rank when signed in`() {
        val pool = DeckReadout.idleMessages(status())
        assertTrue("archive count", pool.contains("archive: 7 clippings stowed"))
        assertTrue("streak", pool.contains("streak 3 days unbroken"))
        assertTrue("rank", pool.contains("LVL 12 · EXPLORER // 240 XP TO NEXT"))
        assertTrue("tray", pool.contains("2 unread packets in the tray"))
        assertTrue("buffer", pool.contains("buffer armed: 4 hot · 9 warm"))
    }

    @Test
    fun `signed out does not claim a rank or an archive`() {
        val pool = DeckReadout.idleMessages(status(signedIn = false, level = 12, streakDays = 3))
        assertTrue(pool.contains("unlinked // sign in to open the pipe"))
        assertTrue("no archive claim", pool.none { it.startsWith("archive:") })
        assertTrue("no rank claim", pool.none { it.startsWith("LVL ") })
        assertTrue("no streak claim", pool.none { it.startsWith("streak ") })
    }

    @Test
    fun `offline reports cache and the clippings already on board`() {
        val pool = DeckReadout.idleMessages(status(online = false, savedCount = 5))
        assertTrue(pool.contains("uplink down // running from cache"))
        assertTrue(pool.contains("offline // 5 clippings safe on board"))

        val emptyHold = DeckReadout.idleMessages(status(online = false, savedCount = 0))
        assertTrue("no clippings, no claim", emptyHold.none { it.startsWith("offline //") })
    }

    @Test
    fun `an empty archive says so instead of showing a zero count`() {
        val pool = DeckReadout.idleMessages(status(savedCount = 0))
        assertTrue(pool.contains("archive empty // first find pending"))
        assertTrue(pool.none { it.startsWith("archive: ") })
    }

    @Test
    fun `focus, collection and translator states each add their line`() {
        val plain = DeckReadout.idleMessages(status())
        assertTrue(plain.none { it.startsWith("focus lock") })
        assertTrue(plain.none { it.startsWith("streaming a stitched") })
        assertTrue(plain.none { it.startsWith("translator inline") })

        val engaged = DeckReadout.idleMessages(
            status(focusActive = true, collectionActive = true, translating = true)
        )
        assertTrue(engaged.contains("focus lock engaged // narrow band"))
        assertTrue(engaged.contains("streaming a stitched collection"))
        assertTrue(engaged.contains("translator inline // decoding"))
    }

    @Test
    fun `rank drops the xp tail when the next level is unreachable`() {
        val pool = DeckReadout.idleMessages(status(level = 5, xpToNextLevel = null))
        assertTrue(pool.contains("LVL 5 · APPRENTICE"))
        val toppedOut = DeckReadout.idleMessages(status(level = 5, xpToNextLevel = 0))
        assertTrue(toppedOut.contains("LVL 5 · APPRENTICE"))
    }

    @Test
    fun `stream keeps the dot separators around queued messages`() {
        val stream = DeckReadout.stream(listOf("SCANNING…", "RATED UP // SIGNAL SAVED"), "unused")
        assertEquals(
            "${DeckReadout.SEPARATOR}SCANNING…${DeckReadout.SEPARATOR}" +
                "RATED UP // SIGNAL SAVED${DeckReadout.SEPARATOR}",
            stream,
        )
    }

    @Test
    fun `stream falls back to the flavor line when nothing is queued`() {
        assertEquals(
            "${DeckReadout.SEPARATOR}idle // waiting for roam${DeckReadout.SEPARATOR}",
            DeckReadout.stream(emptyList(), "idle // waiting for roam"),
        )
    }

    @Test
    fun `next flavor never repeats the line already on the strip`() {
        val pool = listOf("a", "b", "c")
        var previous = "a"
        repeat(50) {
            val next = DeckReadout.nextFlavor(pool, previous)
            assertTrue("repeated '$previous' back-to-back", next != previous)
            previous = next
        }
    }

    @Test
    fun `next flavor survives an empty or single-entry pool`() {
        assertEquals("", DeckReadout.nextFlavor(emptyList(), "a"))
        assertEquals("only", DeckReadout.nextFlavor(listOf("only"), "only"))
    }

    @Test
    fun `collection names are truncated to the strip budget`() {
        assertEquals("short", DeckReadout.truncateName("short"))
        val long = DeckReadout.truncateName("a very long collection name")
        assertTrue("expected a truncated name, got '$long'", long.length <= DeckReadout.MAX_NAME)
        assertTrue("truncation should be marked", long.endsWith("…"))
        assertFalse("truncation must not keep the whole name", long == "a very long collection name")
    }
}
