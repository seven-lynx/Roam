package app.roam.android.viewmodel

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import app.roam.android.data.repository.RoamRepository
import app.roam.android.model.RoamUrl
import app.roam.android.model.UserSettings
import io.mockk.coEvery
import io.mockk.mockk
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
        coEvery { repo.roam(any(), any(), any()) } returns mockUrl
        vm.roam()
        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)
    }

    @Test
    fun `roam transitions to Exhausted when repository returns null`() = runTest {
        coEvery { repo.roam(any(), any(), any()) } returns null
        vm.roam()
        assertEquals(RoamState.Exhausted, vm.state.value)
    }

    @Test
    fun `roam transitions to Error on repository exception`() = runTest {
        coEvery { repo.roam(any(), any(), any()) } throws RuntimeException("Network failure")
        vm.roam()
        val state = vm.state.value
        assertTrue(state is RoamState.Error)
        assertEquals("Network failure", (state as RoamState.Error).message)
    }

    @Test
    fun `roam passes active collection id to repository`() = runTest {
        vm.setCollectionFilter("col-xyz")
        coEvery { repo.roam(collectionId = "col-xyz", excludeDomain = any(), subcategoryId = any()) } returns mockUrl
        vm.roam()
        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)
    }

    // ─── URL tracking ──────────────────────────────────────────────────────────

    @Test
    fun `onWebViewUrlChanged updates currentUrl`() {
        vm.onWebViewUrlChanged("https://new-page.com")
        assertEquals("https://new-page.com", vm.currentUrl.value)
    }
}
