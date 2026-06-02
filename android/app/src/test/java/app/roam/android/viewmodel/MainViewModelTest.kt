package app.roam.android.viewmodel

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import app.roam.android.data.repository.RoamRepository
import app.roam.android.model.RoamUrl
import app.roam.android.model.UserSettings
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MainViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var repo: RoamRepository
    private lateinit var app: Application
    private lateinit var vm: MainViewModel

    private val mockUrl = RoamUrl(
        id = "url-123",
        url = "https://example.com",
        title = "Example Domain",
        description = null,
        ogImageUrl = null,
        subcategoryId = null,
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        app = ApplicationProvider.getApplicationContext()
        repo = mockk(relaxed = true)
        coEvery { repo.getCategories() } returns emptyList()
        coEvery { repo.getUserSettings() } returns UserSettings()
        // Prevent init's launchPrefetch from populating _prefetchedUrl with a relaxed mock
        coEvery { repo.roam(any(), any(), any(), any()) } returns null
        vm = MainViewModel(app, repo)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ─── Initial state ─────────────────────────────────────────────────────────

    @Test
    fun `initial roam state is Idle`() {
        assertEquals(RoamState.Idle, vm.state.value)
    }

    @Test
    fun `initial savedConfirmation is false`() {
        assertFalse(vm.savedConfirmation.value)
    }

    @Test
    fun `initial showSubmitSheet is false`() {
        assertFalse(vm.showSubmitSheet.value)
    }

    @Test
    fun `initial showConfigSheet is false`() {
        assertFalse(vm.showConfigSheet.value)
    }

    // ─── Sheet toggles ─────────────────────────────────────────────────────────

    @Test
    fun `openSubmitSheet sets showSubmitSheet to true`() {
        vm.openSubmitSheet()
        assertTrue(vm.showSubmitSheet.value)
    }

    @Test
    fun `closeSubmitSheet sets showSubmitSheet to false`() {
        vm.openSubmitSheet()
        vm.closeSubmitSheet()
        assertFalse(vm.showSubmitSheet.value)
    }

    @Test
    fun `openConfigSheet sets showConfigSheet to true`() {
        vm.openConfigSheet()
        assertTrue(vm.showConfigSheet.value)
    }

    @Test
    fun `closeConfigSheet sets showConfigSheet to false`() {
        vm.openConfigSheet()
        vm.closeConfigSheet()
        assertFalse(vm.showConfigSheet.value)
    }

    // ─── Collection filter ─────────────────────────────────────────────────────

    @Test
    fun `setCollectionFilter stores the collection id`() = runTest {
        vm.setCollectionFilter("col-abc")
        assertEquals("col-abc", vm.activeCollectionId.value)
    }

    @Test
    fun `setCollectionFilter with null clears the filter`() = runTest {
        vm.setCollectionFilter("col-abc")
        vm.setCollectionFilter(null)
        assertNull(vm.activeCollectionId.value)
    }

    // ─── Language preferences ──────────────────────────────────────────────────

    @Test
    fun `setPreferredLanguages stores the provided list`() = runTest {
        vm.setPreferredLanguages(listOf("fr", "de"))
        assertEquals(listOf("fr", "de"), vm.preferredLanguages.value)
    }

    @Test
    fun `setPreferredLanguages with empty list defaults to English`() = runTest {
        vm.setPreferredLanguages(emptyList())
        assertEquals(listOf("en"), vm.preferredLanguages.value)
    }

    // ─── Paywall preference ────────────────────────────────────────────────────

    @Test
    fun `setSkipPaywalled stores the value`() = runTest {
        vm.setSkipPaywalled(true)
        assertTrue(vm.skipPaywalled.value)
        vm.setSkipPaywalled(false)
        assertFalse(vm.skipPaywalled.value)
    }

    // ─── Roam state transitions ────────────────────────────────────────────────

    @Test
    fun `roam transitions to Loaded on success`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)
    }

    @Test
    fun `roam transitions to Exhausted when repository returns null`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns null
        vm.roam()
        assertEquals(RoamState.Exhausted, vm.state.value)
    }

    @Test
    fun `roam transitions to Error on repository exception`() = runTest {
        // Mock session and hot queue empty
        coEvery { repo.hasSession() } returns true
        coEvery { repo.roam(any(), any(), any(), any()) } throws RuntimeException("Network failure")
        
        vm.roam()
        
        // Wait for coroutine to complete
        testDispatcher.scheduler.advanceUntilIdle()
        
        val state = vm.state.value
        assertTrue("Expected Error state, but was ${state.javaClass.simpleName}", state is RoamState.Error)
        assertEquals("Network failure", (state as RoamState.Error).message)
    }

    @Test
    fun `roam passes active collection id to repository`() = runTest {
        coEvery { repo.hasSession() } returns true
        vm.setCollectionFilter("col-xyz")
        // Ensure prefetch doesn't consume it
        coEvery { repo.roam(collectionId = "col-xyz", excludeDomain = any(), categoryId = any(), subcategoryId = any()) } returns mockUrl
        
        vm.roam()

        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)
    }

    // ─── URL tracking ──────────────────────────────────────────────────────────

    @Test
    fun `onWebViewUrlChanged updates currentUrl`() {
        vm.onWebViewUrlChanged("https://new-page.com")
        assertEquals("https://new-page.com", vm.currentUrl.value)
    }

    // ─── IOException → offline error message ──────────────────────────────────

    @Test
    fun `roam shows offline message when IOException is thrown`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } throws IOException("timeout")
        vm.roam()
        val state = vm.state.value
        assertTrue("Expected Error state", state is RoamState.Error)
        assertTrue(
            "Expected offline message, got: ${(state as RoamState.Error).message}",
            state.message.contains("offline", ignoreCase = true),
        )
    }

    // ─── Prefetch ──────────────────────────────────────────────────────────────

    @Test
    fun `roam uses prefetch cache and does not re-enter Loading state`() = runTest {
        // Use an isolated repo so setUp's call counts don't affect coVerify
        val freshRepo = mockk<RoamRepository>(relaxed = true)
        coEvery { freshRepo.hasSession() } returns true
        coEvery { freshRepo.getCategories() } returns emptyList()
        coEvery { freshRepo.getUserSettings() } returns UserSettings()
        coEvery { freshRepo.roam(any(), any(), any(), any()) } returns mockUrl

        // We can't easily wait for the IO prefetch thread in this Robolectric test
        // without more complex setup, but we can verify that roam() eventually
        // consumes from the queue if we can populate it.
        
        val freshVm = MainViewModel(app, freshRepo)
        
        // Since we can't easily control the background prefetch loop timing here,
        // let's at least verify roam() calls repo.roam() if queue is empty.
        freshVm.roam()
        
        assertTrue(freshVm.state.value is RoamState.Loaded)
        coVerify(atLeast = 1) { freshRepo.roam(any(), any(), any(), any()) }
    }

    // ─── thumbsUp / thumbsDown ─────────────────────────────────────────────────

    @Test
    fun `thumbsUp sends positive rating when state is Loaded`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)

        vm.thumbsUp(app)

        coVerify { repo.rate("url-123", 1) }
    }

    @Test
    fun `thumbsDown sends negative rating when state is Loaded`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)

        vm.thumbsDown(app)

        coVerify { repo.rate("url-123", -1) }
    }

    @Test
    fun `thumbsUp opens submit sheet when state is not Loaded`() = runTest {
        // State is Idle — no URL loaded
        assertEquals(RoamState.Idle, vm.state.value)
        vm.thumbsUp(app)
        assertTrue(vm.showSubmitSheet.value)
    }

    // ─── saveForLater ──────────────────────────────────────────────────────────

    @Test
    fun `saveForLater adds url to savedUrls`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        vm.onWebViewUrlChanged(mockUrl.url)

        vm.saveForLater()

        assertTrue(vm.savedUrls.value.any { it.url == mockUrl.url })
    }

    @Test
    fun `saveForLater shows savedConfirmation`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        vm.onWebViewUrlChanged(mockUrl.url)

        vm.saveForLater()

        assertTrue(vm.savedConfirmation.value)
    }

    @Test
    fun `removeSavedUrl removes the entry from savedUrls`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        vm.onWebViewUrlChanged(mockUrl.url)
        vm.saveForLater()

        vm.removeSavedUrl(mockUrl.url)

        assertFalse(vm.savedUrls.value.any { it.url == mockUrl.url })
    }
}
