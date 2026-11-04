package app.roam.android.ui.screen

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.roam.android.ui.component.CategoryIconLabel
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.Gold
import app.roam.android.ui.theme.IbmPlexMono
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Panel
import app.roam.android.ui.theme.Panel2
import app.roam.android.ui.theme.RoamThemeVariant
import app.roam.android.ui.theme.ScreenBg
import app.roam.android.ui.theme.TealBright
import app.roam.android.viewmodel.MainViewModel

private val USERNAME_REGEX = Regex("^[a-z0-9_-]+$")

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WalkthroughScreen(
    vm: MainViewModel,
    onComplete: () -> Unit,
) {
    // Unskippable: consume the system back so the user can't leave early.
    BackHandler(enabled = true) { /* block exit */ }

    val themeVariant by vm.themeVariant.collectAsState()
    val profile by vm.profile.collectAsState()
    val profileIsPublic by vm.profileIsPublic.collectAsState()
    val profileSaveError by vm.profileSaveError.collectAsState()
    val interestMode by vm.interestMode.collectAsState()
    val selectedPillars by vm.userCategoryIds.collectAsState()
    val selectedTopics by vm.userTopicIds.collectAsState()

    var step by remember { mutableIntStateOf(0) }
    var username by remember { mutableStateOf("") }
    var usernameError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { vm.loadProfile() }
    LaunchedEffect(profile?.username) {
        if (username.isBlank() && !profile?.username.isNullOrBlank()) username = profile!!.username
    }

    val interestsReady =
        if (interestMode == "pillars") selectedPillars.isNotEmpty() else selectedTopics.isNotEmpty()
    val canContinue = when (step) {
        2 -> interestsReady
        3 -> username.trim().lowercase().let { it.length >= 3 && USERNAME_REGEX.matches(it) }
        else -> true
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(24.dp))
        WalkthroughHeader(step)
        Spacer(Modifier.height(20.dp))

        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            when (step) {
                0 -> WelcomeStep()
                1 -> ThemeStep(selected = themeVariant, onSelect = vm::setThemeVariant)
                2 -> InterestsStep(vm)
                3 -> HandleStep(
                    username = username,
                    error = usernameError ?: profileSaveError,
                    onUsernameChange = { value ->
                        username = value
                        usernameError = null
                    },
                    isPublic = profileIsPublic,
                    onToggle = vm::toggleProfilePublic,
                )
                4 -> FinalStep()
            }
        }

        Spacer(Modifier.height(16.dp))

        Button(
            onClick = {
                when (step) {
                    2 -> vm.saveInterests()
                    3 -> {
                        val clean = username.trim().lowercase()
                        vm.onProfileFieldChanged(clean, clean, profile?.bio)
                    }
                    4 -> {
                        vm.completeWalkthrough()
                        onComplete()
                        return@Button
                    }
                }
                step = (step + 1).coerceAtMost(4)
            },
            enabled = canContinue,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Text(if (step == 4) "Start roaming" else "Continue")
        }

        if (step > 0) {
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = { step -= 1 }, modifier = Modifier.fillMaxWidth()) {
                Text("Back")
            }
        }

        Spacer(Modifier.height(12.dp))
        StepIndicator(current = step, total = 5)
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun WelcomeStep() {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
    ) {
        Text(
            text = "SIGNAL // ACQUIRED",
            style = MaterialTheme.typography.labelMedium,
            fontFamily = IbmPlexMono,
            letterSpacing = 2.sp,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "The internet died. Roam kept walking.",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "Most of the web is static now — auto-generated and abandoned. Roam walks the parts " +
                "a human still left alive: one tap, one page, somewhere new.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f),
        )
        Spacer(Modifier.height(20.dp))
        listOf(
            "Roam — jump to a new page",
            "Rate ↑ / ↓ — teach Roam what's good",
            "Submit — add a page for others to discover",
            "Report — flag something that shouldn't be here",
        ).forEach { line ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(vertical = 4.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary),
                )
                Spacer(Modifier.width(10.dp))
                Text(line, style = MaterialTheme.typography.bodyMedium)
            }
        }
        Spacer(Modifier.height(16.dp))
        Text(
            "Let's set you up in a few quick steps.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
        )
    }
}

