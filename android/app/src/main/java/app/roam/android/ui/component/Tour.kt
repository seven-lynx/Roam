package app.roam.android.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuOpen
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.CollectionsBookmark
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Gesture
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.ThumbDown
import androidx.compose.material.icons.outlined.ThumbUp
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ── Tour step definition ─────────────────────────────────────────────────────────────────

data class TourStep(
    val title: String,
    val description: String,
    val icon: ImageVector,
    val phase: String? = null,
)

// ── Mockup type: which illustrated strip to show above the title ─────────────────────────

enum class MockupType {
    NONE,
    BOTTOM_BAR_ROAM,
    BOTTOM_BAR_YOU,
    BOTTOM_BAR_ALL,
    INFO_STRIP,
    SHEET_HANDLE,
}

// ── Phase definitions ────────────────────────────────────────────────────────────────────

private enum class TourPhase(val label: String) {
    DISCOVERY("Core Discovery"),
    MENU("The Config Menu"),
    BROWSER("Browser Superpowers"),
    CONTROLS("Discovery Controls"),
    HUB("Your Hub"),
}

// ── All 19 tour steps ────────────────────────────────────────────────────────────────────

private class TourEntry(
    val step: TourStep,
    val mockup: MockupType = MockupType.NONE,
    val autoOpenSheet: Boolean = false,
    val autoSwitchToYou: Boolean = false,
)

