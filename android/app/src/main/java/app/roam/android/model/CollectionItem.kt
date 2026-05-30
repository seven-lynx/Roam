package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** A single item in a collection, including the joined URL fields. */
@Serializable
data class CollectionItem(
    @SerialName("added_at") val addedAt: String? = null,
    val urls: CollectionItemUrl,
)

@Serializable
data class CollectionItemUrl(
    val id: String,
    val url: String,
    val title: String? = null,
)
