package app.roam.android.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProgramRegistryTest {

    @Test
    fun `registry ships the four in-OS games in launcher order`() {
        assertEquals(listOf("snake", "minesweeper", "tetris", "asteroids"), PROGRAMS.map { it.id })
    }

    @Test
    fun `program ids are unique`() {
        assertEquals(PROGRAMS.size, PROGRAMS.map { it.id }.toSet().size)
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
}
