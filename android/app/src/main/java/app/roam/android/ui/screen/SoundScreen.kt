package app.roam.android.ui.screen

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.roam.android.ui.component.SettingsFlavorText
import app.roam.android.ui.component.SettingsSectionHeader
import app.roam.android.ui.component.SettingsToggleRow
import app.roam.android.ui.component.SettingsTopBar
import app.roam.android.viewmodel.MainViewModel
import kotlin.math.roundToInt

@Composable
fun SoundScreen(
    vm: MainViewModel,
    roamOs: Boolean,
    onNavigateBack: () -> Unit,
) {
    val soundEffectsEnabled by vm.soundEffectsEnabled.collectAsState()
    val soundVolume by vm.soundVolume.collectAsState()
    val soundDeckEnabled by vm.soundDeckEnabled.collectAsState()
    val soundRatingEnabled by vm.soundRatingEnabled.collectAsState()
    val soundLoadingEnabled by vm.soundLoadingEnabled.collectAsState()
    val soundCelebrationEnabled by vm.soundCelebrationEnabled.collectAsState()
    val soundActionEnabled by vm.soundActionEnabled.collectAsState()

    Scaffold(
        topBar = {
            SettingsTopBar(
                title = if (roamOs) "AUDIO // CHANNELS" else "Sound",
                roamOs = roamOs,
                onNavigateBack = onNavigateBack,
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(innerPadding).verticalScroll(rememberScrollState()).navigationBarsPadding(),
        ) {
            if (roamOs) {
                SettingsFlavorText("Route the deck's audio channels: volume and per-channel mute.")
            }

            SettingsToggleRow("Sound effects", "Master switch for all audio", soundEffectsEnabled) { vm.setSoundEffectsEnabled(it) }

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Volume", style = MaterialTheme.typography.bodyLarge)
                    Text("${soundVolume}%", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                }
                Slider(
                    value = soundVolume.toFloat(),
                    onValueChange = { vm.setSoundVolume(it.roundToInt()) },
                    valueRange = 0f..100f,
                    modifier = Modifier.weight(1.4f),
                )
            }

            SettingsSectionHeader(if (roamOs) "CHANNELS" else "Channels")
            SettingsToggleRow("Deck clicks", "Key presses and the Roam button", soundDeckEnabled) { vm.setSoundDeckEnabled(it) }
            SettingsToggleRow("Rating sounds", "Thumbs up / down feedback", soundRatingEnabled) { vm.setSoundRatingEnabled(it) }
            SettingsToggleRow("Loading & scan", "Boot, scan and ambient server noises", soundLoadingEnabled) { vm.setSoundLoadingEnabled(it) }
            SettingsToggleRow("Celebrations", "Badge, level and challenge chimes", soundCelebrationEnabled) { vm.setSoundCelebrationEnabled(it) }
            SettingsToggleRow("Actions", "Save, submit and share confirmations", soundActionEnabled) { vm.setSoundActionEnabled(it) }
        }
    }
}