private val TOUR_ENTRIES = listOf(
    // ── Phase 1: Core Discovery (0-2) ────────────────────────────────────────────────────
    TourEntry(
        step = TourStep(
            phase = TourPhase.DISCOVERY.label,
            title = "Meet the Bottom Bar",
            description = "Four buttons. That's it. We're not trying to be a Swiss Army knife here.\n\n" +
                "Skip (\uD83D\uDC4E) = not for you. Roam (\uD83E\uDDED) = surprise me. " +
                "You (\uD83D\uDC64) = your stuff. Like (\uD83D\uDC4D) = more of this please.\n\n" +
                "It's basically Tinder for web pages, except the pages don't ghost you.",
            icon = Icons.Filled.Explore,
        ),
        mockup = MockupType.BOTTOM_BAR_ALL,
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.DISCOVERY.label,
            title = "The Info Strip",
            description = "That little bar at the top? It tells you what category and domain you're looking at \u2014 " +
                "so when someone asks \"what are you reading?\" you can sound smart instead of saying \"some website.\"\n\n" +
                "It also shows warnings if you're offline. Which you won't be. Right?",
            icon = Icons.Filled.Visibility,
        ),
        mockup = MockupType.INFO_STRIP,
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.DISCOVERY.label,
            title = "Tap Roam. Repeat.",
            description = "Tap the Roam button. New page. Tap it again. New page. Again. Again.\n\n" +
                "It's like a slot machine for knowledge, except the house always wins... " +
                "and by 'house' we mean 'your brain getting slightly smarter.'\n\n" +
                "Go ahead, try it now. We'll wait.",
            icon = Icons.Filled.AutoAwesome,
        ),
        mockup = MockupType.BOTTOM_BAR_ROAM,
    ),

    // ── Phase 2: The Config Menu (3-6) ───────────────────────────────────────────────────
    TourEntry(
        step = TourStep(
            phase = TourPhase.MENU.label,
            title = "Pull Up. Go On.",
            description = "See that little arrow at the very bottom? Pull it up. Or tap it, depending on your settings.\n\n" +
                "There's a whole menu hiding under there. Like an iceberg, but with fewer sinking ships " +
                "and more useful features.\n\n(We've opened it for you. Take a look.)",
            icon = Icons.AutoMirrored.Filled.MenuOpen,
        ),
        mockup = MockupType.SHEET_HANDLE,
        autoOpenSheet = true,
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.MENU.label,
            title = "Save for Later",
            description = "Found something interesting but don't have time? Bookmark it.\n\n" +
                "It syncs to the web app too, so you can read it on your phone, tablet, " +
                "or that laptop you pretend to work on.\n\n" +
                "We won't judge how many you save. (We will. But silently.)",
            icon = Icons.Filled.BookmarkBorder,
        ),
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.MENU.label,
            title = "Share the Wealth",
            description = "Share via any app on your phone. Or share directly with a Roam friend " +
                "and they'll get a notification.\n\n" +
                "It's like saying \"hey look at this\" but without the awkward eye contact.",
            icon = Icons.Filled.Share,
        ),
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.MENU.label,
            title = "Collections = Playlists for Pages",
            description = "Add pages to collections. \"Articles to Read,\" \"Recipe Ideas,\" " +
                "\"Evidence for My Conspiracy Theories\" \u2014 whatever works.\n\n" +
                "You can even Roam within a collection, so the algorithm stays on-topic. " +
                "You're basically a curator now. Update your LinkedIn.",
            icon = Icons.Filled.CollectionsBookmark,
        ),
    ),

    // ── Phase 3: Browser Superpowers (7-10) ───────────────────────────────────────────────
    TourEntry(
        step = TourStep(
            phase = TourPhase.BROWSER.label,
            title = "Dark Mode",
            description = "Settings \u2192 Dark mode. Toggle it.\n\n" +
                "Your eyes will thank you at 2 AM when you're \"just checking one more page\" " +
                "and suddenly the sun is coming up.\n\n" +
                "We recommend dark mode always. Light mode is for spreadsheets.",
            icon = Icons.Filled.DarkMode,
        ),
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.BROWSER.label,
            title = "Auto-Translate",
            description = "Settings \u2192 Auto-translate. Pick a language. Boom.\n\n" +
                "Read French philosophy blogs without three years of Duolingo guilt. " +
                "Read Japanese cooking sites without knowing what 'umami' actually means.\n\n" +
                "It's Google Translate, but we do the work so you don't have to.",
            icon = Icons.Filled.Translate,
        ),
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.BROWSER.label,
            title = "The Power User Stuff",
            description = "JavaScript toggle: turn it off to dodge paywalls and tracking. " +
                "(Some sites will look broken. That's them, not you.)\n\n" +
                "Preload next page: loads the next URL in the background while you read. " +
                "Uses more data, feeds your impatience.\n\n" +
                "Both in Settings. You're welcome.",
            icon = Icons.Filled.Bolt,
        ),
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.BROWSER.label,
            title = "Menu Gesture: Slide or Tap?",
            description = "In Settings, you can choose how to open the menu: slide up or tap the handle.\n\n" +
                "This is the most controversial setting in the app. Friendships have ended over less.\n\n" +
                "Choose wisely. (Or don't. You can change it anytime.)",
            icon = Icons.Filled.Gesture,
        ),
    ),

    // ── Phase 4: Discovery Controls (11-13) ───────────────────────────────────────────────
    TourEntry(
        step = TourStep(
            phase = TourPhase.CONTROLS.label,
            title = "Focus Mode",
            description = "Settings \u2192 Focus Mode. Lock your Roams to a specific category or topic.\n\n" +
                "Want only car articles? Done. Only space stuff? Done. Only articles about " +
                "medieval bread-making techniques? Oddly specific, but also done.\n\n" +
                "Great for hyperfixation. We support it.",
            icon = Icons.Filled.Speed,
        ),
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.CONTROLS.label,
            title = "Skip Paywalled Sites",
            description = "Settings \u2192 Skip paywalled sites.\n\n" +
                "Toggle it on and we'll stop showing you articles from NYT, WSJ, and other sites " +
                "that want your credit card before they'll show you a paragraph.\n\n" +
                "Life's too short. So is your attention span.",
            icon = Icons.Filled.Block,
        ),
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.CONTROLS.label,
            title = "Preferred Languages",
            description = "Settings \u2192 Preferred Languages.\n\n" +
                "Filter what languages you want to see. English only? Fine. Every language? Also fine.\n\n" +
                "We support 12 languages. That's more than most people can name. " +
                "Set it and forget it \u2014 or don't, we're not the boss of you.",
            icon = Icons.Filled.Language,
        ),
    ),

    // ── Phase 5: Your Hub (14-18) ─────────────────────────────────────────────────────────
    TourEntry(
        step = TourStep(
            phase = TourPhase.HUB.label,
            title = "This Is YOU",
            description = "Tap the You tab. Go on, we'll switch you over.\n\n" +
                "This is your command center. Profile, stats, badges, followers \u2014 " +
                "it's like the cockpit of a plane, except the plane is your internet addiction.",
            icon = Icons.Filled.Person,
        ),
        mockup = MockupType.BOTTOM_BAR_YOU,
        autoSwitchToYou = true,
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.HUB.label,
            title = "Level Up. Literally.",
            description = "You gain XP for every page you Roam through and every thumbs-up you give.\n\n" +
                "It's like an RPG but instead of slaying dragons you're reading articles " +
                "about sourdough starters and F1 racing.\n\n" +
                "Your level and streak are right at the top of the You tab. Flex accordingly.",
            icon = Icons.AutoMirrored.Filled.TrendingUp,
        ),
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.HUB.label,
            title = "Badges & Leaderboard",
            description = "Collect badges for achievements. There are dozens of them. " +
                "Some are easy (first Roam!). Some are hard (100-day streak). " +
                "Some are just... weird.\n\n" +
                "The leaderboard shows who's roaming the most. " +
                "It's anonymous-ish, so you can be competitive without anyone knowing it's you.",
            icon = Icons.Filled.EmojiEvents,
        ),
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.HUB.label,
            title = "Activity Feed & Following",
            description = "Follow other Roamers and see what they're saving and rating.\n\n" +
                "It's social media but without the doomscrolling, political arguments, " +
                "or your aunt's questionable memes.\n\n" +
                "Search users, follow people, check the activity feed. Social, minus the toxic.",
            icon = Icons.Filled.Group,
        ),
    ),
    TourEntry(
        step = TourStep(
            phase = TourPhase.HUB.label,
            title = "Settings & Beyond",
            description = "Everything else lives in Settings: browser preferences, discovery controls, " +
                "privacy policy, and the sign-out button (please don't).\n\n" +
                "You can also replay this tour from Settings anytime, in case you missed something " +
                "or just really enjoy our sparkling commentary.\n\n" +
                "That's it! You're ready. Go forth and Roam. Try not to get fired.",
            icon = Icons.Filled.Settings,
        ),
    ),
)

