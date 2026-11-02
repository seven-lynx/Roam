package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.roam.android.model.PROGRAMS
import app.roam.android.model.Program
import app.roam.android.model.program
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Danger
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.LineColor
import app.roam.android.ui.theme.Panel2
import app.roam.android.ui.theme.TealBright

/**
 * The ROAM-OS "software shelf" — the in-device grid of installed programs.
 * Everything renders inside the simulated screen (a `RoamOsWindow`, never a new
 * Activity/tab). RELAY is the shipped native game; the rest are stubbed with a
 * diegetic "not yet installed" window until their native builds land.
 */
@Composable
fun ProgramsScreen(
    soundEnabled: Boolean,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var selected by remember { mutableStateOf<String?>(null) }
    val selectedProgram = selected?.let { program(it) }

    when {
        selectedProgram?.id == "snake" ->
            RelayProgram(soundEnabled = soundEnabled, onClose = { selected = null }, modifier = modifier)

        selectedProgram != null ->
            ComingSoon(selectedProgram!!, onBack = { selected = null }, modifier = modifier)

        else ->
            Shelf(onOpen = { selected = it.id }, onClose = onClose, modifier = modifier)
    }
}

@Composable
private fun Shelf(
    onOpen: (Program) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier) {
        RoamOsWindow(title = "PROGRAMS // SHELF", onClose = onClose, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize()) {
                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(12.dp),
                ) {
                    Text("// select a program to run", style = MaterialTheme.typography.labelSmall, color = Fog)
                    Spacer(Modifier.height(12.dp))
                    PROGRAMS.forEach { p ->
                        ProgramShelfTile(p, onClick = { onOpen(p) })
                        Spacer(Modifier.height(8.dp))
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(LineColor))
                Text(
                    "pkgs: ${PROGRAMS.size} · uid: wanderer · daemon: idle",
                    style = MaterialTheme.typography.labelSmall,
                    color = Fog,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun ProgramShelfTile(program: Program, onClick: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(Panel2)
            .border(1.dp, LineColor, RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                program.glyph,
                style = MaterialTheme.typography.titleLarge,
                color = TealBright,
                modifier = Modifier.width(40.dp),
            )
            Column(Modifier.weight(1f)) {
                Text(program.title, style = MaterialTheme.typography.labelLarge, color = Bone)
                Text(
                    program.file,
                    style = MaterialTheme.typography.labelSmall,
                    color = Fog,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(
            program.tagline,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun ComingSoon(program: Program, onBack: () -> Unit, modifier: Modifier = Modifier) {
    RoamOsWindow(title = program.title, onClose = onBack, modifier = modifier) {
        Column(
            Modifier.fillMaxSize().padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(program.glyph, style = MaterialTheme.typography.titleLarge, color = TealBright)
            Spacer(Modifier.height(8.dp))
            Text(program.file, style = MaterialTheme.typography.labelSmall, color = Fog)
            Spacer(Modifier.height(16.dp))
            Text("// NOT YET INSTALLED", style = MaterialTheme.typography.labelLarge, color = Danger)
            Spacer(Modifier.height(8.dp))
            Text(program.tagline, style = MaterialTheme.typography.bodySmall, color = Bone, textAlign = TextAlign.Center)
            Spacer(Modifier.height(16.dp))
            Text("mount: pending · ship: next boot", style = MaterialTheme.typography.labelSmall, color = Fog)
        }
    }
}
