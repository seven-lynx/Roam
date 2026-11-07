package app.roam.android.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** Covers the DEBRIS physics and collisions (the Kotlin port of the web asteroids). */
class DebrisTest {

    @Test
    fun `a fresh run starts centred with three lives and five wrecks`() {
        val state = freshDebris(1, Random(1))
        assertEquals(DEBRIS_W / 2f, state.ship.x, 0.01f)
        assertEquals(DEBRIS_H / 2f, state.ship.y, 0.01f)
        assertEquals(3, state.lives)
        assertEquals(5, state.rocks.size)
        assertEquals(0, state.score)
        assertFalse(state.over)
    }

    @Test
    fun `each level adds a wreck and speeds the drift up`() {
        assertEquals(6, spawnWave(2, Random(2)).size)
        val slow = spawnWave(1, Random(3)).first().size
        assertTrue(slow >= 20f)
        val fast = spawnWave(5, Random(3)).map { it.vy }
        assertTrue(fast.all { it >= 0.5f })
    }

    @Test
    fun `firing appends a round with a finite life`() {
        val state = fireDebris(freshDebris(1, Random(4)))
        assertEquals(1, state.bullets.size)
        assertEquals(40, state.bullets.first().life)
    }

    @Test
    fun `a round that hits a wreck scores ten and removes both`() {
        val target = Rock(x = 100f, y = 100f, vx = 0f, vy = 0f, size = 20f)
        val bullet = Bullet(x = 100f, y = 100f, vx = 0f, vy = 0f, life = 40)
        val state = DebrisState(
            ship = Ship(DEBRIS_W / 2f, DEBRIS_H / 2f, 0f, 0f, 0f),
            bullets = listOf(bullet),
            rocks = listOf(target),
        )
        val stepped = stepDebris(state, DebrisInput(), Random(5))
        assertEquals(10, stepped.score)
        assertTrue(stepped.bullets.isEmpty())
        assertTrue(stepped.rocks.isEmpty())
    }

    @Test
    fun `flying into a wreck costs a hull point and resets the ship`() {
        val ship = Ship(x = 100f, y = 100f, angle = 0f, vx = 0f, vy = 0f)
        val rock = Rock(x = 100f, y = 100f, vx = 0f, vy = 0f, size = 20f)
        val state = DebrisState(ship = ship, bullets = emptyList(), rocks = listOf(rock))
        val stepped = stepDebris(state, DebrisInput(), Random(6))
        assertEquals(2, stepped.lives)
        assertEquals(DEBRIS_W / 2f, stepped.ship.x, 0.01f)
    }

    @Test
    fun `the last collision ends the run`() {
        val ship = Ship(x = 100f, y = 100f, angle = 0f, vx = 0f, vy = 0f)
        val rock = Rock(x = 100f, y = 100f, vx = 0f, vy = 0f, size = 20f)
        val state = DebrisState(ship = ship, bullets = emptyList(), rocks = listOf(rock), lives = 1)
        val stepped = stepDebris(state, DebrisInput(), Random(7))
        assertTrue(stepped.over)
        assertEquals(0, stepped.lives)
    }

    @Test
    fun `the ship wraps around the edges of the field`() {
        val ship = Ship(x = 1f, y = 1f, angle = 0f, vx = -50f, vy = -50f)
        val state = DebrisState(ship = ship, bullets = emptyList(), rocks = emptyList())
        val stepped = stepDebris(state, DebrisInput(), Random(8))
        assertTrue(stepped.ship.x in 0f..DEBRIS_W)
        assertTrue(stepped.ship.y in 0f..DEBRIS_H)
    }

    @Test
    fun `holding thrust increases speed and rotation changes the heading`() {
        val state = freshDebris(1, Random(9))
        val thrusting = stepDebris(state, DebrisInput(thrust = true), Random(9))
        assertTrue(thrusting.ship.vy < 0f) // thrusting "up" from a level heading
        val turning = stepDebris(state, DebrisInput(right = true), Random(9))
        assertTrue(turning.ship.angle > state.ship.angle)
    }
}