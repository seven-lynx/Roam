package app.roam.android.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProgramRegistryTest {

    @Test
    fun `registry ships all five handheld programs in launcher order`() {
        assertEquals(
            listOf("snake", "minesweeper", "tetris", "asteroids", "frogger"),
            PROGRAMS.map { it.id },
        )
    }

    @Test
    fun `program ids are unique`() {
        assertEquals(PROGRAMS.size, PROGRAMS.map { it.id }.toSet().size)
    }

    @Test
    fun `titles, paths and glyphs are unique`() {
        assertEquals(PROGRAMS.size, PROGRAMS.map { it.title }.toSet().size)
        assertEquals(PROGRAMS.size, PROGRAMS.map { it.file }.toSet().size)
        assertEquals(PROGRAMS.size, PROGRAMS.map { it.glyph }.toSet().size)
    }

    @Test
    fun `every program carries license and source attribution`() {
        PROGRAMS.forEach { p ->
            assertTrue(p.license.name.isNotBlank())
            assertTrue(p.license.spdx.isNotBlank())
            assertTrue(p.license.url.startsWith("http"))
            assertTrue(p.source.isNotBlank())
            assertTrue(p.title.isNotBlank())
            assertTrue(p.tagline.isNotBlank())
            assertTrue(p.controls.isNotBlank())
        }
    }

    @Test
    fun `program lookup resolves known and unknown ids`() {
        assertNotNull(program("snake"))
        assertEquals("RELAY", program("snake")?.title)
        assertNull(program("unknown"))
    }

    @Test
    fun `titles match the webapp registry`() {
        assertEquals("RELAY", program("snake")?.title)
        assertEquals("BOTFIELD", program("minesweeper")?.title)
        assertEquals("COMPILER", program("tetris")?.title)
        assertEquals("DEBRIS", program("asteroids")?.title)
        assertEquals("FIREWALK", program("frogger")?.title)
    }

    @Test
    fun `the zeli ports are Apache-2 and FIREWALK is MIT`() {
        for (id in listOf("snake", "minesweeper", "tetris", "asteroids")) {
            val p = requireNotNull(program(id))
            assertEquals("Apache-2.0", p.license.spdx)
            assertTrue(p.source.contains("zeli-web-games"))
        }
        assertEquals("MIT", requireNotNull(program("frogger")).license.spdx)
    }

    @Test
    fun `every playable program has a game id for XP awards`() {
        val slugs = GameId.entries.map { it.slug }.toSet()
        PROGRAMS.forEach { p ->
            assertTrue("no GameId for ${p.id}", p.id in slugs)
        }
    }
}
