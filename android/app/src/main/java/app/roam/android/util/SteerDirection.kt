package app.roam.android.util

import kotlin.math.abs

/** A four-way steering intent for in-OS games. */
enum class Steer { UP, DOWN, LEFT, RIGHT }

/** Minimum drag distance (px) required to register a steering swipe. */
const val STEER_SWIPE_THRESHOLD_PX = 32f

/**
 * Resolves a drag delta into a steering intent for four-way games.
 *
 * The dominant axis must exceed both the cross-axis magnitude and [threshold].
 * Screen coordinates have positive `y` downward, so a positive `dy` is
 * [Steer.DOWN].
 */
fun resolveSteer(dx: Float, dy: Float, threshold: Float = STEER_SWIPE_THRESHOLD_PX): Steer? {
    val ax = abs(dx)
    val ay = abs(dy)
    return when {
        ax > ay && ax > threshold -> if (dx > 0) Steer.RIGHT else Steer.LEFT
        ay > ax && ay > threshold -> if (dy > 0) Steer.DOWN else Steer.UP
        else -> null
    }
}
