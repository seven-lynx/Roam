package app.roam.android.ui.component

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.roam.android.R
import app.roam.android.model.DEBRIS_H
import app.roam.android.model.DEBRIS_W
import app.roam.android.model.DebrisInput
import app.roam.android.model.DebrisState
import app.roam.android.model.GameId
import app.roam.android.model.fireDebris
import app.roam.android.model.freshDebris
import app.roam.android.model.makeRunId
import app.roam.android.model.program
import app.roam.android.model.spawnWave
import app.roam.android.model.stepDebris
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.LineColor
import app.roam.android.util.SoundManager
import app.roam.android.util.Steer
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.min

/**
 * DEBRIS.EXE — a drift through the dead web's wreckage. A native Compose port of
 * the web `AsteroidsProgram` (zeli-web-games "Asteroids", Apache-2.0): one
 * Canvas, a D-pad or analog stick that can be toggled, and a FIRE key.
 */

private const val DEBRIS_FRAME_MS = 16L

// The web program draws with a fixed phosphor palette rather than the OS theme.
private val SPACE = Color(0xFF0A1518)
private val STAR = Color(0x40E6DCC3)
private val SHIP_FILL = Color(0xFF59B3AE)
private val BULLET_COLOR = Color(0xFFE0B45F)
private val ROCK_FILL = Color(0xFF8A6D33)
private val ROCK_EDGE = Color(0xFF6A674B)

@Composable
fun DebrisProgram(
    soundEnabled: Boolean,
    signedIn: Boolean,
    onAward: GameAward,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = remember { requireNotNull(program("asteroids")) { "DEBRIS missing from registry" } }
    val context = LocalContext.current
    val runId = rememberSaveable { makeRunId() }
    val levels = rememberGameLevel(GameId.ASTEROIDS, runId, signedIn, onAward)

    var running by rememberSaveable { mutableStateOf(false) }
    var stickMode by rememberSaveable { mutableStateOf(false) }
    var state by remember { mutableStateOf(freshDebris(1)) }
    var waveLevel by remember { mutableIntStateOf(1) }
    var left by remember { mutableStateOf(false) }
    var right by remember { mutableStateOf(false) }
    var thrust by remember { mutableStateOf(false) }

    fun sfx(resId: Int) {
        if (soundEnabled) SoundManager.play(context, resId)
    }

    fun fire() {
        if (!levels.isPlaying) return
        state = fireDebris(state)
        sfx(R.raw.click)
    }

    fun reset() {
        state = freshDebris(1)
        waveLevel = 1
        left = false
        right = false
        thrust = false
        levels.resetLevels()
    }

    LaunchedEffect(levels.phase, levels.level, running) {
        if (!running) return@LaunchedEffect
        while (levels.isPlaying) {
            delay(DEBRIS_FRAME_MS)
            if (waveLevel != levels.level) {
                waveLevel = levels.level
                state = state.copy(rocks = state.rocks + spawnWave(levels.level))
            }
            val next = stepDebris(state, DebrisInput(left = left, right = right, thrust = thrust))
            state = next
            if (next.over) {
                sfx(R.raw.click_heavy)
                levels.gameOver(next.score)
            } else if (next.rocks.isEmpty()) {
                sfx(R.raw.generic_success)
                levels.completeLevel()
            }
        }
    }

    RoamOsWindow(title = meta.title, onClose = onClose, modifier = modifier) {
        Box(Modifier.fillMaxSize()) {
            if (!running) {
                ProgramGuide(meta) {
                    running = true
                    levels.begin()
                }
            } else {
                DebrisPlayfield(
                    state = state,
                    level = levels.level,
                    stickMode = stickMode,
                    onFire = { fire() },
                    onToggleMode = { stickMode = !stickMode },
                    onHold = { steer ->
                        left = steer == Steer.LEFT
                        right = steer == Steer.RIGHT
                        thrust = steer == Steer.UP
                    },
                    onPress = { key, down ->
                        when (key) {
                            Steer.LEFT -> left = down
                            Steer.RIGHT -> right = down
                            Steer.UP -> thrust = down
                            Steer.DOWN -> Unit
                        }
                    },
                    overlay = {
                        ProgramOverlay(
                            phase = levels.phase,
                            level = levels.level,
                            countdown = levels.countdown,
                            lastXp = levels.lastXp,
                            signedIn = signedIn,
                            overTitle = "HULL BREACH",
                            scoreLabel = "SCORE",
                            score = state.score,
                            onStart = { levels.begin() },
                            onRestart = { reset() },
                        )
                    },
                )
            }
        }
    }
}

