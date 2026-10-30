package app.roam.android.ui.screen

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import app.roam.android.ui.component.SettingsFlavorText
import app.roam.android.ui.component.SettingsToggleRow
import app.roam.android.ui.component.SettingsTopBar
import app.roam.android.viewmodel.MainViewModel

@Composable
fun EffectsScreen(
    vm: MainViewModel,
    roamOs: Boolean,
    onNavigateBack: () -> Unit,
) {
    val notificationsEnabled by vm.notificationsEnabled.collectAsState()
    val hapticFeedbackEnabled by vm.hapticFeedbackEnabled.collectAsState()
    val celebrationAnimationsEnabled by vm.celebrationAnimationsEnabled.collectAsState()

    Scaffold(
        topBar = {
            SettingsTopBar(
                title = if (roamOs) "SENSORY // FEEDBACK" else "Notifications & Effects",
                roamOs = roamOs,
                onNavigateBack = onNavigateBack,
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(innerPadding).verticalScroll(rememberScrollState()).navigationBarsPadding(),
        ) {
            if (roamOs) {
                SettingsFlavorText("Set the deck's sensory channels: alerts, sound, and haptics.")
            }

            SettingsToggleRow("Push notifications", "Receive alerts for your activity", notificationsEnabled) { vm.setNotificationsEnabled(it) }
            SettingsToggleRow("Haptic feedback", "Vibrate on taps and celebrations", hapticFeedbackEnabled) { vm.setHapticFeedbackEnabled(it) }
            SettingsToggleRow("Celebration animations", "Show full-screen animations for achievements", celebrationAnimationsEnabled) { vm.setCelebrationAnimationsEnabled(it) }
        }
    }
}
