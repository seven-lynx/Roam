package app.roam.android.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.roam.android.ui.theme.Bone
import app.roam.android.ui.theme.Fog
import app.roam.android.ui.theme.Panel2
import app.roam.android.ui.theme.TealBright

/** ROAM-OS translate-language picker — appears over the webview inside the screen slot. */
@Composable
fun TranslatePicker(
    currentLanguage: String,
    onTranslate: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    RoamOsWindow(title = "TRANSLATE", onClose = onClose, modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(12.dp),
        ) {
            Text("// select target language", style = MaterialTheme.typography.labelSmall, color = Fog)
            Spacer(Modifier.height(10.dp))
            TRANSLATE_LANGUAGES.forEach { (code, label) ->
                val selected = code == currentLanguage
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (selected) Panel2 else Color.Transparent)
                        .clickable { onTranslate(code) }
                        .padding(horizontal = 10.dp, vertical = 11.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(if (selected) TealBright else Fog.copy(alpha = 0.3f)),
                    )
                    Column(modifier = Modifier.weight(1f).padding(start = 10.dp)) {
                        Text(code.uppercase(), style = MaterialTheme.typography.labelMedium, color = TealBright)
                        Text(label, style = MaterialTheme.typography.bodyMedium, color = Bone)
                    }
                    if (selected) Text("ACTIVE", style = MaterialTheme.typography.labelSmall, color = TealBright, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(4.dp))
            }
        }
    }
}
