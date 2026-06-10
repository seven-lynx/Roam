package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

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

@Serializable
data class AppNotificationData(
    val url: String? = null,
    @SerialName("queue_id") val queueId: String? = null,
    val title: String? = null,
)