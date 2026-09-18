package app.roam.android.util

import kotlin.math.abs

/** Minimum drag distance (px) required to trigger a swipe action. */
internal const val DEFAULT_SWIPE_THRESHOLD_PX = 120f

/**
 * Resolves a drag delta into a named swipe action.
 *
 * - Swipe **down** past [threshold] → "roam" (discover next)
 * - Swipe **right** past [threshold] → "like" (thumbs up)
 * - Swipe **left**  past [threshold] → "skip" (thumbs down)
 * - Below threshold or ambiguous → `null`
 *
 * In all cases the dominant axis must exceed the cross-axis magnitude.
 */
fun resolveSwipeAction(
    dx: Float,
    dy: Float,
    threshold: Float = DEFAULT_SWIPE_THRESHOLD_PX,
): String? = when {
    dy > threshold && abs(dy) > abs(dx) -> "roam"
    dx > threshold && abs(dx) > abs(dy) -> "like"
    dx < -threshold && abs(dx) > abs(dy) -> "skip"
    else -> null
}
