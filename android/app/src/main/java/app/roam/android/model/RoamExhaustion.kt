package app.roam.android.model

/**
 * Why a serve came back empty (issue #120). Read from the `roam` function's 404
 * body, which the server fills from `user_exhaustion_state`.
 *
 * Null everywhere would mean "the server did not say" - an older deployment - and
 * the UI then keeps its generic end-of-feed copy rather than inventing a cause.
 */
data class RoamExhaustion(
    val reason: Reason,
    /** `global`, `category:<uuid>`, `subcategory:<uuid>` or `collection:<uuid>`. */
    val scope: String? = null,
    /** ISO timestamp the feed refills at; only set for [Reason.COOLDOWN]. */
    val availableLater: String? = null,
) {
    enum class Reason { POOL_EMPTY, COOLDOWN, FILTERS }
}
