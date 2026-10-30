package app.roam.android.ui.screen

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.roam.android.ui.component.DECK_LAYOUTS
import app.roam.android.ui.component.DECK_SHAPES
import app.roam.android.ui.component.DECK_SIZES
import app.roam.android.ui.component.DeckTexture
import app.roam.android.ui.component.SettingsActionRow
import app.roam.android.ui.component.SettingsFlavorText
import app.roam.android.ui.component.SettingsFxSliderRow
import app.roam.android.ui.component.SettingsToggleRow
import app.roam.android.ui.component.SettingsTopBar
import app.roam.android.ui.theme.BACKLIGHT_COLORS
import app.roam.android.ui.theme.ROAM_OS_PALETTES
import app.roam.android.ui.theme.RoamThemeVariant
import app.roam.android.viewmodel.MainViewModel

@Composable
fun AppearanceScreen(
    vm: MainViewModel,
    roamOs: Boolean,
    onNavigateBack: () -> Unit,
) {
    val themeVariant by vm.themeVariant.collectAsState()
    val crtEffectsEnabled by vm.crtEffectsEnabled.collectAsState()
    val crtFx by vm.crtFx.collectAsState()
    val deviceFrameEnabled by vm.deviceFrameEnabled.collectAsState()
    val wearEnabled by vm.wearEnabled.collectAsState()
    val bezelFisheyeEnabled by vm.bezelFisheyeEnabled.collectAsState()
    val deckLayout by vm.deckLayout.collectAsState()
    val deckSize by vm.deckSize.collectAsState()
    val deckShape by vm.deckShape.collectAsState()
    val deckLabelsEnabled by vm.deckLabelsEnabled.collectAsState()
    val systemMessageSpeed by vm.systemMessageSpeed.collectAsState()
    val hardwareFx by vm.hardwareFx.collectAsState()
    val deckTexture by vm.deckTexture.collectAsState()
    val osColorScheme by vm.osColorScheme.collectAsState()
    val hardwareColorScheme by vm.hardwareColorScheme.collectAsState()
    val hardwareFxMaster by vm.hardwareFxMaster.collectAsState()
    val backlightEnabled by vm.backlightEnabled.collectAsState()
    val backlightColor by vm.backlightColor.collectAsState()

    var themeDropdownExpanded by remember { mutableStateOf(false) }
    var deckLayoutDropdownExpanded by remember { mutableStateOf(false) }
    var deckSizeDropdownExpanded by remember { mutableStateOf(false) }
    var deckShapeDropdownExpanded by remember { mutableStateOf(false) }
    var hardwareExpanded by remember { mutableStateOf(false) }
    var textureDropdownExpanded by remember { mutableStateOf(false) }
    var osColorDropdownExpanded by remember { mutableStateOf(false) }
    var hardwareColorDropdownExpanded by remember { mutableStateOf(false) }
    var backlightColorDropdownExpanded by remember { mutableStateOf(false) }

    val deckLayoutLabel = DECK_LAYOUTS.firstOrNull { it.first == deckLayout }?.second ?: "Straight line"
    val osColorLabel = ROAM_OS_PALETTES.firstOrNull { it.key == osColorScheme }?.label ?: "Phosphor Teal"
    val hardwareColorLabel = ROAM_OS_PALETTES.firstOrNull { it.key == hardwareColorScheme }?.label ?: "Phosphor Teal"
    val backlightColorLabel = BACKLIGHT_COLORS.firstOrNull { it.key == backlightColor }?.label ?: "Ice Blue"
    val deckSizeLabel = DECK_SIZES.firstOrNull { it.first == deckSize }?.second ?: "Medium"
    val deckShapeLabel = DECK_SHAPES.firstOrNull { it.first == deckShape }?.second ?: "Round"

    Scaffold(
        topBar = {
            SettingsTopBar(
                title = if (roamOs) "DISPLAY // OPTICS" else "Appearance",
                roamOs = roamOs,
                onNavigateBack = onNavigateBack,
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding(),
        ) {
            if (roamOs) {
                SettingsFlavorText("Calibrate the phosphor array, chassis frame, and lens warp.")
            }

            // Theme selector (Roam Classic vs ROAM-OS)
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Theme", style = MaterialTheme.typography.bodyLarge)
                    Text("Roam Classic or the ROAM-OS look", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                }
                Box {
                    OutlinedButton(onClick = { themeDropdownExpanded = true }) {
                        Text(if (themeVariant == RoamThemeVariant.ROAM_OS) "ROAM-OS" else "Roam Classic")
                    }
                    DropdownMenu(expanded = themeDropdownExpanded, onDismissRequest = { themeDropdownExpanded = false }) {
                        DropdownMenuItem(
                            text = { Text("Roam Classic") },
                            onClick = { vm.setThemeVariant(RoamThemeVariant.CLASSIC); themeDropdownExpanded = false },
                        )
                        DropdownMenuItem(
                            text = { Text("ROAM-OS") },
                            onClick = { vm.setThemeVariant(RoamThemeVariant.ROAM_OS); themeDropdownExpanded = false },
                        )
                    }
                }
            }

            SettingsToggleRow("Deck labels", "Show text labels on the control buttons", deckLabelsEnabled) { vm.setDeckLabelsEnabled(it) }
            SettingsFxSliderRow("Message scroll speed", systemMessageSpeed) { vm.setSystemMessageSpeed(it) }

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Material", style = MaterialTheme.typography.bodyLarge)
                    Text("Chassis and deck texture", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                }
                Box {
                    OutlinedButton(onClick = { textureDropdownExpanded = true }) { Text(DeckTexture.fromKey(deckTexture).label) }
                    DropdownMenu(expanded = textureDropdownExpanded, onDismissRequest = { textureDropdownExpanded = false }) {
                        DeckTexture.entries.forEach { tex ->
                            DropdownMenuItem(text = { Text(tex.label) }, onClick = { vm.setDeckTexture(tex.key); textureDropdownExpanded = false })
                        }
                    }
                }
            }

            if (themeVariant == RoamThemeVariant.ROAM_OS) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("OS color", style = MaterialTheme.typography.bodyLarge)
                        Text("Roam-OS UI and terminal display color", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                    Box {
                        OutlinedButton(onClick = { osColorDropdownExpanded = true }) { Text(osColorLabel) }
                        DropdownMenu(expanded = osColorDropdownExpanded, onDismissRequest = { osColorDropdownExpanded = false }) {
                            ROAM_OS_PALETTES.forEach { p ->
                                DropdownMenuItem(text = { Text(p.label) }, onClick = { vm.setOsColorScheme(p.key); osColorDropdownExpanded = false })
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Hardware color", style = MaterialTheme.typography.bodyLarge)
                        Text("Chassis and control deck accent color", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                    Box {
                        OutlinedButton(onClick = { hardwareColorDropdownExpanded = true }) { Text(hardwareColorLabel) }
                        DropdownMenu(expanded = hardwareColorDropdownExpanded, onDismissRequest = { hardwareColorDropdownExpanded = false }) {
                            ROAM_OS_PALETTES.forEach { p ->
                                DropdownMenuItem(text = { Text(p.label) }, onClick = { vm.setHardwareColorScheme(p.key); hardwareColorDropdownExpanded = false })
                            }
                        }
                    }
                }

                SettingsToggleRow("Backlit keys", "Glow behind the control deck keys", backlightEnabled) { vm.setBacklightEnabled(it) }
                if (backlightEnabled) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Backlight color", style = MaterialTheme.typography.bodyLarge)
                            Text("Key glow color", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                        }
                        Box {
                            OutlinedButton(onClick = { backlightColorDropdownExpanded = true }) { Text(backlightColorLabel) }
                            DropdownMenu(expanded = backlightColorDropdownExpanded, onDismissRequest = { backlightColorDropdownExpanded = false }) {
                                BACKLIGHT_COLORS.forEach { c ->
                                    DropdownMenuItem(text = { Text(c.label) }, onClick = { vm.setBacklightColor(c.key); backlightColorDropdownExpanded = false })
                                }
                            }
                        }
                    }
                }

                SettingsToggleRow("Device frame", "Show the retro handheld chassis around the screen", deviceFrameEnabled) { vm.setDeviceFrameEnabled(it) }
                SettingsToggleRow("Wear & tear", "Scratches, scuffs and oxidation on the chassis", wearEnabled) { vm.setWearEnabled(it) }
                SettingsToggleRow("Bezel fisheye", "Warp the chassis bezel to match the screen curve", bezelFisheyeEnabled) { vm.setBezelFisheyeEnabled(it) }
                SettingsToggleRow("Hardware embellishments", "Antenna, nixie and other chassis details", hardwareFxMaster) { vm.setHardwareFxMaster(it) }
                if (hardwareFxMaster) {
                    SettingsToggleRow("Antenna stub", "Whip antenna on the top edge", hardwareFx.antenna) { vm.setHardwareAntenna(it) }
                    SettingsToggleRow("Nixie tube", "Glowing neon digit on the chassis", hardwareFx.nixie) { vm.setHardwareNixie(it) }
                    SettingsToggleRow("Activity LED", "Blinking link-status indicator", hardwareFx.activityLed) { vm.setHardwareActivityLed(it) }
                    SettingsToggleRow("Vacuum tube", "Glowing valve detail", hardwareFx.vacuumTube) { vm.setHardwareVacuumTube(it) }
                }
                SettingsToggleRow("CRT effects", "Scanlines, grain, vignette, flicker and fisheye", crtEffectsEnabled) { vm.setCrtEffectsEnabled(it) }
                SettingsFxSliderRow("Scanlines", crtFx.scanlines) { vm.setCrtScanlines(it) }
                SettingsFxSliderRow("Grain", crtFx.grain) { vm.setCrtGrain(it) }
                SettingsFxSliderRow("Vignette", crtFx.vignette) { vm.setCrtVignette(it) }
                SettingsFxSliderRow("Flicker", crtFx.flicker) { vm.setCrtFlicker(it) }
                SettingsFxSliderRow("Fisheye", crtFx.fisheye) { vm.setCrtFisheye(it) }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Deck layout", style = MaterialTheme.typography.bodyLarge)
                        Text("Arrange the ROAM-OS control deck keys", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                    Box {
                        OutlinedButton(onClick = { deckLayoutDropdownExpanded = true }) { Text(deckLayoutLabel) }
                        DropdownMenu(expanded = deckLayoutDropdownExpanded, onDismissRequest = { deckLayoutDropdownExpanded = false }) {
                            DECK_LAYOUTS.forEach { (value, label) ->
                                DropdownMenuItem(text = { Text(label) }, onClick = { vm.setDeckLayout(value); deckLayoutDropdownExpanded = false })
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Button size", style = MaterialTheme.typography.bodyLarge)
                        Text("Control deck key size", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                    Box {
                        OutlinedButton(onClick = { deckSizeDropdownExpanded = true }) { Text(deckSizeLabel) }
                        DropdownMenu(expanded = deckSizeDropdownExpanded, onDismissRequest = { deckSizeDropdownExpanded = false }) {
                            DECK_SIZES.forEach { (value, label) ->
                                DropdownMenuItem(text = { Text(label) }, onClick = { vm.setDeckSize(value); deckSizeDropdownExpanded = false })
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Button shape", style = MaterialTheme.typography.bodyLarge)
                        Text("Round or square keys (Roam stays round)", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                    Box {
                        OutlinedButton(onClick = { deckShapeDropdownExpanded = true }) { Text(deckShapeLabel) }
                        DropdownMenu(expanded = deckShapeDropdownExpanded, onDismissRequest = { deckShapeDropdownExpanded = false }) {
                            DECK_SHAPES.forEach { (value, label) ->
                                DropdownMenuItem(text = { Text(label) }, onClick = { vm.setDeckShape(value); deckShapeDropdownExpanded = false })
                            }
                        }
                    }
                }
            }
        }
    }
}