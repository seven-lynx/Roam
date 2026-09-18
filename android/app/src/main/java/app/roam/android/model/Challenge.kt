package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ChallengeData(
    @SerialName("instance_id") val instanceId: String,
    @SerialName("progress_current") val progressCurrent: Int = 0,
    @SerialName("completed_at") val completedAt: String? = null,
    val challenge: ChallengeInfo
)

@Serializable
data class ChallengeInfo(
    val id: String,
    val key: String,
    val title: String,
    @SerialName("goal_description") val goalDescription: String = "",
    @SerialName("goal_count") val goalCount: Int,
    @SerialName("xp_reward") val xpReward: Int = 50,
    val type: String = "daily", // daily, weekly, monthly
    @SerialName("expires_at") val expiresAt: String = ""
)

@Serializable
data class ChallengesResponse(
    val challenges: List<ChallengeData> = emptyList()
)