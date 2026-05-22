package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Response shape from POST /functions/v1/roam */
@Serializable
data class RoamUrl(
    val id: String,
    val url: String,
    val title: String? = null,
    val description: String? = null,
    @SerialName("og_image_url") val ogImageUrl: String? = null,
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("wilson_score") val wilsonScore: Double? = null,
)

