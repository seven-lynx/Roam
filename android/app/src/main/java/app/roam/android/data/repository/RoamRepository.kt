package app.roam.android.data.repository

import androidx.core.net.toUri
import app.roam.android.data.supabase
import app.roam.android.model.AppNotification
import app.roam.android.model.Badge
import app.roam.android.model.CategoryItem
import app.roam.android.model.ChallengeData
import app.roam.android.model.ChallengesResponse
import app.roam.android.model.Collection
import app.roam.android.model.CollectionItem
import app.roam.android.model.RoamUrl
import app.roam.android.model.SavedUrl
import app.roam.android.model.SubcategoryItem
import app.roam.android.model.UserProfile
import app.roam.android.model.UserSettings
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.functions.functions
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.ktor.client.call.body
import io.ktor.client.statement.bodyAsText
import io.ktor.http.headersOf
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Outcome of a URL submission. Lets the UI distinguish duplicates from real failures. */
sealed interface SubmitResult {
    data class Queued(val message: String) : SubmitResult
    data class Duplicate(val message: String) : SubmitResult
    data class Failed(val message: String) : SubmitResult
}

/**
 * Thrown when the roam edge function returns a retryable error (503) — e.g. the
 * DB RPC raised, timed out, or the circuit breaker is open. The UI should show
 * a retryable error, NOT the "exhausted" end-of-content screen.
 */
class RetryableRoamException(message: String) : Exception(message)

class RoamRepository {

    private val json = kotlinx.serialization.json.Json {
        ignoreUnknownKeys = true
        isLenient = true
        explicitNulls = false
    }

    /** Returns true if a user session is currently active and authenticated. */
    fun hasSession(): Boolean {
        val status = supabase.auth.sessionStatus.value
        return status is io.github.jan.supabase.auth.status.SessionStatus.Authenticated
    }

    /**
     * Attempts to ensure the user has a valid authenticated session with an actual
     * access token before making an API call.
     *
     * supabase-kt's sessionStatus can become Authenticated before the access token
     * is persisted to SharedPreferences. If we call functions.invoke() during that
     * window, the library sends a header-less request → 401 → UnauthorizedRestException.
     *
     * This function checks both the sessionStatus AND that currentAccessTokenOrNull()
     * returns a non-null token. If the token is missing despite Authenticated status,
     * it retries for up to 2 seconds (the library is asynchronously persisting the
     * token to storage in the background).
     *
     * If the session is not authenticated, attempts a one-time refresh.
     *
     * Returns true if a valid access token is now available.
     */
    private suspend fun ensureAuthenticated(): Boolean {
        val status = supabase.auth.sessionStatus.value
        val token = supabase.auth.currentAccessTokenOrNull()
        android.util.Log.d("RoamRepository", "ensureAuthenticated: status=$status token=${token?.take(8) ?: "null"}")

        // Not authenticated at all — attempt recovery via refresh
        if (status !is io.github.jan.supabase.auth.status.SessionStatus.Authenticated) {
            android.util.Log.w("RoamRepository", "Session not authenticated ($status); attempting refresh")
            try {
                supabase.auth.refreshCurrentSession()
                val newToken = supabase.auth.currentAccessTokenOrNull()
                android.util.Log.d("RoamRepository", "Refresh result: token=${newToken?.take(8) ?: "null"}")
                return verifyTokenAvailable()
            } catch (e: Exception) {
                android.util.Log.e("RoamRepository", "Session refresh failed: ${e.javaClass.simpleName}: ${e.message}", e)
                return false
            }
        }

        // Status says Authenticated — but the token may be expired (access tokens
        // expire after 1 hour, and the session persists beyond that). Proactively
        // refresh to get a valid token. supabase-kt's refreshCurrentSession() is
        // lightweight: it only makes a network call if the access token is actually
        // expired; if valid, it's a no-op that returns immediately.
        try {
            supabase.auth.refreshCurrentSession()
        } catch (e: Exception) {
            android.util.Log.e("RoamRepository", "Proactive refresh threw: ${e.javaClass.simpleName}: ${e.message}")
            // If refresh fails and we have no token, fail. Otherwise fall back to
            // the current token — the API call will surface a 401 if it's invalid.
            val currentToken = supabase.auth.currentAccessTokenOrNull()
            if (currentToken == null) {
                android.util.Log.e("RoamRepository", "No token available after refresh failure")
                return false
            }
            android.util.Log.w("RoamRepository", "Refresh failed but token exists; proceeding (${currentToken.take(8)}...)")
        }
        return verifyTokenAvailable()
    }