@Composable
private fun ThemeStep(
    selected: RoamThemeVariant,
    onSelect: (RoamThemeVariant) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
    ) {
        Text("Choose your theme", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "You can switch anytime in Settings.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
        )
        Spacer(Modifier.height(20.dp))

        ThemeSlide(
            title = "Roam Classic",
            description = "The minimal light-and-dark app. Simple, familiar, focused.",
            variant = RoamThemeVariant.CLASSIC,
            selected = selected == RoamThemeVariant.CLASSIC,
            onClick = { onSelect(RoamThemeVariant.CLASSIC) },
        )
        Spacer(Modifier.height(16.dp))
        ThemeSlide(
            title = "Roam-OS",
            description = "The full cyberdeck experience. CRT glow, control deck and all.",
            variant = RoamThemeVariant.ROAM_OS,
            selected = selected == RoamThemeVariant.ROAM_OS,
            onClick = { onSelect(RoamThemeVariant.ROAM_OS) },
        )
    }
}

@Composable
private fun ThemeSlide(
    title: String,
    description: String,
    variant: RoamThemeVariant,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(
                if (selected) MaterialTheme.colorScheme.primaryContainer
                else MaterialTheme.colorScheme.surfaceVariant,
            )
            .padding(12.dp),
    ) {
        // Live miniature mockup — mirrors web ThemeMockup.tsx (no raster assets).
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(if (variant == RoamThemeVariant.ROAM_OS) ScreenBg else ClassicBg)
                .padding(12.dp),
        ) {
            ThemePreview(variant)
        }
        Spacer(Modifier.height(10.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f),
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(
                text = if (selected) "✓ Selected" else "Select",
                style = MaterialTheme.typography.labelMedium,
                color = if (selected) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(8.dp))
        Button(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
            Text(if (selected) "Selected" else "Choose $title")
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun InterestsStep(vm: MainViewModel) {
    val categories by vm.categories.collectAsState()
    val subcategories by vm.subcategories.collectAsState()
    val selectedPillars by vm.userCategoryIds.collectAsState()
    val selectedTopics by vm.userTopicIds.collectAsState()
    val interestMode by vm.interestMode.collectAsState()
    val subcatsByCategory = subcategories.groupBy { it.categoryId }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
    ) {
        Text("What are you into?", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Pick interests to personalise your discoveries. You can change these anytime in Profile.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
        )
        Spacer(Modifier.height(24.dp))

        if (interestMode == "pillars") {
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                categories.forEach { category ->
                    val selected = category.id in selectedPillars
                    FilterChip(
                        selected = selected,
                        onClick = { vm.toggleCategory(category.id, !selected) },
                        label = { CategoryIconLabel(category.icon, category.name) },
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            if (subcategories.isNotEmpty()) {
                TextButton(onClick = { vm.setInterestMode("topics") }) {
                    Text("Choose specific topics instead →")
                }
            }
        } else {
            TextButton(onClick = { vm.setInterestMode("pillars") }) {
                Text("← Choose categories instead")
            }
            Spacer(Modifier.height(8.dp))
            categories.forEach { category ->
                val subcats = subcatsByCategory[category.id] ?: return@forEach
                if (subcats.isEmpty()) return@forEach
                Text(
                    text = "${category.icon} ${category.name}",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    subcats.forEach { sc ->
                        val selected = sc.id in selectedTopics
                        FilterChip(
                            selected = selected,
                            onClick = { vm.toggleTopic(sc.id, !selected) },
                            label = { Text(sc.name) },
                        )
                    }
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }
        }
    }
}

@Composable
private fun HandleStep(
    username: String,
    error: String?,
    onUsernameChange: (String) -> Unit,
    isPublic: Boolean,
    onToggle: () -> Unit,
) {
    val handle = username.trim().lowercase().ifBlank { "you" }
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
    ) {
        Text("Claim your handle", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Your public address: roamtheweb.app/u/$handle. " +
                "Pick a name, then decide who can see your discoveries.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
        )
        Spacer(Modifier.height(20.dp))

        OutlinedTextField(
            value = username,
            onValueChange = onUsernameChange,
            singleLine = true,
            label = { Text("Username") },
            placeholder = { Text("yourname") },
            isError = error != null,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(6.dp))
        if (error != null) {
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        } else {
            Text(
                text = "Letters, numbers, hyphens, underscores. Min 3 characters.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
            )
        }

        Spacer(Modifier.height(20.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Public profile",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = if (isPublic) "Visible to everyone" else "Hidden",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                )
            }
            Switch(checked = isPublic, onCheckedChange = { onToggle() })
        }
    }
}

@Composable
private fun WalkthroughHeader(step: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "ROAM // ONBOARD",
            style = MaterialTheme.typography.labelMedium,
            fontFamily = IbmPlexMono,
            letterSpacing = 2.sp,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = "STEP ${(step + 1).toString().padStart(2, '0')} / 05",
            style = MaterialTheme.typography.labelMedium,
            fontFamily = IbmPlexMono,
            letterSpacing = 1.sp,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
        )
    }
}

@Composable
private fun FinalStep() {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
    ) {
        Text(
            text = "UPLINK // ONLINE",
            style = MaterialTheme.typography.labelMedium,
            fontFamily = IbmPlexMono,
            letterSpacing = 2.sp,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "You're a wanderer now.",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "The forgotten web remembers you. One tap, and you're somewhere a human actually saved.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
        )
        Spacer(Modifier.height(20.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(14.dp),
        ) {
            Text(
                text = "Roam lives everywhere:",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "your phone, your deck, your browser — one feed, one wanderer.",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

// ── Miniature theme mockups (mirror web ThemeMockup.tsx — no raster assets) ──
private val ClassicBg = Color(0xFF0D0D0E)
private val ClassicPanel = Color(0xFF171718)
private val ClassicInk = Color(0xFFECECEC)
private val ClassicMuted = Color(0xFF9A9A9C)
private val ClassicLine = Color(0x24FFFFFF)
private val ClassicAccentInk = Color(0xFF06211C)

@Composable
private fun ThemePreview(variant: RoamThemeVariant) {
    val os = variant == RoamThemeVariant.ROAM_OS
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            PreviewLabel("Handheld", os)
            Spacer(Modifier.height(5.dp))
            if (os) OsHandheld() else ClassicHandheld()
        }
        Column(modifier = Modifier.fillMaxWidth()) {
            PreviewLabel("Desktop", os)
            Spacer(Modifier.height(5.dp))
            if (os) OsDesktop() else ClassicDesktop()
        }
    }
}

@Composable
private fun PreviewLabel(text: String, os: Boolean) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        fontFamily = IbmPlexMono,
        letterSpacing = 2.sp,
        color = if (os) Fog else ClassicMuted,
    )
}

@Composable
private fun SignalBars(color: Color) {
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        listOf(3, 5, 7, 9).forEachIndexed { i, h ->
            Box(
                modifier = Modifier
                    .size(width = 2.dp, height = h.dp)
                    .background(color.copy(alpha = 0.35f + i * 0.22f)),
            )
        }
    }
}

