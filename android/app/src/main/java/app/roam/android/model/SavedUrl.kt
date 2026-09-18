package app.roam.android.model

import kotlinx.serialization.Serializable

@Serializable
data class SavedUrl(val url: String, val title: String)