    /**
     * Checks that currentAccessTokenOrNull() returns a non-null value. If the token
     * hasn't materialized yet (race with SharedPreferences write after PKCE callback),
     * retries with short delays for up to 2 seconds.
     */
    private suspend fun verifyTokenAvailable(): Boolean {
        repeat(10) { attempt ->
            val token = supabase.auth.currentAccessTokenOrNull()
            if (token != null) {
                if (attempt > 0) {
                    android.util.Log.d("RoamRepository", "Access token became available after ${attempt * 200}ms")
                }
                return true
            }
            if (attempt < 9) {
                android.util.Log.w("RoamRepository", "Session is Authenticated but access token is null — waiting for persistence (attempt ${attempt + 1})")
                kotlinx.coroutines.delay(200)
            }
        }
        android.util.Log.e("RoamRepository", "Access token still null after 2s wait despite Authenticated status")
        return false
    }

    /**
     * Calls POST /functions/v1/roam.
     * Optionally restricts to a specific collection, subcategory, or category.
     *
     * Returns null ONLY on genuine pool exhaustion (server returns 404 with the
     * explicit `exhausted` marker). Any server error (503 — RPC exception, timeout,
     * or circuit breaker) throws [RetryableRoamException] so the UI shows a
     * retryable error instead of the misleading "exhausted" end-of-content screen.
     */
    suspend fun roam(
        collectionId: String? = null,
        excludeDomain: String? = null,
        categoryId: String? = null,
        subcategoryId: String? = null,
        prefetch: Boolean = false,
    ): RoamUrl? {
        val body = buildJsonObject {
            collectionId?.let { put("collection_id", it) }
            excludeDomain?.let { put("exclude_domain", it) }
            categoryId?.let { put("category_id", it) }
            subcategoryId?.let { put("subcategory_id", it) }
            if (prefetch) put("prefetch", true)
        }

        // Verify session is valid AND the access token is actually available
        // before the API call. This prevents the race where sessionStatus says
        // "Authenticated" but the token hasn't been persisted to SharedPreferences yet,
        // causing functions.invoke() to send a header-less request → 401.
        if (!ensureAuthenticated()) {
            val status = supabase.auth.sessionStatus.value
            throw IllegalStateException("Session not authenticated: $status")
        }

        return try {
            val response = supabase.functions.invoke("roam", body = body)
            if (response.status.value == 404) return null // genuine pool exhaustion
            if (response.status.value == 503) {
                throw RetryableRoamException("Discovery temporarily unavailable. Please try again.")
            }
            json.decodeFromString<RoamUrl>(response.bodyAsText())
        } catch (e: io.github.jan.supabase.exceptions.RestException) {
            if (e.statusCode == 404) return null // genuine pool exhaustion — not an error
            if (e.statusCode == 503) {
                throw RetryableRoamException("Discovery temporarily unavailable. Please try again.")
            }
            throw e // re-throw real errors
        }
    }