@Composable
private fun MockDivider(color: Color) {
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(color))
}

@Composable
private fun OsHandheld() {
    Column(
        modifier = Modifier
            .width(128.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(ScreenBg)
            .border(1.dp, LineColor, RoundedCornerShape(14.dp)),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "ROAM-OS",
                style = MaterialTheme.typography.labelSmall,
                fontFamily = IbmPlexMono,
                letterSpacing = 1.sp,
                color = TealBright,
            )
            SignalBars(TealBright)
        }
        MockDivider(LineColor)
        Column(
            modifier = Modifier.fillMaxWidth().padding(7.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                OsTile(TealBright, Modifier.weight(1f))
                OsTile(Gold, Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                OsTile(TealBright, Modifier.weight(1f))
                OsTile(TealBright, Modifier.weight(1f))
            }
        }
        MockDivider(LineColor)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 9.dp, end = 9.dp, top = 6.dp, bottom = 9.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OsDockKey(16.dp, false)
            Spacer(Modifier.width(4.dp))
            OsDockKey(36.dp, true)
            Spacer(Modifier.width(4.dp))
            OsDockKey(16.dp, false)
        }
    }
}

@Composable
private fun OsTile(dot: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .height(40.dp)
            .clip(RoundedCornerShape(5.dp))
            .background(Panel2)
            .border(1.dp, LineColor, RoundedCornerShape(5.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(dot),
        )
    }
}

@Composable
private fun OsDesktop() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(ScreenBg)
            .border(1.dp, LineColor, RoundedCornerShape(10.dp)),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "ROAM-OS",
                    style = MaterialTheme.typography.labelSmall,
                    fontFamily = IbmPlexMono,
                    letterSpacing = 1.sp,
                    color = TealBright,
                )
                Text(
                    text = "~/roam/wander",
                    style = MaterialTheme.typography.labelSmall,
                    color = Fog,
                )
            }
            SignalBars(TealBright)
        }
        MockDivider(LineColor)
        Row(
            modifier = Modifier.fillMaxWidth().padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            OsDesktopCard(TealBright, Modifier.weight(1f))
            OsDesktopCard(Gold, Modifier.weight(1f))
        }
        MockDivider(LineColor)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 9.dp, end = 9.dp, top = 5.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OsDockKey(18.dp, false)
            Spacer(Modifier.width(5.dp))
            OsDockKey(44.dp, true)
            Spacer(Modifier.width(5.dp))
            OsDockKey(18.dp, false)
            Spacer(Modifier.width(5.dp))
            OsDockKey(18.dp, false)
        }
    }
}

