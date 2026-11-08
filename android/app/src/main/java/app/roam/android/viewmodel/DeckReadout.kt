package app.roam.android.viewmodel

import app.roam.android.model.LevelSystem

/**
 * Live state the SYS strip is allowed to talk about. Built by
 * `MainViewModel.deckStatus()` so the copy in [DeckReadout.idleMessages] stays a
 * pure function and can be unit-tested without Robolectric.
 */
internal data class DeckStatus(
    val signedIn: Boolean = false,
    val online: Boolean = true,
    val savedCount: Int = 0,
    val unreadCount: Int = 0,
    val hotQueueSize: Int = 0,
    val warmQueueSize: Int = 0,
    val level: Int = 0,
    val streakDays: Int = 0,
    val xpToNextLevel: Long? = null,
    val focusActive: Boolean = false,
    val collectionActive: Boolean = false,
    val translating: Boolean = false,
)

/**
 * Copy for the ROAM-OS deck readout (`ControlDeck.kt` → `SystemReadout`).
 *
 * Two voices, matching the rest of the shell: lowercase telemetry for ambient
 * state, uppercase for events that just happened. Every line has to inform —
 * a reading the operator could act on (level, streak, archive, buffer, uplink)
 * — while staying inside the fiction. Lines are short on purpose: the strip is
 * a single-line marquee tile, so anything past [MAX_LINE] crawls unreadably at
 * the default speed.
 */
internal object DeckReadout {

    /** Separator between queued messages in the marquee tile. */
    const val SEPARATOR = " · · · · "

    /** Legibility budget for one readout line (marquee tile, one line). */
    const val MAX_LINE = 44

    /** Longest collection name echoed back on the strip. */
    const val MAX_NAME = 14

    /**
     * Always-safe idle chatter — no state, so it can never contradict the deck
     * modules next to it. `ROAM-OS // STANDBY` is the first-run line.
     */
    val BASE_FLAVOR: List<String> = listOf(
        "ROAM-OS // STANDBY",
        "SIGNAL LOCK — AWAITING INPUT",
        "idle // waiting for roam",
        "uptime nominal",
        "phosphor array calibrated",
        "queue nominal // no packets",
        "sweep idle // tap ROAM",
        "net uplink stable",
        "cache warm // ready",
        "no new transmissions",
        "carrier holding // 88.4 MHz",
        "squelch open // listening",
        "cathode warm // no drift",
        "relay clean // zero rejects",
        "buffer steady // no stall",
        "band sweep complete // all quiet",
        "trace log tail is clean",
        "chassis temp nominal",
        "clock synced to orbital ref",
        "no ghost packets on the wire",
        "archive intact // no rot",
        "signal-to-noise: nominal",
        "waveform stable // lock held",
        "quiet band // nothing on it yet",
    )

    /**
     * Idle pool for the current [status]: the base chatter plus whatever the
     * deck can honestly report right now (uplink, archive, buffer, rank, streak,
     * unread tray, focus/collection/translator state).
     */
    fun idleMessages(status: DeckStatus): List<String> = buildList {
        addAll(BASE_FLAVOR)
        if (!status.signedIn) {
            add("unlinked // sign in to open the pipe")
        } else {
            if (status.savedCount > 0) {
                add("archive: ${status.savedCount} clippings stowed")
            } else {
                add("archive empty // first find pending")
            }
            if (status.streakDays > 0) {
                add("streak ${status.streakDays} days unbroken")
            } else {
                add("no streak on record // roam to start one")
            }
            if (status.level > 0) {
                val rank = LevelSystem.rankTitle(status.level).uppercase()
                val xp = status.xpToNextLevel
                add(
                    if (xp != null && xp > 0) "LVL ${status.level} · $rank // $xp XP TO NEXT"
                    else "LVL ${status.level} · $rank"
                )
            }
        }
        if (!status.online) {
            add("uplink down // running from cache")
            if (status.savedCount > 0) {
                add("offline // ${status.savedCount} clippings safe on board")
            }
        }
        if (status.unreadCount > 0) add("${status.unreadCount} unread packets in the tray")
        if (status.hotQueueSize + status.warmQueueSize > 0) {
            add("buffer armed: ${status.hotQueueSize} hot · ${status.warmQueueSize} warm")
        }
        if (status.focusActive) add("focus lock engaged // narrow band")
        if (status.collectionActive) add("streaming a stitched collection")
        if (status.translating) add("translator inline // decoding")
    }

    /**
     * Builds the marquee tile: dots separate each queued message and fill idle
     * time. [flavor] is only used when nothing is queued.
     */
    fun stream(messages: List<String>, flavor: String): String {
        val body = if (messages.isEmpty()) flavor else messages.joinToString(SEPARATOR)
        return SEPARATOR + body + SEPARATOR
    }

    /** Next idle line, never repeating the one currently on the strip. */
    fun nextFlavor(pool: List<String>, previous: String?): String {
        if (pool.isEmpty()) return ""
        if (pool.size == 1) return pool.first()
        val candidates = pool.filter { it != previous }
        return (candidates.ifEmpty { pool }).random()
    }

    /** Keeps an echoed collection name inside the marquee budget. */
    fun truncateName(name: String, max: Int = MAX_NAME): String =
        if (name.length <= max) name else name.take(max - 1).trimEnd() + "…"
}
