package app.roam.android.viewmodel

import android.app.Application
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.lifecycle.viewModelScope
import app.roam.android.data.repository.RoamRepository
import app.roam.android.model.Collection
import app.roam.android.model.RoamUrl
import app.roam.android.model.UserSettings
import app.roam.android.ui.theme.RoamThemeVariant
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.StandardTestDispatcher
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

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var repo: RoamRepository
    private lateinit var app: Application
    private lateinit var vm: MainViewModel

    /** Every ViewModel this test built, so [tearDown] can stop its coroutines. */
    private val createdViewModels = mutableListOf<MainViewModel>()

    /** Session flag the mocked repository reports; see [setUp]. */
    private var signedInSession = false

    private val mockUrl = RoamUrl(
        id = "url-123",
        url = "https://example.com",
        title = "Example Domain",
        description = null,
        ogImageUrl = null,
        subcategoryId = null,
    )

    private fun newViewModel(repository: RoamRepository = repo): MainViewModel =
        MainViewModel(app, repository).also { createdViewModels += it }

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        app = ApplicationProvider.getApplicationContext()
        // Prefetch must stay off for the whole class. startPrefillQueue() launches
        // viewModelScope workers on Dispatchers.IO whose `while (true)` loops call
        // roamBatch() forever; under a test scheduler they never idle, so leaked
        // loops from earlier tests exhaust the worker heap (OutOfMemoryError) and
        // every later test in this class fails. The pref is read in a property
        // initialiser, so it has to be set before the ViewModel is constructed.
        app.getSharedPreferences("roam_saved", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("prefetch_webview", false)
            .apply()
        repo = mockk(relaxed = true)
        coEvery { repo.getCategories() } returns emptyList()
        coEvery { repo.getUserSettings() } returns UserSettings()
        coEvery { repo.roam(any(), any(), any(), any()) } returns null
        // Belt and braces: an empty batch means even a restarted prefill worker
        // backs off through delay() instead of spinning.
        coEvery { repo.roamBatch(any(), any(), any(), any(), any(), any()) } returns emptyList()
        // hasSession() must be false while the ViewModel is constructed: init
        // launches `while (isActive) { delay(60_000); checkForNewCelebrations() }`
        // when it is true, and advanceUntilIdle() would spin that endless loop
        // forever on virtual time (OutOfMemoryError).
        coEvery { repo.hasSession() } answers { signedInSession }
        vm = newViewModel()
        // Every test then behaves as a signed-in user: thumbsUp/thumbsDown and
        // roam() both bail out early when hasSession() is false.
        signedInSession = true
    }

    @After
    fun tearDown() {
        // Cancel every ViewModel the test created — including one that never
        // became `vm` — so a failed setUp can't make tearDown throw.
        createdViewModels.forEach { runCatching { it.viewModelScope.cancel() } }
        createdViewModels.clear()
        // MockK holds every mock and stub it has ever created. One relaxed repository
        // mock per test is enough to exhaust the 2 GB test heap by the end of this class
        // (it died at test 46/52 on an otherwise clean tree), so drop them here.
        clearAllMocks()
        org.robolectric.shadows.ShadowLooper.idleMainLooper()
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

    // ─── Cartridge shelf (MENU key as home key) ────────────────────────────────

    @Test
    fun `initial programsOpen is false`() {
        assertFalse(vm.programsOpen.value)
    }

    @Test
    fun `openPrograms sets programsOpen to true and dismisses the launcher`() {
        vm.openConfigSheet()
        vm.openPrograms()
        assertTrue(vm.programsOpen.value)
        assertFalse(vm.showConfigSheet.value)
    }

    @Test
    fun `closePrograms sets programsOpen to false`() {
        vm.openPrograms()
        vm.closePrograms()
        assertFalse(vm.programsOpen.value)
    }

    @Test
    fun `resetForNewSession closes the shelf and every overlay`() {
        vm.openConfigSheet()
        vm.openPrograms()
        vm.openTranslatePicker()
        vm.resetForNewSession()
        assertFalse(vm.programsOpen.value)
        assertFalse(vm.showConfigSheet.value)
        assertFalse(vm.showTranslatePicker.value)
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
        vm.setSkipPaywalled(value = true)
        assertTrue(vm.skipPaywalled.value)
        vm.setSkipPaywalled(value = false)
        assertFalse(vm.skipPaywalled.value)
    }

    // ─── Roam state transitions ────────────────────────────────────────────────

    @Test
    fun `roam transitions to Loaded on success`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        testDispatcher.scheduler.advanceUntilIdle()
        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)
    }

    @Test
    fun `roam transitions to Exhausted when repository returns null`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns null
        vm.roam()
        testDispatcher.scheduler.advanceUntilIdle()
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

    // ─── Loading overlay reveal latch ──────────────────────────────────────────

    @Test
    fun `onPageRevealed holds the ROAM-OS finish beat with the overlay still up`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        // runCurrent, not advanceUntilIdle: the 12 s fail-open reveal timer must
        // not fire, or it would open the latch this test is asserting stays shut.
        testDispatcher.scheduler.runCurrent()
        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)
        assertFalse("roam() must close the reveal latch", vm.webViewReady.value)

        vm.onPageRevealed()

        assertFalse("the page must stay covered for the beat", vm.webViewReady.value)
        assertTrue("the finish beat must be playing", vm.revealFinishing.value)

        testDispatcher.scheduler.advanceTimeBy(300)
        testDispatcher.scheduler.runCurrent()
        assertFalse("the beat is not over yet", vm.webViewReady.value)

        testDispatcher.scheduler.advanceTimeBy(300)
        testDispatcher.scheduler.runCurrent()
        assertTrue("the page is revealed once the beat ends", vm.webViewReady.value)
        assertFalse(vm.revealFinishing.value)
    }

    @Test
    fun `onPageRevealed reveals immediately on the classic theme`() = runTest {
        // The finish beat is a ROAM-OS scan-screen flourish; classic reveals at once.
        app.getSharedPreferences("roam_saved", Context.MODE_PRIVATE)
            .edit()
            .putString("app_theme_variant", "classic")
            .apply()
        // Build it with the session off, then sign in for roam(): constructing a
        // ViewModel while a session exists starts init's 60 s celebration loop, and this
        // test's runTest drain then advances virtual time through it until the heap dies.
        // That runaway is what took out the last tests of this class on a clean tree.
        signedInSession = false
        val classicVm = try {
            newViewModel()
        } finally {
            signedInSession = true
        }
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        classicVm.roam()
        testDispatcher.scheduler.runCurrent()
        assertEquals(RoamState.Loaded(mockUrl), classicVm.state.value)

        classicVm.onPageRevealed()

        assertTrue(classicVm.webViewReady.value)
        assertFalse(classicVm.revealFinishing.value)

        // Restore the shipped default so a later test that builds a ViewModel
        // still gets the ROAM-OS scan overlay.
        app.getSharedPreferences("roam_saved", Context.MODE_PRIVATE)
            .edit()
            .putString("app_theme_variant", "roam_os")
            .apply()
    }

    @Test
    fun `a second reveal callback does not restart the finish beat`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        testDispatcher.scheduler.runCurrent()

        vm.onPageRevealed()
        testDispatcher.scheduler.advanceTimeBy(300)
        testDispatcher.scheduler.runCurrent()
        // onPageFinished lands right after onPageCommitVisible on a real device.
        vm.onPageRevealed()
        testDispatcher.scheduler.advanceTimeBy(300)
        testDispatcher.scheduler.runCurrent()

        assertTrue("the beat must not outlive its original 500 ms", vm.webViewReady.value)
        assertFalse(vm.revealFinishing.value)
    }

    @Test
    fun `a failed load reveals at once, even mid-beat`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        testDispatcher.scheduler.runCurrent()
        vm.onPageRevealed()
        assertTrue(vm.revealFinishing.value)

        // onReceivedError during the beat — the "couldn't load" box must be
        // reachable immediately instead of waiting out the scan.
        vm.onPageRevealed(playFinishBeat = false)

        assertTrue(vm.webViewReady.value)
        assertFalse(vm.revealFinishing.value)

        // The cancelled beat must not fire afterwards.
        testDispatcher.scheduler.advanceTimeBy(600)
        testDispatcher.scheduler.runCurrent()
        assertTrue(vm.webViewReady.value)
        assertFalse(vm.revealFinishing.value)
    }

    @Test
    fun `a new page load cancels a playing finish beat`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        testDispatcher.scheduler.runCurrent()
        vm.onPageRevealed()
        assertTrue(vm.revealFinishing.value)

        // Translating re-arms the latch; the stale beat must not reveal the page
        // that is now loading.
        vm.toggleTranslation()
        assertFalse(vm.revealFinishing.value)
        assertFalse(vm.webViewReady.value)

        testDispatcher.scheduler.advanceTimeBy(600)
        testDispatcher.scheduler.runCurrent()
        assertFalse("the cancelled beat must not open the latch", vm.webViewReady.value)
    }

    // ─── IOException → offline error message ──────────────────────────────────

    @Test
    fun `roam shows offline message when IOException is thrown`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } throws IOException("timeout")
        vm.roam()
        testDispatcher.scheduler.advanceUntilIdle()
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
        // The session flag must be false *while the ViewModel is constructed*:
        // init launches `while (isActive) { delay(60_000); checkForNewCelebrations() }`
        // when hasSession() is true, and advanceUntilIdle() would then advance
        // virtual time through that endless loop forever (OOM).
        var signedIn = false
        coEvery { freshRepo.hasSession() } answers { signedIn }
        coEvery { freshRepo.getCategories() } returns emptyList()
        coEvery { freshRepo.getUserSettings() } returns UserSettings()
        coEvery { freshRepo.roam(any(), any(), any(), any()) } returns mockUrl

        val freshVm = newViewModel(freshRepo)

        // Now let roam() see an authenticated session.
        signedIn = true
        freshVm.roam()
        testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(freshVm.state.value is RoamState.Loaded)
        coVerify(atLeast = 1) { freshRepo.roam(any(), any(), any(), any()) }
    }

    @Test
    fun `roam publishes queue sizes so the deck readouts do not stay at zero`() = runTest {
        val warmUrl = RoamUrl(
            id = "url-456",
            url = "https://warm.example.org",
            title = "Warm Domain",
            description = null,
            ogImageUrl = null,
            subcategoryId = null,
        )
        // Seed the queues directly: roam() serves the hot entry instantly and
        // leaves the warm one queued. Both sizes must reach the deck's
        // READY/BUFFER readouts — they read 00 forever while the publisher was
        // defined but never called.
        vm.hotQueue.addLast(mockUrl)
        vm.warmQueue.addLast(warmUrl)

        vm.roam()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)
        assertEquals("READY should track the drained hot queue", 0, vm.hotQueueSize.value)
        assertEquals("BUFFER should track the queued warm entry", 1, vm.warmQueueSize.value)
    }

    // ─── thumbsUp / thumbsDown ─────────────────────────────────────────────────

    @Test
    fun `thumbsUp sends positive rating when state is Loaded`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        testDispatcher.scheduler.advanceUntilIdle()
        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)

        vm.thumbsUp(app)
        // thumbsUp dispatches into viewModelScope; under StandardTestDispatcher the
        // coroutine only runs when the scheduler is advanced.
        testDispatcher.scheduler.advanceUntilIdle()

        coVerify { repo.rate("url-123", 1) }
    }

    @Test
    fun `thumbsDown sends negative rating when state is Loaded`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        testDispatcher.scheduler.advanceUntilIdle()
        assertEquals(RoamState.Loaded(mockUrl), vm.state.value)

        vm.thumbsDown(app)
        testDispatcher.scheduler.advanceUntilIdle()

        coVerify { repo.rate("url-123", -1) }
    }

    @Test
    fun `thumbsUp opens submit sheet when state is not Loaded`() = runTest {
        // State is Idle — no URL loaded
        assertEquals(RoamState.Idle, vm.state.value)
        vm.thumbsUp(app)
        testDispatcher.scheduler.advanceUntilIdle()
        assertTrue(vm.showSubmitSheet.value)
    }

    @Test
    fun `thumbsUp does not rate a placeholder page with no id`() = runTest {
        // navigateTo() loads internal pages into a Loaded state whose RoamUrl carries
        // no id. Posting that id is a 400 from the rate function (ROAM-ANDROID-5 /
        // -16), so a placeholder must be treated like an unknown page.
        vm.navigateTo("https://example.com/help")
        assertEquals("", (vm.state.value as RoamState.Loaded).roamUrl.id)

        vm.thumbsUp(app)
        testDispatcher.scheduler.advanceUntilIdle()

        coVerify(exactly = 0) { repo.rate(any(), any()) }
        assertTrue(vm.showSubmitSheet.value)
    }

    @Test
    fun `thumbsUp on an unknown URL flags a found signal`() = runTest {
        assertEquals(RoamState.Idle, vm.state.value)
        vm.thumbsUp(app)
        testDispatcher.scheduler.advanceUntilIdle()
        assertTrue(vm.submitSignalFound.value)
    }

    @Test
    fun `openSubmitSheet from comms does not flag a found signal`() = runTest {
        // The COMMS → Submit URL path is a plain submission, not a discovery.
        vm.openSubmitSheet()
        assertTrue(vm.showSubmitSheet.value)
        assertFalse(vm.submitSignalFound.value)
    }

    @Test
    fun `closeSubmitSheet clears the found-signal flag`() = runTest {
        vm.thumbsUp(app)
        vm.closeSubmitSheet()
        assertFalse(vm.showSubmitSheet.value)
        assertFalse(vm.submitSignalFound.value)
    }

    // ─── saveForLater ──────────────────────────────────────────────────────────

    @Test
    fun `saveForLater adds url to savedUrls`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        testDispatcher.scheduler.advanceUntilIdle()
        vm.onWebViewUrlChanged(mockUrl.url)

        vm.saveForLater()

        assertTrue(vm.savedUrls.value.any { (url) -> url == mockUrl.url })
    }

    @Test
    fun `saveForLater shows savedConfirmation`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        testDispatcher.scheduler.advanceUntilIdle()
        vm.onWebViewUrlChanged(mockUrl.url)

        vm.saveForLater()

        assertTrue(vm.savedConfirmation.value)
    }

    @Test
    fun `removeSavedUrl removes the entry from savedUrls`() = runTest {
        coEvery { repo.roam(any(), any(), any(), any()) } returns mockUrl
        vm.roam()
        testDispatcher.scheduler.advanceUntilIdle()
        vm.onWebViewUrlChanged(mockUrl.url)
        vm.saveForLater()

        vm.removeSavedUrl(mockUrl.url)

        assertFalse(vm.savedUrls.value.any { (url) -> url == mockUrl.url })
    }

    // ─── Theme variant / CRT effects / device frame ─────────────────────────────

    @Test
    fun `setThemeVariant switches to ROAM-OS`() {
        vm.setThemeVariant(RoamThemeVariant.ROAM_OS)
        assertEquals(RoamThemeVariant.ROAM_OS, vm.themeVariant.value)
    }

    @Test
    fun `setThemeVariant switches back to Classic`() {
        vm.setThemeVariant(RoamThemeVariant.ROAM_OS)
        vm.setThemeVariant(RoamThemeVariant.CLASSIC)
        assertEquals(RoamThemeVariant.CLASSIC, vm.themeVariant.value)
    }

    @Test
    fun `setCrtEffectsEnabled toggles the flag`() {
        vm.setCrtEffectsEnabled(false)
        assertFalse(vm.crtEffectsEnabled.value)
        vm.setCrtEffectsEnabled(true)
        assertTrue(vm.crtEffectsEnabled.value)
    }

    @Test
    fun `setDeviceFrameEnabled toggles the flag`() {
        vm.setDeviceFrameEnabled(false)
        assertFalse(vm.deviceFrameEnabled.value)
        vm.setDeviceFrameEnabled(true)
        assertTrue(vm.deviceFrameEnabled.value)
    }

    @Test
    fun `theme settings persist across ViewModel recreation`() {
        vm.setThemeVariant(RoamThemeVariant.ROAM_OS)
        vm.setCrtEffectsEnabled(false)
        vm.setDeviceFrameEnabled(false)

        val freshVm = newViewModel()
        assertEquals(RoamThemeVariant.ROAM_OS, freshVm.themeVariant.value)
        assertFalse(freshVm.crtEffectsEnabled.value)
        assertFalse(freshVm.deviceFrameEnabled.value)
    }

    // ─── Shell defaults & shell-scoped screen effects ───────────────────────────

    @Test
    fun `hardware embellishments are off by default`() {
        assertFalse(vm.hardwareFxMaster.value)
    }

    @Test
    fun `switching to Roam Classic disables screen effects`() {
        vm.setThemeVariant(RoamThemeVariant.CLASSIC)
        assertFalse(vm.crtEffectsEnabled.value)
    }

    @Test
    fun `switching back to ROAM-OS re-enables screen effects`() {
        vm.setThemeVariant(RoamThemeVariant.CLASSIC)
        vm.setThemeVariant(RoamThemeVariant.ROAM_OS)
        assertTrue(vm.crtEffectsEnabled.value)
    }

    @Test
    fun `returning to ROAM-OS restores a screen-effects setting the user had switched off`() {
        vm.setCrtEffectsEnabled(false)
        vm.setThemeVariant(RoamThemeVariant.CLASSIC)
        vm.setThemeVariant(RoamThemeVariant.ROAM_OS)
        assertFalse(vm.crtEffectsEnabled.value)
    }

    @Test
    fun `re-selecting the current shell keeps the screen-effects setting`() {
        vm.setThemeVariant(RoamThemeVariant.CLASSIC)
        vm.setCrtEffectsEnabled(true)
        vm.setThemeVariant(RoamThemeVariant.CLASSIC)
        assertTrue(vm.crtEffectsEnabled.value)
    }

    // ─── Deck system readout ───────────────────────────────────────────────────

    @Test
    fun `deck readout shows a diegetic line before anything is queued`() {
        val strip = vm.systemMessage.value
        assertFalse("the strip should never launch blank", strip.isBlank())
        assertTrue(strip.startsWith(DeckReadout.SEPARATOR))
        assertTrue(strip.endsWith(DeckReadout.SEPARATOR))
    }

    @Test
    fun `deck readout drains its queue and then stops rotating`() = runTest {
        vm.pushSystemMessage("SCANNING…")
        assertTrue(
            "the queued message should reach the strip immediately",
            vm.systemMessage.value.contains("SCANNING…"),
        )

        // Drain (4 s) plus the whole bounded idle window (READOUT_IDLE_TICKS × 12 s).
        // An unbounded rotation loop here would never let advanceUntilIdle return.
        testDispatcher.scheduler.advanceUntilIdle()

        val strip = vm.systemMessage.value
        assertFalse("the strip should not blank out while idle", strip.isBlank())
        assertFalse("the queued message should have scrolled off", strip.contains("SCANNING…"))
        assertTrue(strip.startsWith(DeckReadout.SEPARATOR))
    }

    // --- Last-page restore and pool-id guards (#89) -----------------------------

    /** Writes the cold-start prefs a previous session would have left behind. */
    private fun seedLastPage(lastUrl: String, lastTitle: String? = null, lastId: String? = null) {
        val editor = app.getSharedPreferences("roam_saved", Context.MODE_PRIVATE).edit()
            .putString("last_url", lastUrl)
        if (lastTitle != null) editor.putString("last_url_title", lastTitle)
        if (lastId != null) editor.putString("last_url_id", lastId) else editor.remove("last_url_id")
        editor.apply()
    }

    /**
     * Builds the ViewModel the way a cold start does: prefs already seeded, session
     * present *while* `init` runs. `init` then starts the 60 s celebration loop, so
     * callers must drive this with `runCurrent()`, never `advanceUntilIdle()`.
     */
    private fun newColdStartViewModel(): MainViewModel {
        signedInSession = true
        return newViewModel()
    }

    @Test
    fun `a restored page carries the url id the last session saved`() {
        seedLastPage("https://example.com", "Example Domain", "url-123")
        val coldVm = newColdStartViewModel()

        val state = coldVm.state.value
        assertTrue("the last page should be restored, was $state", state is RoamState.Loaded)
        val loaded = state as RoamState.Loaded
        assertEquals("url-123", loaded.roamUrl.id)
        assertEquals("https://example.com", loaded.roamUrl.url)
        assertEquals("Example Domain", loaded.roamUrl.title)
    }

    @Test
    fun `a restored page without a stored id resolves one from the pool`() {
        seedLastPage("https://example.com", "Example Domain")
        coEvery { repo.checkUrl("https://example.com") } returns RoamUrl(
            id = "url-123",
            url = "https://example.com",
            categoryId = "cat-1",
        )
        // No runTest: the cold-start init loop is live, so drive the scheduler by hand
        // and never advance virtual time through it.
        val coldVm = newColdStartViewModel()
        testDispatcher.scheduler.runCurrent()

        val loaded = coldVm.state.value as RoamState.Loaded
        assertEquals("the rehydrated page must carry the real id", "url-123", loaded.roamUrl.id)
        assertEquals(
            "checkUrl() selects no title, so the persisted one must survive",
            "Example Domain",
            loaded.roamUrl.title,
        )
        assertEquals(
            "the resolved id must be persisted for the next cold start",
            "url-123",
            app.getSharedPreferences("roam_saved", Context.MODE_PRIVATE).getString("last_url_id", null),
        )
    }

    @Test
    fun `a restored page that is not in the pool keeps its placeholder state`() {
        seedLastPage("https://roamtheweb.app/profile")
        coEvery { repo.checkUrl(any()) } returns null
        // No runTest for the same reason as the rehydration case above.
        val coldVm = newColdStartViewModel()
        testDispatcher.scheduler.runCurrent()

        val state = coldVm.state.value
        assertTrue("the page must still be shown, was $state", state is RoamState.Loaded)
        assertTrue("no id may be invented", (state as RoamState.Loaded).roamUrl.id.isBlank())
    }

    @Test
    fun `navigateTo resolves and persists the pool id of the page it opens`() = runTest {
        coEvery { repo.checkUrl("https://example.com") } returns RoamUrl(
            id = "url-123",
            url = "https://example.com",
        )
        vm.navigateTo("https://example.com")
        testDispatcher.scheduler.runCurrent()

        assertEquals("url-123", (vm.state.value as RoamState.Loaded).roamUrl.id)
        val prefs = app.getSharedPreferences("roam_saved", Context.MODE_PRIVATE)
        assertEquals("url-123", prefs.getString("last_url_id", null))
        assertEquals("https://example.com", prefs.getString("last_url", null))
    }

    @Test
    fun `navigateTo never replaces the last pool page with an internal one`() = runTest {
        seedLastPage("https://pool.example/page", "Pool page", "url-999")
        coEvery { repo.checkUrl(any()) } returns null

        vm.navigateTo("https://roamtheweb.app/profile")
        testDispatcher.scheduler.runCurrent()

        val prefs = app.getSharedPreferences("roam_saved", Context.MODE_PRIVATE)
        assertEquals(
            "the last pool page must survive a visit to an app page",
            "https://pool.example/page",
            prefs.getString("last_url", null),
        )
        assertEquals("url-999", prefs.getString("last_url_id", null))
    }

    @Test
    fun `reporting a page with no pool id posts nothing and claims nothing`() = runTest {
        coEvery { repo.checkUrl(any()) } returns null
        vm.navigateTo("https://not-in-pool.example/x")
        testDispatcher.scheduler.runCurrent()

        vm.reportBrokenLink()
        testDispatcher.scheduler.runCurrent()

        coVerify(exactly = 0) { repo.reportUrl(any()) }
        assertFalse(
            "no DEAD LINK confirmation may be shown for a report that was not sent",
            vm.reportConfirmation.value,
        )
    }

    @Test
    fun `adding a page with no pool id to a collection does not call the function`() = runTest {
        coEvery { repo.checkUrl(any()) } returns null
        vm.navigateTo("https://not-in-pool.example/x")
        testDispatcher.scheduler.runCurrent()

        vm.addCurrentUrlToCollection("col-1")
        testDispatcher.scheduler.runCurrent()

        coVerify(exactly = 0) { repo.addUrlToCollection(any(), any()) }
    }

    @Test
    fun `creating a collection from a page with no pool id never posts a blank url id`() = runTest {
        coEvery { repo.checkUrl(any()) } returns null
        coEvery { repo.createCollection("Later") } returns Collection(
            id = "col-1",
            name = "Later",
            slug = "later",
        )
        vm.navigateTo("https://not-in-pool.example/x")
        testDispatcher.scheduler.runCurrent()

        vm.createCollectionAndAdd("Later")
        testDispatcher.scheduler.runCurrent()

        coVerify(exactly = 1) { repo.createCollection("Later") }
        coVerify(exactly = 0) { repo.addUrlToCollection(any(), any()) }
    }
}