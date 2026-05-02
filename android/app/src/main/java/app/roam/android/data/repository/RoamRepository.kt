package app.roam.android.data.repository

import app.roam.android.data.supabase
import app.roam.android.model.CategoryItem
import app.roam.android.model.Collection
import app.roam.android.model.RoamUrl
import app.roam.android.model.UserSettings
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.ktor.client.call.body
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class RoamRepository {

    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Calls POST /functions/v1/roam.
     * Optionally restricts to a specific collection or subcategory.
     * Returns null on 404 (pool exhausted).
     */
    suspend fun roam(
        collectionId: String? = null,
        excludeDomain: String? = null,
        subcategoryId: String? = null,
    ): RoamUrl? {
        val body = buildJsonObject {
            collectionId?.let { put("collection_id", it) }
            excludeDomain?.let { put("exclude_domain", it) }
            subcategoryId?.let { put("subcategory_id", it) }
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

    /**
     * Reads the current user's settings row.
     * Returns defaults (en, no paywall skip) if no row exists yet.
     */
    suspend fun getUserSettings(): UserSettings {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return UserSettings()
        val results = supabase.postgrest
            .from("user_settings")
            .select(Columns.list("preferred_languages", "skip_paywalled")) {
                filter { eq("user_id", userId) }
                limit(1)
            }
            .decodeList<UserSettings>()
        return results.firstOrNull() ?: UserSettings(userId = userId)
    }

    /**
     * Upserts user settings (preferred_languages and/or skip_paywalled).
     */
    suspend fun upsertUserSettings(
        preferredLanguages: List<String>? = null,
        skipPaywalled: Boolean? = null,
    ) {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return
        val current = getUserSettings()
        supabase.postgrest
            .from("user_settings")
            .upsert(
                UserSettings(
                    userId = userId,
                    preferredLanguages = preferredLanguages ?: current.preferredLanguages,
                    skipPaywalled = skipPaywalled ?: current.skipPaywalled,
                )
            )
    }

    /**
     * Returns all categories, ordered by sort_order.
     */
    suspend fun getCategories(): List<CategoryItem> {
        return supabase.postgrest
            .from("categories")
            .select(Columns.list("id", "name", "icon", "sort_order")) {
                order("sort_order", Order.ASCENDING)
            }
            .decodeList()
    }

    /**
     * Returns the authenticated user's collections, ordered by name.
     */
    suspend fun getCollections(): List<Collection> {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return emptyList()
        return supabase.postgrest
            .from("collections")
            .select {
                filter { eq("user_id", userId) }
                order("name", Order.ASCENDING)
            }
            .decodeList()
    }

    /**
     * Creates a new collection. [slug] is auto-derived from [name] if not provided.
     * Returns the created collection.
     */
    suspend fun createCollection(name: String): Collection {
        val slug = name.lowercase()
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
            .take(60)
        val body = buildJsonObject {
            put("action", "create")
            put("name", name)
            put("slug", slug)
        }
        val response = supabase.functions.invoke("collection", body = body)
        return json.decodeFromString(response.body())
    }

    /**
     * Adds a URL to a collection by URL ID.
     */
    suspend fun addUrlToCollection(collectionId: String, urlId: String) {
        val body = buildJsonObject {
            put("action", "add_item")
            put("collection_id", collectionId)
            put("url_id", urlId)
        }
        supabase.functions.invoke("collection", body = body)
    }

    /**
     * Looks up the URL record for [url] — returns its ID and subcategory_id if known.
     */
    suspend fun checkUrl(url: String): RoamUrl? {
        val results = supabase.postgrest
            .from("urls")
            .select(Columns.list("id", "url", "subcategory_id")) {
                filter { eq("url", url) }
                limit(1)
            }
            .decodeList<RoamUrl>()
        return results.firstOrNull()
    }

    /** Saves a URL to the server-side saved_urls table. */
    suspend fun saveUrl(url: String, title: String, urlId: String? = null) {
        val body = buildJsonObject {
            put("action", "save")
            put("url", url)
            put("title", title)
            urlId?.let { put("url_id", it) }
        }
        supabase.functions.invoke("save-url", body = body)
    }

    /** Removes a URL from the server-side saved_urls table. */
    suspend fun unsaveUrl(url: String) {
        val body = buildJsonObject {
            put("action", "unsave")
            put("url", url)
        }
        supabase.functions.invoke("save-url", body = body)
    }

    /**
     * Reports a URL as broken/dead. Sets urls.inactive = TRUE on the server.
     */
    suspend fun reportUrl(urlId: String) {
        val body = buildJsonObject {
            put("url_id", urlId)
        }
        supabase.functions.invoke("report-url", body = body)
    }
}
