package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class UserProfile(
    val id: String = "",
    val username: String = "",
    @SerialName("display_name") val displayName: String = "",
    val bio: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("is_public") val isPublic: Boolean = true,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("xp_total") val xpTotal: Long = 0,
    val level: Int = 1,
    @SerialName("streak_days") val streakDays: Int = 0,
    @SerialName("max_streak") val maxStreak: Int = 0,
    @SerialName("badge_count") val badgeCount: Int = 0,
)