/** HUD, playfield and controls for DEBRIS. */
@Composable
private fun DebrisPlayfield(
    state: DebrisState,
    level: Int,
    stickMode: Boolean,
    onFire: () -> Unit,
    onToggleMode: () -> Unit,
    onHold: (Steer?) -> Unit,
    onPress: (Steer, Boolean) -> Unit,
    overlay: @Composable BoxScope.() -> Unit,
) {
    Column(
        Modifier.fillMaxSize().padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("LVL $level", style = MaterialTheme.typography.labelSmall, color = Fog)
            Text("SCORE ${state.score}", style = MaterialTheme.typography.labelSmall, color = Fog)
            Text("HULL ${state.lives}", style = MaterialTheme.typography.labelSmall, color = Fog)
        }
        Spacer(Modifier.height(6.dp))
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            BoxWithConstraints {
                val width = min(maxWidth.value, maxHeight.value * (DEBRIS_W / DEBRIS_H))
                val height = width * DEBRIS_H / DEBRIS_W
                Box(
                    Modifier
                        .size(width.dp, height.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SPACE)
                        .border(1.dp, LineColor, RoundedCornerShape(8.dp)),
                ) {
                    Canvas(Modifier.fillMaxSize()) {
                        val scale = size.width / DEBRIS_W

                        // Starfield drift.
                        for (i in 0 until 30) {
                            val sx = ((i * 97 + state.frame * 0.1f) % DEBRIS_W) * scale
                            val sy = ((i * 53 + state.frame * 0.05f) % DEBRIS_H) * scale
                            drawRect(STAR, Offset(sx, sy), Size(scale, scale))
                        }

                        // Wreck.
                        for (rock in state.rocks) {
                            val center = Offset(rock.x * scale, rock.y * scale)
                            drawCircle(ROCK_FILL, radius = rock.size * scale, center = center)
                            drawCircle(
                                ROCK_EDGE,
                                radius = rock.size * scale,
                                center = center,
                                style = Stroke(width = scale),
                            )
                        }

                        // Rounds.
                        for (bullet in state.bullets) {
                            drawRect(
                                BULLET_COLOR,
                                Offset(bullet.x * scale - scale, bullet.y * scale - 3f * scale),
                                Size(2f * scale, 6f * scale),
                            )
                        }

                        // The ship, rotated to its heading.
                        val shipX = state.ship.x * scale
                        val shipY = state.ship.y * scale
                        rotate(degrees = state.ship.angle * 180f / PI.toFloat(), pivot = Offset(shipX, shipY)) {
                            val hull = Path().apply {
                                moveTo(shipX, shipY - 12f * scale)
                                lineTo(shipX - 8f * scale, shipY + 10f * scale)
                                lineTo(shipX + 8f * scale, shipY + 10f * scale)
                                close()
                            }
                            drawPath(hull, SHIP_FILL)
                        }
                    }
                    overlay()
                }
            }
        }
        Spacer(Modifier.height(6.dp))
        if (stickMode) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AnalogStick(onHold = onHold, size = 96.dp, label = "Flight stick")
                ProgramActionKey("FIRE", onFire)
            }
        } else {
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ProgramHoldKey("◀", { onPress(Steer.LEFT, true) }, { onPress(Steer.LEFT, false) }, width = 48.dp, height = 44.dp)
                ProgramHoldKey("▲", { onPress(Steer.UP, true) }, { onPress(Steer.UP, false) }, width = 48.dp, height = 44.dp)
                ProgramHoldKey("▶", { onPress(Steer.RIGHT, true) }, { onPress(Steer.RIGHT, false) }, width = 48.dp, height = 44.dp)
                ProgramActionKey("●", onFire)
            }
        }
        Spacer(Modifier.height(4.dp))
        ProgramActionKey(if (stickMode) "STICK ⇄ D-PAD" else "D-PAD ⇄ STICK", onToggleMode)
    }
}