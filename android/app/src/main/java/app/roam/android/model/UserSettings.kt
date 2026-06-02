package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class UserSettings(
    @SerialName("user_id") val userId: String = "",
    @SerialName("preferred_languages") val preferredLanguages: List<String> = listOf("en"),
    @SerialName("skip_paywalled") val skipPaywalled: Boolean = false,
)
