package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ActivityFeedItem(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    val username: String = "",
    @SerialName("display_name") val displayName: String = "",
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("activity_type") val activityType: String = "",
    @SerialName("subject_id") val subjectId: String? = null,
    @SerialName("subject_title") val subjectTitle: String? = null,
    @SerialName("created_at") val createdAt: String = "",
)