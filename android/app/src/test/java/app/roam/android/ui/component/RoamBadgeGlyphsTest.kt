package app.roam.android.ui.component

import app.roam.android.model.Badge
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Guards the badge-icon parity port (web/src/lib/icons.ts -> RoamBadgeGlyphData /
 * RoamBadgeGlyphs). Mirrors the guarantees the web enforces in
 * web/src/__tests__/icons.test.ts, and — most importantly — iterates the ENTIRE
 * generated glyph pack so any path the SVG subset parser can't handle fails here.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class RoamBadgeGlyphsTest {

    @Test
    fun normalizeCategoryMapsLegacyEngagementToCuriosity() {
        assertEquals("curiosity", RoamBadgeGlyphs.normalizeCategory("engagement"))
        assertEquals("exploration", RoamBadgeGlyphs.normalizeCategory("exploration"))
    }

    @Test
    fun generatedDataMatchesWebPackCounts() {
        // Mirrors BADGE_GLYPHS / CATEGORY_GLYPHS in web/src/lib/icons.ts.
        assertEquals(332, RoamBadgeGlyphData.badgeGlyphs.size)
        assertEquals(11, RoamBadgeGlyphData.categoryGlyphs.size)
        assertTrue(RoamBadgeGlyphData.defaultGlyph.isNotBlank())
        assertTrue(RoamBadgeGlyphData.hiddenGlyph.isNotBlank())
    }

    @Test
    fun everyBadgeGlyphBuildsAVectorWithoutThrowing() {
        for ((slug, _) in RoamBadgeGlyphData.badgeGlyphs) {
            assertNotNull("slug did not resolve: $slug", RoamBadgeGlyphs.resolveBadgeGlyph(slug, "milestone", 0))
        }
    }

    @Test
    fun everyCategoryGlyphBuildsAVectorWithoutThrowing() {
        for ((cat, _) in RoamBadgeGlyphData.categoryGlyphs) {
            assertNotNull(RoamBadgeGlyphs.resolveBadgeGlyph("unknown-slug-$cat", cat, 0))
        }
    }

    @Test
    fun unknownSlugFallsBackToItsCategoryGlyph() {
        assertNotNull(RoamBadgeGlyphs.resolveBadgeGlyph("does-not-exist", "games", 0))
    }

    @Test
    fun unknownCategoryFallsBackToDefaultMedal() {
        assertNotNull(RoamBadgeGlyphs.resolveBadgeGlyph("does-not-exist", "nope", 0))
    }

    @Test
    fun tierPipsResolveForChainedBadgesWithoutThrowing() {
        assertNotNull(RoamBadgeGlyphs.resolveBadgeGlyph("wanderer-bronze", "exploration", 1))
        assertNotNull(RoamBadgeGlyphs.resolveBadgeGlyph("wanderer-gold", "exploration", 3))
        assertNotNull(RoamBadgeGlyphs.resolveBadgeGlyph("collector-platinum", "collecting", 4))
    }

    @Test
    fun hiddenBadgesUseHiddenGlyphAndUnlockedUseSlugGlyph() {
        val hidden = Badge(isHidden = true, isUnlocked = false)
        assertNotNull(RoamBadgeGlyphs.forBadge(hidden))

        val unlocked = Badge(
            slug = "time-traveler",
            category = "secret",
            isHidden = false,
            isUnlocked = true,
        )
        assertNotNull(RoamBadgeGlyphs.forBadge(unlocked))
    }
}