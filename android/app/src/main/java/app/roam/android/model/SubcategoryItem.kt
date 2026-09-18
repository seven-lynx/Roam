package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SubcategoryItem(
    val id: String,
    val name: String,
    @SerialName("category_id") val categoryId: String,
    @SerialName("sort_order") val sortOrder: Int = 0,
)
