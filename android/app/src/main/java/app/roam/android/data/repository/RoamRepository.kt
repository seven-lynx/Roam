package app.roam.android.data.repository

import app.roam.android.data.supabase
import app.roam.android.model.RoamUrl
import io.github.jan.supabase.functions.functions
import io.ktor.client.call.body
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class RoamRepository {

    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Calls POST /functions/v1/roam.
     * Optionally restricts to a specific collection.
     * Returns null on 404 (pool exhausted).
     */
    suspend fun roam(collectionId: String? = null, excludeDomain: String? = null): RoamUrl? {
        val body = buildJsonObject {
            collectionId?.let { put("collection_id", it) }
            excludeDomain?.let { put("exclude_domain", it) }
        }
        val response = supabase.functions.invoke("roam", body = body)
        if (response.status.value == 404) return null
        return json.decodeFromString(response.body())
    }

    /**
     * Calls POST /functions/v1/rate.
     * [value] must be 1 (thumbs up) or -1 (thumbs down).
     */
    suspend fun rate(urlId: String, value: Int) {
        require(value == 1 || value == -1)
        val body = buildJsonObject {
            put("url_id", urlId)
            put("value", value)
        }
        supabase.functions.invoke("rate", body = body)
    }

    /**
     * Calls POST /functions/v1/submit-url.
     * [url] is required; [subcategoryId] is the user-selected category chip.
     */
    suspend fun submitUrl(url: String, subcategoryId: String? = null) {
        val body = buildJsonObject {
            put("url", url)
            subcategoryId?.let { put("subcategory_id", it) }
        }
        supabase.functions.invoke("submit-url", body = body)
    }
}