// ── Main composable ──────────────────────────────────────────────────────────────────────

@Composable
fun Tour(
    modifier: Modifier = Modifier,
    onDismiss: () -> Unit,
    onNavigateToYouTab: () -> Unit = {},
    onOpenConfigSheet: () -> Unit = {},
) {
    var isDismissed by remember { mutableStateOf(value = false) }

    fun dismiss() {
        if (isDismissed) return
        isDismissed = true
        onDismiss()
    }

    if (isDismissed) return

    var currentStep by remember { mutableIntStateOf(0) }
    val entry = TOUR_ENTRIES[currentStep]
    val step = entry.step
    val isLastStep = currentStep == TOUR_ENTRIES.lastIndex

    val currentPhase = step.phase
    var displayedPhase by remember { mutableStateOf(currentPhase) }
    LaunchedEffect(currentPhase) {
        currentPhase?.let { displayedPhase = it }
    }

    val phaseStepIndex = remember(currentStep) {
        var count = 0
        for (i in 0..currentStep) {
            if (TOUR_ENTRIES[i].step.phase == currentPhase) count++
        }
        count
    }
    val totalInPhase = remember(currentPhase) {
        TOUR_ENTRIES.count { it.step.phase == currentPhase }
    }

    LaunchedEffect(currentStep) {
        when {
            entry.autoOpenSheet -> onOpenConfigSheet()
            entry.autoSwitchToYou -> onNavigateToYouTab()
        }
    }

    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(300)),
        exit = fadeOut(tween(200)),
    ) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.85f))
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() },
                ) { /* consume clicks */ },
            contentAlignment = Alignment.Center,
        ) {
            TourCard(
                step = step,
                mockup = entry.mockup,
                stepIndex = currentStep,
                totalSteps = TOUR_ENTRIES.size,
                phaseStep = phaseStepIndex,
                totalInPhase = totalInPhase,
                isFirstStep = currentStep == 0,
                isLastStep = isLastStep,
                onBack = { if (currentStep > 0) currentStep-- },
                onNext = { if (isLastStep) dismiss() else currentStep++ },
                onSkip = { dismiss() }
            )
        }
    }
}

// ── Tour card ────────────────────────────────────────────────────────────────────────────

