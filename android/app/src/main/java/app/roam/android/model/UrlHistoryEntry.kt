package app.roam.android.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class UrlHistoryEntry(
    val url: String,
    val title: String,
    val timestamp: Long = System.currentTimeMillis(),
)

val urlHistoryJson = Json { ignoreUnknownKeys = true }

fun serializeHistory(list: List<UrlHistoryEntry>): String =
    urlHistoryJson.encodeToString(list)

fun deserializeHistory(raw: String): List<UrlHistoryEntry> =
    runCatching { urlHistoryJson.decodeFromString<List<UrlHistoryEntry>>(raw) }
        .getOrDefault(emptyList())