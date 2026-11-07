package app.roam.android.model

import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin
import kotlin.random.Random

/**
 * DEBRIS board rules — the Kotlin port of `AsteroidsProgram.tsx` (zeli-web-games
 * "Asteroids", Apache-2.0). Pure data + functions so the physics and collisions
 * unit-test without Compose.
 */

const val DEBRIS_W = 480f
const val DEBRIS_H = 560f

/** A drifting wreck. [size] doubles as its collision radius. */
data class Rock(val x: Float, val y: Float, val vx: Float, val vy: Float, val size: Float)

/** A signal round; [life] counts down in frames. */
data class Bullet(val x: Float, val y: Float, val vx: Float, val vy: Float, val life: Int)

/** The player's ship. */
data class Ship(val x: Float, val y: Float, val angle: Float, val vx: Float, val vy: Float)

/** Held flight input for one frame. */
data class DebrisInput(val left: Boolean = false, val right: Boolean = false, val thrust: Boolean = false)

/** The whole run. */
data class DebrisState(
    val ship: Ship,
    val bullets: List<Bullet>,
    val rocks: List<Rock>,
    val score: Int = 0,
    val lives: Int = 3,
    val over: Boolean = false,
    val frame: Int = 0,
)

private fun wrap(value: Float, span: Float): Float {
    val wrapped = value % span
    return if (wrapped < 0f) wrapped + span else wrapped
}

/** Spawns a wave: 5 wreck on level 1, one more each level, drifting faster. */
fun spawnWave(level: Int, random: Random = Random.Default): List<Rock> {
    val count = 5 + (level - 1)
    val speed = 1f + (level - 1) * 0.15f
    return List(count) {
        Rock(
            x = random.nextFloat() * DEBRIS_W,
            y = random.nextFloat() * DEBRIS_H * 0.3f,
            vx = (random.nextFloat() - 0.5f) * 2f * speed,
            vy = (0.5f + random.nextFloat() * 1.5f) * speed,
            size = 20f + random.nextFloat() * 15f,
        )
    }
}

/** A fresh run at [level]. */
fun freshDebris(level: Int = 1, random: Random = Random.Default): DebrisState =
    DebrisState(
        ship = Ship(DEBRIS_W / 2f, DEBRIS_H / 2f, 0f, 0f, 0f),
        bullets = emptyList(),
        rocks = spawnWave(level, random),
    )

/** Fires one round from the ship's nose. */
fun fireDebris(state: DebrisState): DebrisState {
    if (state.over) return state
    val ship = state.ship
    val bullet = Bullet(
        x = ship.x,
        y = ship.y,
        vx = sin(ship.angle) * 6f,
        vy = -cos(ship.angle) * 6f,
        life = 40,
    )
    return state.copy(bullets = state.bullets + bullet)
}

/** Advances one animation frame: flight, drift, then bullets and collisions. */
fun stepDebris(
    state: DebrisState,
    input: DebrisInput,
    random: Random = Random.Default,
): DebrisState {
    if (state.over) return state.copy(frame = state.frame + 1)
    val frame = state.frame + 1

    var ship = state.ship
    if (input.left) ship = ship.copy(angle = ship.angle - 0.08f)
    if (input.right) ship = ship.copy(angle = ship.angle + 0.08f)
    if (input.thrust) {
        ship = ship.copy(
            vx = ship.vx + sin(ship.angle) * 0.15f,
            vy = ship.vy - cos(ship.angle) * 0.15f,
        )
    }
    ship = ship.copy(vx = ship.vx * 0.98f, vy = ship.vy * 0.98f)
    ship = ship.copy(
        x = wrap(ship.x + ship.vx, DEBRIS_W),
        y = wrap(ship.y + ship.vy, DEBRIS_H),
    )

    val bullets = state.bullets.mapNotNull { bullet ->
        val x = bullet.x + bullet.vx
        val y = bullet.y + bullet.vy
        val life = bullet.life - 1
        if (life > 0 && x > 0f && x < DEBRIS_W && y > 0f && y < DEBRIS_H) {
            bullet.copy(x = x, y = y, life = life)
        } else {
            null
        }
    }

    val rocks = state.rocks.map { rock ->
        var x = wrap(rock.x + rock.vx, DEBRIS_W)
        var y = rock.y + rock.vy
        if (y > DEBRIS_H + 30f) {
            y = -20f
            x = random.nextFloat() * DEBRIS_W
        }
        rock.copy(x = x, y = y)
    }

    val deadBullets = BooleanArray(bullets.size)
    val deadRocks = BooleanArray(rocks.size)
    var score = state.score

    // Bullets shatter wreck.
    for (bi in bullets.indices) {
        for (ri in rocks.indices) {
            if (deadBullets[bi] || deadRocks[ri]) continue
            val bullet = bullets[bi]
            val rock = rocks[ri]
            if (hypot(bullet.x - rock.x, bullet.y - rock.y) < rock.size) {
                deadBullets[bi] = true
                deadRocks[ri] = true
                score += 10
            }
        }
    }

    // Wreck the ship flies into costs a life.
    var lives = state.lives
    var crashingShip = ship
    for (ri in rocks.indices) {
        if (deadRocks[ri]) continue
        val rock = rocks[ri]
        if (hypot(crashingShip.x - rock.x, crashingShip.y - rock.y) < rock.size + 8f) {
            lives -= 1
            deadRocks[ri] = true
            crashingShip = Ship(DEBRIS_W / 2f, DEBRIS_H / 2f, crashingShip.angle, 0f, 0f)
            if (lives <= 0) {
                return DebrisState(
                    ship = crashingShip,
                    bullets = bullets.filterIndexed { index, _ -> !deadBullets[index] },
                    rocks = rocks.filterIndexed { index, _ -> !deadRocks[index] },
                    score = score,
                    lives = 0,
                    over = true,
                    frame = frame,
                )
            }
        }
    }

    return DebrisState(
        ship = crashingShip,
        bullets = bullets.filterIndexed { index, _ -> !deadBullets[index] },
        rocks = rocks.filterIndexed { index, _ -> !deadRocks[index] },
        score = score,
        lives = lives,
        over = false,
        frame = frame,
    )
}