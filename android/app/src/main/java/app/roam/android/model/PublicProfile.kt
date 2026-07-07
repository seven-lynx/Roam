package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PublicProfile(
    val id: String = "",
    val username: String = "",
    @SerialName("display_name") val displayName: String = "",
    val bio: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("is_public") val isPublic: Boolean = true,
    @SerialName("follower_count") val followerCount: Int = 0,
    @SerialName("following_count") val followingCount: Int = 0,
    @SerialName("collections_count") val collectionsCount: Int = 0,
    @SerialName("created_at") val createdAt: String = "",
    val level: Int = 1,
    @SerialName("xp_total") val xpTotal: Long = 0,
    @SerialName("streak_days") val streakDays: Int = 0,
    @SerialName("max_streak") val maxStreak: Int = 0,
    @SerialName("badge_count") val badgeCount: Int = 0,
    val badges: List<Badge> = emptyList(),
    val collections: List<PublicCollection> = emptyList(),
)

@Serializable
data class PublicCollection(
    val id: String = "",
    val name: String = "",
    val slug: String = "",
    @SerialName("item_count") val itemCount: Int = 0,
)