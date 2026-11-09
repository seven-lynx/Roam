package app.roam.android.ui.component

import app.roam.android.model.RoamExhaustion
import java.time.Duration
import java.time.Instant

/**
 * Copy for a dry feed (issue #120). A cooldown is a wait, an empty pool is a wall,
 * and hidden filters are the user's own doing - three situations that used to read
 * as one "you've seen everything".
 *
 * The wording mirrors the web's ScanResult and the extension's popup so all three
 * surfaces describe the same situation the same way.
 */

/** How long until [iso], in the terms a reader cares about. */
internal fun describeWait(iso: String?, now: Instant = Instant.now()): String {
    if (iso == null) return "soon"
    val target = runCatching { Instant.parse(iso) }.getOrNull() ?: return "soon"
    val minutes = Duration.between(now, target).toMinutes()
    if (minutes <= 5) return "within minutes"
    if (minutes < 60) return "in about ${roundTo(minutes, 5)} minutes"
    val hours = maxOf(1L, roundTo(minutes, 60))
    return "in about $hours ${if (hours == 1L) "hour" else "hours"}"
}

/** One line for the status bar; the shipped line is kept when there is no reason. */
internal fun exhaustionStatusLabel(exhaustion: RoamExhaustion?): String =
    when (exhaustion?.reason) {
        RoamExhaustion.Reason.POOL_EMPTY -> "You've seen everything"
        RoamExhaustion.Reason.COOLDOWN -> "Feed resting ${describeWait(exhaustion?.availableLater)}"
        RoamExhaustion.Reason.FILTERS -> "Filters hiding everything"
        null -> "You've seen everything - adjust categories in Settings"
    }

/** Headline for the full-screen end state. */
internal fun exhaustionHeadline(exhaustion: RoamExhaustion?): String =
    when (exhaustion?.reason) {
        RoamExhaustion.Reason.COOLDOWN -> "Every site here is resting."
        RoamExhaustion.Reason.FILTERS -> "Your filters are hiding everything."
        RoamExhaustion.Reason.POOL_EMPTY, null -> "You've seen everything!"
    }

/** The sentence under the headline; only the pool case sends the user to Settings. */
internal fun exhaustionBody(exhaustion: RoamExhaustion?, now: Instant = Instant.now()): String =
    when (exhaustion?.reason) {
        RoamExhaustion.Reason.COOLDOWN ->
            "Each domain rests 24 h after a visit. The first one returns ${describeWait(exhaustion?.availableLater, now)}."
        RoamExhaustion.Reason.FILTERS ->
            "Nothing left matches your categories. Loosen them in Settings and the feed reopens."
        RoamExhaustion.Reason.POOL_EMPTY, null -> "Adjust your categories in Settings to find more."
    }

/** Rounds to the nearest multiple of [step]; the caller has already handled 0..step. */
private fun roundTo(value: Long, step: Long): Long = ((value + step / 2) / step) * step
