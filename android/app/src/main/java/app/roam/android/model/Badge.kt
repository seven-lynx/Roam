package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Badge(
    val id: String = "",
    val slug: String = "",
    val name: String = "",
    val description: String = "",
    val icon: String = "🏅",
    val category: String = "",
    val tier: Int = 0,
    @SerialName("required_count") val requiredCount: Int? = null,
    @SerialName("is_unlocked") val isUnlocked: Boolean = false,
    @SerialName("unlocked_at") val unlockedAt: String? = null,
    @SerialName("progress_current") val progressCurrent: Int = 0,
    @SerialName("is_hidden") val isHidden: Boolean = false,
    @SerialName("is_gift_only") val isGiftOnly: Boolean = false,
    @SerialName("xp_reward") val xpReward: Int = 0,
    @SerialName("parent_badge_slug") val parentBadgeSlug: String? = null,
    @SerialName("granted_by") val grantedBy: String? = null,
)

@Serializable
data class UserProgress(
    @SerialName("xp_total") val xpTotal: Long = 0,
    val level: Int = 1,
    @SerialName("streak_days") val streakDays: Int = 0,
    @SerialName("max_streak") val maxStreak: Int = 0,
    @SerialName("badge_count") val badgeCount: Int = 0,
)

@Serializable
data class LeaderboardEntry(
    val rank: Int = 0,
    @SerialName("user_id") val userId: String = "",
    val username: String = "",
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("xp_total") val xpTotal: Long = 0,
    val level: Int = 1,
    @SerialName("badge_count") val badgeCount: Int = 0,
    @SerialName("streak_days") val streakDays: Int = 0,
    @SerialName("xp_earned") val xpEarned: Long = 0,
)

object TierInfo {
    val names = mapOf(
        0 to "",
        1 to "Bronze",
        2 to "Silver",
        3 to "Gold",
        4 to "Platinum",
        5 to "Legendary"
    )

    val categoryLabels = mapOf(
        "exploration" to "Exploration",
        "collecting" to "Collecting",
        "curating" to "Curating",
        "social" to "Social",
        "streaks" to "Streaks",
        "contributing" to "Contributing",
        "engagement" to "Engagement",
        "secret" to "Secret",
        "milestone" to "Milestone",
        "gift" to "Gift"
    )
}

object LevelSystem {
    /** XP required to reach a given level */
    fun xpForLevel(level: Int): Long = ((level - 1).toLong() * (level - 1) * 100)

    /** Calculate level from total XP */
    fun levelFromXp(xp: Long): Int = kotlin.math.sqrt(xp.toDouble() / 100.0).toInt() + 1

    /** Rank titles */
    fun rankTitle(level: Int): String = when {
        level >= 100 -> "Grandmaster"
        level >= 75 -> "Legend"
        level >= 60 -> "Grand Master"
        level >= 50 -> "Master"
        level >= 40 -> "Pioneer"
        level >= 35 -> "Discoverer"
        level >= 30 -> "Trailblazer"
        level >= 25 -> "Pathfinder"
        level >= 20 -> "Voyager"
        level >= 15 -> "Adventurer"
        level >= 10 -> "Explorer"
        level >= 5 -> "Apprentice"
        else -> "Novice"
    }
}