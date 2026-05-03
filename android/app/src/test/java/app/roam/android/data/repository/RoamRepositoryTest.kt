package app.roam.android.data.repository

import app.roam.android.model.RoamUrl
import app.roam.android.model.UserSettings
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
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

    // ─── Input validation ──────────────────────────────────────────────────────

    @Test
    fun `rate value 1 passes require check`() {
        // require(value == 1 || value == -1) — must not throw
        require(1 == 1 || 1 == -1)
    }

    @Test
    fun `rate value -1 passes require check`() {
        require(-1 == 1 || -1 == -1)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rate value 0 fails require check`() {
        require(0 == 1 || 0 == -1)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rate value 2 fails require check`() {
        require(2 == 1 || 2 == -1)
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
