package app.roam.android.model

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNames

@Serializable
data class AppNotification(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    val type: String = "",
    val title: String = "",
    val body: String? = null,
    val data: AppNotificationData? = null,
    val read: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
)

@OptIn(ExperimentalSerializationApi::class)
@Serializable
data class AppNotificationData(
    // Moderation notifications (url_approved, url_rejected)
    val url: String? = null,
    @SerialName("queue_id") val queueId: String? = null,
    val title: String? = null,
    // Follower notifications (new_follower)
    @SerialName("follower_username") val followerUsername: String? = null,
    @SerialName("follower_id") val followerId: String? = null,
    // Badge notifications (badge_unlocked)
    @SerialName("badge_id") val badgeId: String? = null,
    @SerialName("badge_slug") val badgeSlug: String? = null,
    @SerialName("badge_name") val badgeName: String? = null,
    @SerialName("badge_icon") val badgeIcon: String? = null,
    @SerialName("xp_reward") val xpReward: Int? = null,
    // Level-up notifications (level_up). Backends emit "new_level" in some paths
    // and "level" in others — accept both.
    @SerialName("new_level")
    @JsonNames("level")
    val newLevel: Int? = null,
    // Challenge-complete notifications (challenge_complete)
    @SerialName("xp") val xp: Int? = null,
    // Shared deep-link (badge_unlocked, level_up)
    @SerialName("v_profile_url") val vProfileUrl: String? = null,
    // URL share notification (url_shared)
    @SerialName("sender_username") val senderUsername: String? = null,
    @SerialName("sender_id") val senderId: String? = null,
    @SerialName("url_title") val urlTitle: String? = null,
    @SerialName("share_id") val shareId: String? = null,
)