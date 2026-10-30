package app.roam.android.ui.theme

import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import app.roam.android.R

// Space Grotesk ships as a single variable font; each weight is registered as a
// separate entry with an explicit `wght` variation so Compose can resolve
// FontWeight.Normal/Medium/SemiBold/Bold against the variable axis.
@OptIn(ExperimentalTextApi::class)
val SpaceGrotesk = FontFamily(
    Font(R.font.space_grotesk, FontWeight.Normal),
    Font(
        R.font.space_grotesk,
        FontWeight.Medium,
        variationSettings = FontVariation.Settings(FontVariation.weight(500)),
    ),
    Font(
        R.font.space_grotesk,
        FontWeight.SemiBold,
        variationSettings = FontVariation.Settings(FontVariation.weight(600)),
    ),
    Font(
        R.font.space_grotesk,
        FontWeight.Bold,
        variationSettings = FontVariation.Settings(FontVariation.weight(700)),
    ),
)

val IbmPlexMono = FontFamily(
    Font(R.font.ibm_plex_mono_regular, FontWeight.Normal),
    Font(R.font.ibm_plex_mono_medium, FontWeight.Medium),
)

// DSEG7 Classic — a seven-segment "LED/LCD" face for the OS status readout.
// Bundled under SIL Open Font License 1.1 (see assets/licenses/DSEG-OFL-1.1.txt).
val SevenSegment = FontFamily(
    Font(R.font.dseg7_classic, FontWeight.Normal),
)

// Orbitron — a geometric retro-sci-fi display face for the boot/scan readouts
// and the ROAM-OS wordmark. Bundled under SIL Open Font License 1.1
// (see assets/licenses/Orbitron-OFL.txt).
@OptIn(ExperimentalTextApi::class)
val Orbitron = FontFamily(
    Font(R.font.orbitron, FontWeight.Normal),
    Font(
        R.font.orbitron,
        FontWeight.Medium,
        variationSettings = FontVariation.Settings(FontVariation.weight(500)),
    ),
    Font(
        R.font.orbitron,
        FontWeight.SemiBold,
        variationSettings = FontVariation.Settings(FontVariation.weight(600)),
    ),
    Font(
        R.font.orbitron,
        FontWeight.Bold,
        variationSettings = FontVariation.Settings(FontVariation.weight(700)),
    ),
)
