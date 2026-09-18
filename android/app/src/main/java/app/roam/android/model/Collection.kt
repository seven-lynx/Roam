package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Collection(
    val id: String,
    val name: String,
    val slug: String,
    @SerialName("is_public") val isPublic: Boolean = true,
    @SerialName("item_count") val itemCount: Int = 0,
)
