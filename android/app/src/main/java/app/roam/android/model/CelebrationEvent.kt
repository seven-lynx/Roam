package app.roam.android.model

/**
 * A gamification moment that deserves a full-screen celebration overlay.
 *
 * Produced by [MainViewModel][app.roam.android.viewmodel.MainViewModel] when it detects a new
 * `badge_unlocked`, `level_up`, or `challenge_complete` notification from the server, and consumed
 * by the `CelebrationOverlay` composable in `MainScreen`.
 */
sealed interface CelebrationEvent {
    data class BadgeUnlocked(val badge: Badge) : CelebrationEvent
    data class LevelUp(val newLevel: Int, val xpTotal: Long) : CelebrationEvent
    data class ChallengeComplete(val title: String, val xpReward: Int) : CelebrationEvent
}