@Composable
private fun TourCard(
    step: TourStep,
    mockup: MockupType,
    stepIndex: Int,
    totalSteps: Int,
    phaseStep: Int,
    totalInPhase: Int,
    isFirstStep: Boolean,
    isLastStep: Boolean,
    onBack: () -> Unit,
    onNext: () -> Unit,
    onSkip: () -> Unit,
) {
    Card(
        modifier = Modifier
            .padding(horizontal = 24.dp)
            .fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            step.phase?.let { phase ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.primaryContainer)
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                ) {
                    Text(
                        text = phase.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Spacer(Modifier.height(12.dp))
            }

            if (mockup != MockupType.NONE) {
                MockupStrip(mockup)
                Spacer(Modifier.height(16.dp))
            } else {
                Card(
                    modifier = Modifier.size(72.dp),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                    ),
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                        Icon(
                            imageVector = step.icon,
                            contentDescription = step.title,
                            modifier = Modifier.size(36.dp),
                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TOUR_ENTRIES.indices.forEach { index ->
                    Box(
                        modifier = Modifier
                            .size(if (index == stepIndex) 8.dp else 6.dp)
                            .clip(CircleShape)
                            .background(
                                when {
                                    index == stepIndex -> MaterialTheme.colorScheme.primary
                                    index < stepIndex -> MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)
                                    else -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)
                                }
                            ),
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            Text(
                text = step.title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurface,
            )

            Spacer(Modifier.height(10.dp))

            Text(
                text = step.description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f),
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
            )

            Spacer(Modifier.height(24.dp))

            Text(
                text = "Step ${stepIndex + 1} of $totalSteps" +
                    if (totalInPhase > 0) "  \u00B7  $phaseStep of $totalInPhase in this section" else "",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.35f),
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (!isFirstStep) {
                    OutlinedButton(
                        onClick = onBack,
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Back")
                    }
                }
                Button(
                    onClick = onNext,
                    modifier = Modifier.weight(1f),
                ) {
                    Text(if (isLastStep) "Let's Go!" else "Next")
                }
            }

            Spacer(Modifier.height(8.dp))

            TextButton(onClick = onSkip) {
                Text(
                    if (isLastStep) "Close" else "Skip tour",
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                )
            }
        }
    }
}

// ── Illustrated mockup strips ─────────────────────────────────────────────────────────────

@Composable
private fun MockupStrip(type: MockupType) {
    when (type) {
        MockupType.BOTTOM_BAR_ALL -> BottomBarMockup(highlightedIndex = null)
        MockupType.BOTTOM_BAR_ROAM -> BottomBarMockup(highlightedIndex = 1)
        MockupType.BOTTOM_BAR_YOU -> BottomBarMockup(highlightedIndex = 2)
        MockupType.INFO_STRIP -> InfoStripMockup()
        MockupType.SHEET_HANDLE -> SheetHandleMockup()
        MockupType.NONE -> { /* never called */ }
    }
}

@Composable
private fun BottomBarMockup(highlightedIndex: Int?) {
    val items = listOf(
        BottomBarMockItem("Skip", Icons.Outlined.ThumbDown),
        BottomBarMockItem("Roam", Icons.Outlined.Explore),
        BottomBarMockItem("You", Icons.Filled.Person),
        BottomBarMockItem("Like", Icons.Outlined.ThumbUp),
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        items.forEachIndexed { index, item ->
            val isHighlighted = highlightedIndex == index
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .then(
                        if (isHighlighted) Modifier
                            .background(
                                MaterialTheme.colorScheme.primaryContainer,
                                RoundedCornerShape(8.dp),
                            )
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                        else Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    ),
            ) {
                Icon(
                    imageVector = if (isHighlighted) {
                        when (index) {
                            0 -> Icons.Filled.ThumbDown
                            1 -> Icons.Filled.Explore
                            2 -> Icons.Filled.Person
                            3 -> Icons.Filled.ThumbUp
                            else -> item.icon
                        }
                    } else item.icon,
                    contentDescription = item.label,
                    modifier = Modifier.size(20.dp),
                    tint = if (isHighlighted) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = item.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isHighlighted) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 9.sp,
                )
            }
        }
    }
}

private data class BottomBarMockItem(val label: String, val icon: ImageVector)

@Composable
private fun InfoStripMockup() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary),
        )
        Spacer(Modifier.padding(start = 8.dp))
        Text(
            text = "\uD83D\uDCDA Science \u00B7 nature.com",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SheetHandleMockup() {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(horizontal = 20.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.KeyboardArrowUp,
            contentDescription = "Open menu",
            modifier = Modifier.size(28.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}