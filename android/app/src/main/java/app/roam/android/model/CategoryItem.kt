package app.roam.android.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CategoryItem(
    val id: String,
    val name: String,
    val icon: String,
    @SerialName("sort_order") val sortOrder: Int = 0,
) {
    companion object {
        val FALLBACK = listOf(
            CategoryItem("c1000000-0000-0000-0000-000000000001", "Science & Nature", "🔬"),
            CategoryItem("c1000000-0000-0000-0000-000000000002", "Technology",       "💻"),
            CategoryItem("c1000000-0000-0000-0000-000000000003", "Arts & Culture",   "🎨"),
            CategoryItem("c1000000-0000-0000-0000-000000000004", "History & Ideas",  "📜"),
            CategoryItem("c1000000-0000-0000-0000-000000000005", "Games & Hobbies",  "🎮"),
            CategoryItem("c1000000-0000-0000-0000-000000000006", "Weird & Wonderful","🌀"),
            CategoryItem("c1000000-0000-0000-0000-000000000007", "People & Places",  "🌍"),
            CategoryItem("c1000000-0000-0000-0000-000000000008", "Mind & Body",      "🧠"),
        )
    }
}
