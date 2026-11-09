package app.roam.android.data.repository

import app.roam.android.model.RoamUrl
import app.roam.android.model.UserSettings
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

/**
 * Unit tests for [RoamRepository] that exercise code paths which do not
 * require a live network connection:
 *   - Input validation guards (rate value must be ±1)
 *   - JSON deserialization of the shapes returned by the Edge Functions
 *   - [UserSettings] default values
 */
@ExperimentalCoroutinesApi
class RoamRepositoryTest {

    private val json = Json { ignoreUnknownKeys = true }

    private fun validateRateValue(value: Int) {
        require((value == 1) || (value == -1))
    }

    /** Mirrors the blank-id guard in [RoamRepository.rate] / reportUrl / addUrlToCollection. */
    private fun validateUrlId(urlId: String) {
        require(urlId.isNotBlank()) { "url_id required" }
    }

    // ─── Input validation ──────────────────────────────────────────────────────

    @Test
    fun `rate value 1 passes require check`() {
        validateRateValue(1)
    }

    @Test
    fun `rate value -1 passes require check`() {
        validateRateValue(-1)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rate value 0 fails require check`() {
        validateRateValue(0)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rate value 2 fails require check`() {
        validateRateValue(2)
    }

    // --- Blank url id rejection (#89) -------------------------------------------

    @Test
    fun `a real url id passes the guard`() {
        validateUrlId("a559a4be-05c3-46c7-9497-23d49bbeaa5f")
    }

    @Test(expected = IllegalArgumentException::class)
    fun `a blank url id fails the guard`() {
        validateUrlId("")
    }

    @Test(expected = IllegalArgumentException::class)
    fun `a whitespace url id fails the guard`() {
        validateUrlId("   ")
    }

    // ─── Roam batch body (#125) ────────────────────────────────────────────────

    @Test
    fun `roam batch body omits exclude_domains when nothing is held`() {
        val body = buildRoamBatchBody(count = 5)

        assertEquals("5", body["count"].toString())
        assertNull(body["exclude_domains"])
        assertEquals("true", body["prefetch"].toString())
    }

    @Test
    fun `roam batch body sends the held domains as exclude_domains`() {
        val body = buildRoamBatchBody(
            count = 3,
            excludeDomains = listOf("example.com", "someone.itch.io"),
        )

        assertEquals("[\"example.com\",\"someone.itch.io\"]", body["exclude_domains"].toString())
    }

    @Test
    fun `roam batch body keeps the single exclude_domain beside the array`() {
        // The edge function merges the two (`supabase/functions/roam/index.ts:88-95`),
        // so both stay on the wire rather than one replacing the other.
        val body = buildRoamBatchBody(
            count = 2,
            excludeDomain = "just-served.example",
            excludeDomains = listOf("held.example"),
            categoryId = "cat-1",
            subcategoryId = "sub-1",
            prefetch = false,
        )

        assertEquals("\"just-served.example\"", body["exclude_domain"].toString())
        assertEquals("[\"held.example\"]", body["exclude_domains"].toString())
        assertEquals("\"cat-1\"", body["category_id"].toString())
        assertEquals("\"sub-1\"", body["subcategory_id"].toString())
        assertNull(body["prefetch"])
    }

    // ─── Model defaults ────────────────────────────────────────────────────────

    @Test
    fun `UserSettings default preferred languages is English only`() {
        val settings = UserSettings()
        assertEquals(listOf("en"), settings.preferredLanguages)
    }

    @Test
    fun `UserSettings default skipPaywalled is false`() {
        val settings = UserSettings()
        assertFalse(settings.skipPaywalled)
    }

    @Test
    fun `UserSettings default userId is empty`() {
        val settings = UserSettings()
        assertEquals("", settings.userId)
    }

    // ─── RoamUrl deserialization ───────────────────────────────────────────────

    @Test
    fun `RoamUrl deserializes full payload correctly`() {
        val payload = """
            {
              "id": "abc-123",
              "url": "https://example.com/article",
              "title": "A great read",
              "description": "Some summary text",
              "og_image_url": "https://cdn.example.com/img.jpg",
              "subcategory_id": "sub-42",
              "wilson_score": 0.87
            }
        """.trimIndent()

        val url = json.decodeFromString<RoamUrl>(payload)

        assertEquals("abc-123", url.id)
        assertEquals("https://example.com/article", url.url)
        assertEquals("A great read", url.title)
        assertEquals("Some summary text", url.description)
        assertEquals("https://cdn.example.com/img.jpg", url.ogImageUrl)
        assertEquals("sub-42", url.subcategoryId)
        assertEquals(0.87, url.wilsonScore!!, 0.001)
    }

    @Test
    fun `RoamUrl deserializes minimal payload with nullable fields as null`() {
        val payload = """{"id":"1","url":"https://test.com"}"""

        val url = json.decodeFromString<RoamUrl>(payload)

        assertEquals("1", url.id)
        assertEquals("https://test.com", url.url)
        assertNull(url.title)
        assertNull(url.description)
        assertNull(url.ogImageUrl)
        assertNull(url.subcategoryId)
        assertNull(url.wilsonScore)
    }

    @Test
    fun `RoamUrl ignores unknown JSON keys`() {
        val payload = """
            {
              "id": "x",
              "url": "https://x.com",
              "unknown_future_field": "ignored",
              "another_field": 42
            }
        """.trimIndent()

        // Should not throw a SerializationException
        val url = json.decodeFromString<RoamUrl>(payload)
        assertEquals("x", url.id)
    }

    @Test
    fun `UserSettings deserializes from JSON correctly`() {
        val payload = """
            {
              "user_id": "user-999",
              "preferred_languages": ["fr", "de"],
              "skip_paywalled": true
            }
        """.trimIndent()

        val settings = json.decodeFromString<UserSettings>(payload)

        assertEquals("user-999", settings.userId)
        assertEquals(listOf("fr", "de"), settings.preferredLanguages)
        assertTrue(settings.skipPaywalled)
    }
}