    /**
     * Batch fetch multiple URLs in a single API call using the edge function's
     * `count` parameter. Returns up to [count] URLs (may be fewer if pool runs low).
     * Used by the prefetch warm-fill loop to reduce API calls from 27 to ~6.
     *
     * Returns emptyList ONLY on genuine pool exhaustion (404 with `exhausted` marker).
     * Any server error (503) throws [RetryableRoamException].
     */
    suspend fun roamBatch(
        count: Int = 5,
        collectionId: String? = null,
        excludeDomain: String? = null,
        categoryId: String? = null,
        subcategoryId: String? = null,
        prefetch: Boolean = true,
    ): List<RoamUrl> {
        val body = buildJsonObject {
            put("count", count)
            collectionId?.let { put("collection_id", it) }
            excludeDomain?.let { put("exclude_domain", it) }
            categoryId?.let { put("category_id", it) }
            subcategoryId?.let { put("subcategory_id", it) }
            if (prefetch) put("prefetch", true)
        }

        if (!ensureAuthenticated()) {
            val status = supabase.auth.sessionStatus.value
            throw IllegalStateException("Session not authenticated: $status")
        }

        return try {
            val response = supabase.functions.invoke("roam", body = body)
            if (response.status.value == 404) return emptyList() // genuine pool exhaustion
            if (response.status.value == 503) {
                throw RetryableRoamException("Discovery temporarily unavailable. Please try again.")
            }
            json.decodeFromString<List<RoamUrl>>(response.bodyAsText())
        } catch (e: io.github.jan.supabase.exceptions.RestException) {
            if (e.statusCode == 404) return emptyList() // genuine pool exhaustion — not an error
            if (e.statusCode == 503) {
                throw RetryableRoamException("Discovery temporarily unavailable. Please try again.")
            }
            throw e
        }
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
    suspend fun submitUrl(url: String, categoryId: String? = null, subcategoryId: String? = null): SubmitResult {
        // Verify session is valid AND the access token is actually available
        // before the API call. This prevents the race where sessionStatus says
        // "Authenticated" but the token hasn't been persisted to SharedPreferences yet,
        // causing functions.invoke() to send a header-less request → 401.
        if (!ensureAuthenticated()) {
            val status = supabase.auth.sessionStatus.value
            return SubmitResult.Failed("Session not authenticated: $status")
        }
        val body = buildJsonObject {
            put("url", url)
            categoryId?.let { put("category_id", it) }
            subcategoryId?.let { put("subcategory_id", it) }
        }
        // supabase-kt raises on non-2xx; the body text still parses as our JSON error shape.
        val (status, text) = try {
            val response = supabase.functions.invoke("submit-url", body = body)
            response.status.value to runCatching { response.bodyAsText() }.getOrNull().orEmpty()
        } catch (e: io.github.jan.supabase.exceptions.RestException) {
            e.statusCode to (e.message.orEmpty())
        }
        val parsed = runCatching {
            (Json.parseToJsonElement(text) as? JsonObject)
        }.getOrNull()
        val message = (parsed?.get("message") as? kotlinx.serialization.json.JsonPrimitive)?.content
            ?: (parsed?.get("error") as? kotlinx.serialization.json.JsonPrimitive)?.content
        val duplicateFlag = (parsed?.get("duplicate") as? kotlinx.serialization.json.JsonPrimitive)?.content == "true"
        return when {
            duplicateFlag || status == 409 ->
                SubmitResult.Duplicate(message ?: "This URL is already in our database.")
            status in 200..299 ->
                SubmitResult.Queued(message ?: "Submitted for review — thanks!")
            status == 503 ->
                SubmitResult.Failed(message ?: "Safety check unavailable — try again in a moment")
            status == 429 ->
                SubmitResult.Failed(message ?: "Too many submissions — wait an hour and try again")
            else ->
                SubmitResult.Failed(message ?: "Something went wrong — please try again")
        }
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
        // Build a partial upsert — only include columns explicitly set.
        // On INSERT (new user), unspecified columns receive their DB defaults.
        // On CONFLICT (existing row), only the specified columns are overwritten,
        // eliminating the read-then-write race of the previous implementation.
        val patch = buildJsonObject {
            put("user_id", userId)
            preferredLanguages?.let { langs ->
                put("preferred_languages", buildJsonArray { langs.forEach { add(it) } })
            }
            skipPaywalled?.let { put("skip_paywalled", it) }
        }
        supabase.postgrest.from("user_settings").upsert(patch)
    }

    suspend fun getCategories(): List<CategoryItem> {
        return supabase.postgrest
            .from("categories")
            .select(Columns.list("id", "name", "icon", "sort_order")) {
                order("sort_order", Order.ASCENDING)
            }
            .decodeList()
    }

    suspend fun getSubcategories(): List<SubcategoryItem> {
        return supabase.postgrest
            .from("subcategories")
            .select(Columns.list("id", "name", "category_id", "sort_order")) {
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
     * Returns all URL items in [collectionId], newest first.
     * The nested `urls` join provides title and URL string.
     */
    suspend fun getCollectionItems(collectionId: String): List<CollectionItem> =
        supabase.postgrest
            .from("collection_items")
            .select(Columns.raw("added_at, urls(id, url, title)")) {
                filter { eq("collection_id", collectionId) }
                order("added_at", Order.DESCENDING)
            }
            .decodeList()

    /**
     * Creates a new collection.
     * Returns the created collection.
     */
    suspend fun createCollection(name: String): Collection {
        val body = buildJsonObject {
            put("action", "create")
            put("name", name)
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
     * Renames a collection.
     */
    suspend fun renameCollection(collectionId: String, name: String) {
        val body = buildJsonObject {
            put("action", "update")
            put("id", collectionId)
            put("name", name)
        }
        supabase.functions.invoke("collection", body = body)
    }

    /**
     * Deletes a collection and all its items.
     */
    suspend fun deleteCollection(collectionId: String) {
        val body = buildJsonObject {
            put("action", "delete")
            put("id", collectionId)
        }
        supabase.functions.invoke("collection", body = body)
    }

    /**
     * Toggles a collection's public/private status.
     */
    suspend fun updateCollectionPublic(collectionId: String, isPublic: Boolean) {
        val body = buildJsonObject {
            put("action", "update")
            put("id", collectionId)
            put("is_public", isPublic)
        }
        supabase.functions.invoke("collection", body = body)
    }

    /**
     * Removes a URL item from a collection.
     */
    suspend fun removeItemFromCollection(collectionId: String, urlId: String) {
        val body = buildJsonObject {
            put("action", "remove_item")
            put("collection_id", collectionId)
            put("url_id", urlId)
        }
        supabase.functions.invoke("collection", body = body)
    }

    /**
     * Looks up the URL record for [url] — returns its ID and category_id if known.
     */
    suspend fun checkUrl(url: String): RoamUrl? {
        val results = supabase.postgrest
            .from("urls")
            .select(Columns.list("id", "url", "category_id")) {
                filter { eq("url", url) }
                limit(1)
            }
            .decodeList<RoamUrl>()
        return results.firstOrNull()
    }

    /**
     * Returns the current user's server-side saved-for-later list, newest first.
     * Used to sync the Android app with saves made on the web or other devices.
     */
    suspend fun getSavedUrls(): List<SavedUrl> {
        supabase.auth.currentUserOrNull() ?: return emptyList()
        return supabase.postgrest
            .from("saved_urls")
            .select(Columns.list("url", "title")) {
                order("saved_at", Order.DESCENDING)
            }
            .decodeList()
    }

    /** Saves a URL to the server-side saved_urls table. */
    suspend fun saveUrl(url: String, title: String, urlId: String? = null) {
        if (!ensureAuthenticated()) return
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

    /**
     * Sends user feedback via a Supabase edge function.
     */
    suspend fun sendFeedback(message: String, email: String?) {
        val body = buildJsonObject {
            put("message", message)
            email?.let { put("email", it) }
        }
        supabase.functions.invoke("send-feedback", body = body)
    }

    // ── Profile ───────────────────────────────────────────────────────────────

    /** Fetches the current user's profile row. Returns null if none exists yet. */
    suspend fun getProfile(): UserProfile? {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return null
        return supabase.postgrest
            .from("profiles")
            .select {
                filter { eq("id", userId) }
                limit(1)
            }
            .decodeList<UserProfile>()
            .firstOrNull()
    }

    /** Upserts the user's profile (username, display_name, bio). */
    suspend fun updateProfile(username: String, displayName: String, bio: String?) {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return
        supabase.postgrest
            .from("profiles")
            .upsert(ProfileUpdateRow(id = userId, username = username, displayName = displayName, bio = bio))
    }

    /** Updates the profile's is_public flag. */
    suspend fun updateProfilePublic(isPublic: Boolean) {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return
        supabase.postgrest
            .from("profiles")
            .update(mapOf("is_public" to isPublic)) { filter { eq("id", userId) } }
    }

    /**
     * Returns the set of subcategory IDs the user has selected (topic mode).
     * Returns an empty set when the user is in pillar mode.
     */
    suspend fun getUserTopicIds(): Set<String> {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return emptySet()
        return supabase.postgrest
            .from("user_categories")
            .select(Columns.list("subcategory_id")) {
                filter { eq("user_id", userId) }
            }
            .decodeList<TopicIdRow>()
            .asSequence()
            .mapNotNull { it.subcategoryId }
            .toSet()
    }

    /**
     * Replaces all user_categories rows for the current user.
     * In pillar mode [topicIds] is empty; in topic mode [pillarIds] is empty.
     * [subcategoryParentMap] maps subcategoryId → categoryId for topic rows.
     */
    suspend fun saveUserInterests(
        pillarIds: Set<String>,
        topicIds: Set<String>,
        subcategoryParentMap: Map<String, String>,
    ) {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return
        supabase.postgrest.from("user_categories").delete {
            filter { eq("user_id", userId) }
        }
        val rows: List<UserCategoryFullRow> = pillarIds.map { catId ->
            UserCategoryFullRow(userId = userId, categoryId = catId)
        } + topicIds.mapNotNull { subId ->
            val catId = subcategoryParentMap[subId] ?: return@mapNotNull null
            UserCategoryFullRow(userId = userId, categoryId = catId, subcategoryId = subId)
        }
        if (rows.isNotEmpty()) {
            supabase.postgrest.from("user_categories").insert(rows)
        }
    }

    /**
     * Returns the set of category IDs the user has selected (pillar mode).
     * Returns an empty set when the user is in topic mode.
     */
    suspend fun getUserCategoryIds(): Set<String> {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return emptySet()
        return supabase.postgrest
            .from("user_categories")
            .select(Columns.list("category_id")) {
                filter { eq("user_id", userId) }
            }
            .decodeList<CategoryIdRow>()
            .map { it.categoryId }
            .toSet()
    }

    /** Adds or removes a whole-category selection for the current user. */
    suspend fun setUserCategory(categoryId: String, selected: Boolean) {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return
        if (selected) {
            supabase.postgrest.from("user_categories").upsert(
                UserCategoryInsertRow(userId = userId, categoryId = categoryId),
            ) { ignoreDuplicates = true }
        } else {
            // Delete all rows for this category (whole-category + any subcategory refinements)
            supabase.postgrest.from("user_categories").delete {
                filter {
                    eq("user_id", userId)
                    eq("category_id", categoryId)
                }
            }
        }
    }

    /**
     * Returns (pagesRoamed, pagesSubmitted) counts for the current user.
     * Fetches only the `id` column and counts client-side — supabase-kt BOM 3.0.2
     * does not expose Columns.NONE or a `count` parameter on select().
     * Both default to 0 on error.
     */
    suspend fun getProfileStats(): Pair<Int, Int> {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return 0 to 0
        val roamed = runCatching {
            supabase.postgrest.from("ratings")
                .select(Columns.list("id")) { filter { eq("user_id", userId) } }
                .decodeList<IdRow>().size
        }.getOrDefault(0)
        val submitted = runCatching {
            supabase.postgrest.from("urls")
                .select(Columns.list("id")) { filter { eq("submitted_by", userId) } }
                .decodeList<IdRow>().size
        }.getOrDefault(0)
        return roamed to submitted
    }

    /** Fetches the current user's badge progress via the get_user_badges RPC. */
    suspend fun getBadges(): List<Badge> {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return emptyList()
        return runCatching {
            supabase.postgrest
                .rpc("get_user_badges", buildJsonObject { put("p_user_id", userId) })
                .decodeList<Badge>()
        }.getOrDefault(emptyList())
    }

    /** Fetches the current user's active challenges with progress. */
    suspend fun getChallenges(): List<ChallengeData> {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return emptyList()
        return runCatching {
            val response = supabase.functions.invoke("challenges")
            val text = response.bodyAsText()
            val wrapper = json.decodeFromString<ChallengesResponse>(text)
            wrapper.challenges
        }.getOrDefault(emptyList())
    }

    /**
     * Fetches the leaderboard for a given [period] (weekly, monthly, all_time).
     * Calls the 'leaderboard' edge function which returns { period, entries, updated_at }.
     */
    suspend fun getLeaderboard(period: String): List<app.roam.android.model.LeaderboardEntry> {
        val body = buildJsonObject {
            put("period", period)
        }
        val response = supabase.functions.invoke("leaderboard", body = body)
        val text = runCatching { response.bodyAsText() }.getOrNull() ?: "{}"
        val wrapper = json.decodeFromString<LeaderboardResponse>(text)
        return wrapper.entries
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    @Serializable
    data class IdRow(val id: String)

    @Serializable
    data class ProfileUpdateRow(
        val id: String,
        val username: String,
        @SerialName("display_name") val displayName: String,
        val bio: String?,
    )

    @Serializable
    data class UserCategoryFullRow(
        @SerialName("user_id") val userId: String,
        @SerialName("category_id") val categoryId: String,
        @SerialName("subcategory_id") val subcategoryId: String? = null,
    )

    @Serializable
    data class TopicIdRow(
        @SerialName("subcategory_id") val subcategoryId: String? = null,
    )

    @Serializable
    data class CategoryIdRow(
        @SerialName("category_id") val categoryId: String,
    )

    // ── Notifications ───────────────────────────────────────────────────────

    /** Fetches unread notification count for the current user. Returns 0 on error. */
    suspend fun getUnreadNotificationCount(): Int {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return 0
        return runCatching {
            supabase.postgrest.from("notifications")
                .select(Columns.list("id")) {
                    filter {
                        eq("user_id", userId)
                        eq("read", false)
                    }
                }
                .decodeList<IdRow>().size
        }.getOrDefault(0)
    }

    /** Fetches recent notifications for the current user. */
    suspend fun getNotifications(limit: Int = 20): List<AppNotification> {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return emptyList()
        return runCatching {
            supabase.postgrest.from("notifications")
                .select {
                    filter {
                        eq("user_id", userId)
                    }
                    order("created_at", Order.DESCENDING)
                    limit(limit.toLong())
                }
                .decodeList<AppNotification>()
        }.getOrDefault(emptyList())
    }

    /** Marks all unread notifications as read for the current user. */
    suspend fun markAllNotificationsRead() {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return
        runCatching {
            supabase.postgrest.from("notifications")
                .update({ set("read", true) }) {
                    filter {
                        eq("user_id", userId)
                        eq("read", false)
                    }
                }
        }
    }

    // ── Follow system ──────────────────────────────────────────────────────

    /** Follows a user. Calls the follow Edge Function for immediate follow + badge evaluation. */
    suspend fun follow(targetUserId: String) {
        val body = buildJsonObject {
            put("action", "follow")
            put("following_id", targetUserId)
        }
        supabase.functions.invoke("follow", body = body)
    }

    /** Unfollows a user via the follow Edge Function. */
    suspend fun unfollow(targetUserId: String) {
        val body = buildJsonObject {
            put("action", "unfollow")
            put("following_id", targetUserId)
        }
        supabase.functions.invoke("follow", body = body)
    }

    /**
     * Checks whether the current user is following [targetUserId].
     * Returns "following" or "none".
     */
    suspend fun getFollowStatus(targetUserId: String): String {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return "none"
        val result = supabase.postgrest
            .from("follows")
            .select(Columns.list("id")) {
                filter {
                    eq("follower_id", userId)
                    eq("following_id", targetUserId)
                }
                limit(1)
            }
            .decodeList<IdRow>()
        return if (result.isNotEmpty()) "following" else "none"
    }

    /** Returns the follower count for [userId]. */
    suspend fun getFollowerCount(userId: String): Int {
        return supabase.postgrest
            .from("follows")
            .select(Columns.list("id")) {
                filter { eq("following_id", userId) }
            }
            .decodeList<IdRow>().size
    }

    /** Returns the following count for [userId]. */
    suspend fun getFollowingCount(userId: String): Int {
        return supabase.postgrest
            .from("follows")
            .select(Columns.list("id")) {
                filter { eq("follower_id", userId) }
            }
            .decodeList<IdRow>().size
    }

    /** Returns the list of users following [userId], newest first. */
    suspend fun getFollowers(userId: String): List<app.roam.android.model.FollowUser> {
        val followRows = supabase.postgrest
            .from("follows")
            .select(Columns.list("follower_id")) {
                filter { eq("following_id", userId) }
                order("created_at", Order.DESCENDING)
            }
            .decodeList<FollowerIdRow>()

        val followerIds = followRows.mapNotNull { it.followerId }
        if (followerIds.isEmpty()) return emptyList()

        return supabase.postgrest
            .from("profiles")
            .select(Columns.list("id", "username", "display_name", "avatar_url")) {
                filter { isIn("id", followerIds) }
            }
            .decodeList<app.roam.android.model.FollowUser>()
    }

    /** Returns the list of users [userId] is following, newest first. */
    suspend fun getFollowing(userId: String): List<app.roam.android.model.FollowUser> {
        val followRows = supabase.postgrest
            .from("follows")
            .select(Columns.list("following_id")) {
                filter { eq("follower_id", userId) }
                order("created_at", Order.DESCENDING)
            }
            .decodeList<FollowingIdRow>()

        val followingIds = followRows.mapNotNull { it.followingId }
        if (followingIds.isEmpty()) return emptyList()

        return supabase.postgrest
            .from("profiles")
            .select(Columns.list("id", "username", "display_name", "avatar_url")) {
                filter { isIn("id", followingIds) }
            }
            .decodeList<app.roam.android.model.FollowUser>()
    }

    // ── Public profiles ─────────────────────────────────────────────────────

    /**
     * Fetches a user's public profile via the profile Edge Function.
     * Returns follower/following counts, public collections, badges, and gamification data.
     * Returns null for non-existent or private profiles.
     */
    suspend fun getPublicProfile(username: String): app.roam.android.model.PublicProfile? {
        val body = buildJsonObject { put("username", username) }
        return runCatching {
            val response = supabase.functions.invoke("profile", body = body)
            json.decodeFromString<app.roam.android.model.PublicProfile>(response.bodyAsText())
        }.getOrNull()
    }

    // ── User search ─────────────────────────────────────────────────────────

    /** Searches for users by username or display name. Returns up to 20 matches. */
    suspend fun searchUsers(query: String): List<app.roam.android.model.FollowUser> {
        if (query.isBlank()) return emptyList()
        return supabase.postgrest
            .from("profiles")
            .select(Columns.list("id", "username", "display_name", "avatar_url")) {
                filter {
                    ilike("username", "%$query%")
                    eq("is_public", true)
                }
                order("username", Order.ASCENDING)
                limit(20)
            }
            .decodeList<app.roam.android.model.FollowUser>()
    }

    // ── Share URL with user ─────────────────────────────────────────────────

    /** Sends a URL to another user. Triggers a push notification. */
    suspend fun shareUrl(recipientId: String, urlId: String) {
        val body = buildJsonObject {
            put("action", "share")
            put("recipient_id", recipientId)
            put("url_id", urlId)
        }
        supabase.functions.invoke("share-url", body = body)
    }

    /** Returns users the current user can share URLs with (mutual follows: followers + following). */
    suspend fun getShareRecipients(query: String? = null): List<app.roam.android.model.FollowUser> {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return emptyList()

        // People I follow
        val followingIds = supabase.postgrest
            .from("follows")
            .select(Columns.list("following_id")) {
                filter {
                    eq("follower_id", userId)
                    eq("is_pending", false)
                }
            }
            .decodeList<FollowingIdRow>()
            .mapNotNull { it.followingId }

        // People who follow me
        val followerIds = supabase.postgrest
            .from("follows")
            .select(Columns.list("follower_id")) {
                filter {
                    eq("following_id", userId)
                    eq("is_pending", false)
                }
            }
            .decodeList<FollowerIdRow>()
            .mapNotNull { it.followerId }

        val allIds = (followingIds + followerIds).distinct()
        if (allIds.isEmpty()) return emptyList()

        val results = supabase.postgrest
            .from("profiles")
            .select(Columns.list("id", "username", "display_name", "avatar_url")) {
                filter {
                    isIn("id", allIds)
                }
                order("username", Order.ASCENDING)
            }
            .decodeList<app.roam.android.model.FollowUser>()

        if (query.isNullOrBlank()) return results

        return results.filter {
            it.username.contains(query, ignoreCase = true) ||
            it.displayName.contains(query, ignoreCase = true)
        }
    }

    // ── Activity feed ────────────────────────────────────────────────────────

    /** Fetches the activity feed from followed users via the get_activity_feed RPC. */
    suspend fun getActivityFeed(limit: Int = 30): List<app.roam.android.model.ActivityFeedItem> {
        supabase.auth.currentUserOrNull() ?: return emptyList()
        return runCatching {
            supabase.postgrest
                .rpc("get_activity_feed", buildJsonObject { put("p_limit", limit.toString()) })
                .decodeList<app.roam.android.model.ActivityFeedItem>()
        }.getOrDefault(emptyList())
    }

    @Serializable
    private data class LeaderboardResponse(
        val entries: List<app.roam.android.model.LeaderboardEntry> = emptyList(),
    )

    @Serializable
    data class FollowerIdRow(@SerialName("follower_id") val followerId: String)

    @Serializable
    data class FollowingIdRow(@SerialName("following_id") val followingId: String)

    /** Deletes a single notification by ID. Only allows deletion of the current user's notifications. */
    suspend fun deleteNotification(notificationId: String) {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return
        runCatching {
            supabase.postgrest.from("notifications").delete {
                filter {
                    eq("id", notificationId)
                    eq("user_id", userId)
                }
            }
        }
    }

    // ── Push tokens ──────────────────────────────────────────────────────────

    /** Registers an FCM token for the current user. Called by FCMService on token refresh. */
    suspend fun registerPushToken(token: String) {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return
        runCatching {
            supabase.postgrest.from("push_tokens").upsert(
                mapOf(
                    "user_id" to userId,
                    "platform" to "android",
                    "token" to token,
                )
            )
        }.onFailure { e ->
            android.util.Log.w("RoamRepository", "Push token registration failed (likely duplicate): ${e.message}")
        }
    }

    /** Deletes all Android push tokens for the current user. Called when notifications are disabled. */
    suspend fun unregisterPushTokens() {
        val userId = supabase.auth.currentUserOrNull()?.id ?: return
        runCatching {
            supabase.postgrest.from("push_tokens").delete {
                filter {
                    eq("user_id", userId)
                    eq("platform", "android")
                }
            }
        }
    }

    @Serializable
    data class UserCategoryInsertRow(
        @SerialName("user_id") val userId: String,
        @SerialName("category_id") val categoryId: String,
    )

    // ── Admin / Moderator ─────────────────────────────────────────────────────

    /**
     * Fetches the moderation queue via the admin-moderation edge function.
     * Requires JWT with app_metadata.role = 'admin' or 'moderator'.
     */
    suspend fun getAdminQueue(): List<app.roam.android.model.AdminQueueItem> {
        if (!ensureAuthenticated()) return emptyList()
        val body = buildJsonObject { put("action", "list") }
        val response = supabase.functions.invoke("admin-moderation", body = body)
        if (response.status.value == 404) return emptyList()
        return runCatching {
            json.decodeFromString<List<app.roam.android.model.AdminQueueItem>>(response.bodyAsText())
        }.getOrDefault(emptyList())
    }

    /** Approves a pending submission — calls admin-moderation edge function. */
    suspend fun approveSubmission(id: String): app.roam.android.model.AdminActionResponse {
        val body = buildJsonObject {
            put("action", "approve")
            put("id", id)
        }
        return runCatching {
            val response = supabase.functions.invoke("admin-moderation", body = body)
            json.decodeFromString<app.roam.android.model.AdminActionResponse>(response.bodyAsText())
        }.getOrElse {
            app.roam.android.model.AdminActionResponse(ok = false, error = it.message)
        }
    }

    /** Rejects a pending submission — calls admin-moderation edge function. */
    suspend fun rejectSubmission(id: String): app.roam.android.model.AdminActionResponse {
        val body = buildJsonObject {
            put("action", "reject")
            put("id", id)
        }
        return runCatching {
            val response = supabase.functions.invoke("admin-moderation", body = body)
            json.decodeFromString<app.roam.android.model.AdminActionResponse>(response.bodyAsText())
        }.getOrElse {
            app.roam.android.model.AdminActionResponse(ok = false, error = it.message)
        }
    }

    /** Fetches aggregated admin stats (pending/approved/rejected counts + reports). */
    suspend fun getAdminStats(): app.roam.android.model.AdminStats {
        val body = buildJsonObject { put("action", "stats") }
        return runCatching {
            val response = supabase.functions.invoke("admin-moderation", body = body)
            json.decodeFromString<app.roam.android.model.AdminStats>(response.bodyAsText())
        }.getOrDefault(app.roam.android.model.AdminStats())
    }

    /** Fetches dead link reports via the admin-moderation edge function. */
    suspend fun getAdminReports(): List<app.roam.android.model.AdminReportItem> {
        val body = buildJsonObject { put("action", "reports") }
        return runCatching {
            val response = supabase.functions.invoke("admin-moderation", body = body)
            json.decodeFromString<List<app.roam.android.model.AdminReportItem>>(response.bodyAsText())
        }.getOrDefault(emptyList())
    }

    /** Restores a reported (inactive) link by setting inactive=false on the URL. */
    suspend fun restoreReportedLink(urlId: String): app.roam.android.model.AdminActionResponse {
        val body = buildJsonObject {
            put("action", "restore")
            put("url_id", urlId)
        }
        return runCatching {
            val response = supabase.functions.invoke("admin-moderation", body = body)
            json.decodeFromString<app.roam.android.model.AdminActionResponse>(response.bodyAsText())
        }.getOrElse {
            app.roam.android.model.AdminActionResponse(ok = false, error = it.message)
        }
    }

    /** Fetches beta signups from the public beta_signups table (admin only). */
    suspend fun getBetaSignups(): List<app.roam.android.model.AdminBetaSignup> {
        // Beta signups are fetched via a direct postgrest query using the admin
        // role. Since the JWT carries app_metadata.role, RLS policies allow
        // admin users to read from beta_signups.
        return runCatching {
            supabase.postgrest
                .from("beta_signups")
                .select(Columns.list("id", "email", "created_at")) {
                    order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                }
                .decodeList<app.roam.android.model.AdminBetaSignup>()
        }.getOrDefault(emptyList())
    }

    /** Deletes a beta signup by ID (admin only). */
    suspend fun deleteBetaSignup(id: Int): app.roam.android.model.AdminActionResponse {
        return runCatching {
            supabase.postgrest.from("beta_signups").delete {
                filter { eq("id", id) }
            }
            app.roam.android.model.AdminActionResponse(ok = true, message = "Deleted")
        }.getOrElse {
            app.roam.android.model.AdminActionResponse(ok = false, error = it.message)
        }
    }

}
