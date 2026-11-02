package app.roam.android.model

/**
 * ROAM-OS in-device "programs" — the small, self-contained games that live
 * inside the handheld's simulated screen. Mirrors `web/src/lib/os-programs.ts`
 * so the two platforms ship the same software shelf.
 *
 * Each game is adapted from the Apache-2.0 `zeli-web-games` collection (see
 * THIRD_PARTY_NOTICES.md) and reskinned to the Roam palette.
 */

/** License/attribution for a program's original source. */
data class ProgramLicense(
    val name: String,
    val spdx: String,
    val url: String,
)

/** A program installable on the ROAM-OS software shelf. */
data class Program(
    val id: String,
    /** Window title — diegetic, uppercase. */
    val title: String,
    /** DOS-style path flavor for the window chrome + launcher. */
    val file: String,
    /** Short glyph for the launcher tile / window icon. */
    val glyph: String,
    /** One-line diegetic description, shown in the ABOUT drawer. */
    val tagline: String,
    /** Human controls hint, shown in the ABOUT drawer + boot guide. */
    val controls: String,
    /** Attribution + license for the original source. */
    val license: ProgramLicense,
    val source: String,
)

val APACHE_2 = ProgramLicense(
    name = "Apache License 2.0",
    spdx = "Apache-2.0",
    url = "https://www.apache.org/licenses/LICENSE-2.0",
)

val ZELI_SOURCE = "zeli-web-games (github.com/hajunho/zeli-web-games)"

/** The shipped ROAM-OS programs, in launcher order. */
val PROGRAMS: List<Program> = listOf(
    Program(
        id = "snake",
        title = "RELAY",
        file = "C:\\ROAM\\PROGRAMS\\RELAY.EXE",
        glyph = "≋",
        tagline = "A signal serpent. Swallow relay packets to grow the link — never cross your own line.",
        controls = "SWIPE or D-PAD to steer",
        license = APACHE_2,
        source = ZELI_SOURCE,
    ),
    Program(
        id = "minesweeper",
        title = "BOTFIELD",
        file = "C:\\ROAM\\PROGRAMS\\BOTFIELD.EXE",
        glyph = "▦",
        tagline = "Six bots are buried in a six-by-six grid. Sweep every clean sector; numbers count adjacent bots.",
        controls = "TAP sweep · LONG-PRESS flag",
        license = APACHE_2,
        source = ZELI_SOURCE,
    ),
    Program(
        id = "tetris",
        title = "COMPILER",
        file = "C:\\ROAM\\PROGRAMS\\COMPILER.EXE",
        glyph = "▥",
        tagline = "Falling data shards. Full lines compile out. Do not stack past the top.",
        controls = "← → move · ↑ rotate · ↓ drop",
        license = APACHE_2,
        source = ZELI_SOURCE,
    ),
    Program(
        id = "asteroids",
        title = "DEBRIS",
        file = "C:\\ROAM\\PROGRAMS\\DEBRIS.EXE",
        glyph = "✦",
        tagline = "The dead web left wreckage behind. Drift the debris field and clear it.",
        controls = "← → rotate · ↑ thrust · TAP fire",
        license = APACHE_2,
        source = ZELI_SOURCE,
    ),
)

/** Resolves a program by its stable id, or null when unknown. */
fun program(id: String): Program? = PROGRAMS.firstOrNull { it.id == id }