@Composable
private fun OsDesktopCard(accent: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .height(42.dp)
            .clip(RoundedCornerShape(5.dp))
            .background(Panel)
            .border(1.dp, LineColor, RoundedCornerShape(5.dp))
            .padding(5.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.48f)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(accent),
        )
        Spacer(Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth(0.82f)
                .height(3.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Fog),
        )
        Spacer(Modifier.height(3.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth(0.64f)
                .height(3.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Fog),
        )
    }
}

@Composable
private fun OsDockKey(width: Dp, filled: Boolean) {
    val shape = RoundedCornerShape(3.dp)
    val base = Modifier
        .width(width)
        .height(12.dp)
        .clip(shape)
        .background(if (filled) TealBright else Panel2)
    Box(modifier = if (filled) base else base.border(1.dp, LineColor, shape))
}

// Classic

@Composable
private fun ClassicHandheld() {
    Column(
        modifier = Modifier
            .width(128.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(ClassicBg)
            .border(1.dp, ClassicLine, RoundedCornerShape(14.dp)),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 7.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Roam",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = ClassicInk,
            )
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(TealBright),
            )
        }
        MockDivider(ClassicLine)
        Box(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 7.dp),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(16.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(TealBright),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Roam",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = ClassicAccentInk,
                )
            }
        }
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            repeat(3) { ClassicCardRow() }
        }
        MockDivider(ClassicLine)
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 9.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ClassicDockTile(false)
            ClassicDockTile(true)
            ClassicDockTile(false)
        }
    }
}

@Composable
private fun ClassicCardRow() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(ClassicPanel)
            .border(1.dp, ClassicLine, RoundedCornerShape(6.dp))
            .padding(6.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.54f)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(ClassicInk.copy(alpha = 0.9f)),
        )
        Spacer(Modifier.height(3.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth(0.88f)
                .height(3.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(ClassicMuted),
        )
        Spacer(Modifier.height(3.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth(0.68f)
                .height(3.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(ClassicMuted),
        )
    }
}

@Composable
private fun ClassicDockTile(filled: Boolean) {
    Box(
        modifier = Modifier
            .size(14.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(if (filled) TealBright else ClassicMuted.copy(alpha = 0.45f)),
    )
}

@Composable
private fun ClassicDesktop() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(ClassicBg)
            .border(1.dp, ClassicLine, RoundedCornerShape(10.dp)),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Roam Classic",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = ClassicInk,
            )
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(TealBright),
            )
        }
        MockDivider(ClassicLine)
        Row(
            modifier = Modifier.fillMaxWidth().padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Column(
                modifier = Modifier
                    .width(34.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(ClassicPanel)
                    .padding(5.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                repeat(4) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(ClassicMuted),
                    )
                }
            }
            ClassicContentCard(Modifier.weight(1f), 0.58f, listOf(0.86f, 0.56f))
            ClassicContentCard(Modifier.weight(1f), 0.50f, listOf(0.72f))
        }
    }
}

@Composable
private fun ClassicContentCard(
    modifier: Modifier = Modifier,
    titleWidth: Float,
    lines: List<Float>,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(5.dp))
            .background(ClassicPanel)
            .border(1.dp, ClassicLine, RoundedCornerShape(5.dp))
            .padding(5.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(titleWidth)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(ClassicInk.copy(alpha = 0.9f)),
        )
        Spacer(Modifier.height(4.dp))
        lines.forEach { w ->
            Box(
                modifier = Modifier
                    .fillMaxWidth(w)
                    .height(3.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(ClassicMuted),
            )
            Spacer(Modifier.height(3.dp))
        }
    }
}

@Composable
private fun StepIndicator(current: Int, total: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(total) { index ->
            val active = index == current
            val completed = index < current
            Box(
                modifier = Modifier
                    .padding(horizontal = 5.dp)
                    .size(if (active) 12.dp else 9.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            active -> MaterialTheme.colorScheme.primary
                            completed -> MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                            else -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.2f)
                        },
                    ),
            )
        }
    }
}
