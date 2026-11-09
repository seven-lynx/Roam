package app.roam.android.ui.component

import app.roam.android.model.RoamExhaustion
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mirrors the copy contract shared with web (ScanResult.tsx) and the extension
 * (lib/exhaustion.ts): a cooldown is a wait, an empty pool is a wall, hidden
 * filters are the user's own doing.
 */
class ExhaustionCopyTest {

    private val now: Instant = Instant.parse("2026-11-09T12:00:00Z")

    private fun cooldown(later: String?) =
        RoamExhaustion(RoamExhaustion.Reason.COOLDOWN, availableLater = later)

    @Test
    fun describeWaitRoundsLongWaitsToHours() {
        assertEquals("in about 2 hours", describeWait("2026-11-09T14:20:00Z", now))
    }

    @Test
    fun describeWaitUsesASingularHour() {
        assertEquals("in about 1 hour", describeWait("2026-11-09T13:00:00Z", now))
    }

    @Test
    fun describeWaitRoundsSubHourWaitsToFiveMinutes() {
        assertEquals("in about 25 minutes", describeWait("2026-11-09T12:04:00Z", now))
    }

    @Test
    fun describeWaitSaysWithinMinutesWhenClose() {
        assertEquals("within minutes", describeWait("2026-11-09T12:03:00Z", now))
    }

    @Test
    fun describeWaitFallsBackToSoon() {
        assertEquals("soon", describeWait(null, now))
        assertEquals("soon", describeWait("not-a-date", now))
    }

    @Test
    fun cooldownExplainsTheWaitInBothStrings() {
        val exhaustion = cooldown("2026-11-09T14:20:00Z")
        assertTrue(exhaustionBody(exhaustion, now).contains("in about 2 hours"))
        assertTrue(exhaustionStatusLabel(exhaustion).contains("in about 2 hours"))
    }

    @Test
    fun poolEmptySendsTheUserToTheirCategories() {
        val exhaustion = RoamExhaustion(RoamExhaustion.Reason.POOL_EMPTY)
        assertEquals("You've seen everything!", exhaustionHeadline(exhaustion))
        assertTrue(exhaustionBody(exhaustion, now).contains("Settings"))
    }

    @Test
    fun filtersBlameTheFiltersRatherThanThePool() {
        val exhaustion = RoamExhaustion(RoamExhaustion.Reason.FILTERS)
        assertTrue(exhaustionHeadline(exhaustion).contains("filters"))
        assertTrue(exhaustionBody(exhaustion, now).contains("filters"))
    }

    @Test
    fun withoutAReasonTheShippedCopyStands() {
        assertEquals("You've seen everything!", exhaustionHeadline(null))
        assertFalse(exhaustionBody(null, now).isEmpty())
        assertFalse(exhaustionStatusLabel(null).isEmpty())
    }

    @Test
    fun aCooldownWithoutATimestampStillReadsCleanly() {
        assertTrue(exhaustionBody(cooldown(null), now).contains("soon"))
    }
}
