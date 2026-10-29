package app.roam.android.ui.component

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddTask
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.BlurOn
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Collections
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.automirrored.filled.Label
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Radar
import androidx.compose.material.icons.filled.SatelliteAlt
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.filled.TravelExplore
import androidx.compose.ui.graphics.vector.ImageVector
import app.roam.android.model.Badge

/**
 * ROAM-OS HUD glyph set — Material Icons Extended (Apache 2.0), tinted per key.
 * Also maps the server-side emoji (badges/categories/notifications) to monochrome
 * vector icons so the whole theme reads as one cohesive, legally-clean system.
 */
object RoamOsIcons {
    // Deck keys
    val Dislike: ImageVector get() = Icons.Filled.ThumbDown
    val Like: ImageVector get() = Icons.Filled.ThumbUp
    val Roam: ImageVector get() = Icons.Filled.Radar
    val You: ImageVector get() = Icons.Filled.Settings // gear glyph; still opens the You hub
    val Menu: ImageVector get() = Icons.Filled.Menu
    val Comms: ImageVector get() = Icons.Filled.SatelliteAlt

    /** Category emoji → icon (the eight core categories). */
    fun forCategoryIcon(emoji: String): ImageVector = when (emoji) {
        "\uD83D\uDD2C" -> Icons.Filled.Science          // 🔬
        "\uD83D\uDCBB" -> Icons.Filled.Computer         // 💻
        "\uD83C\uDFA8" -> Icons.Filled.Palette          // 🎨
        "\uD83D\uDCDC" -> Icons.AutoMirrored.Filled.MenuBook         // 📜
        "\uD83C\uDFAE" -> Icons.Filled.SportsEsports    // 🎮
        "\uD83C\uDF00" -> Icons.Filled.BlurOn           // 🌀
        "\uD83C\uDF0D" -> Icons.Filled.Public           // 🌍
        "\uD83E\uDDE0" -> Icons.Filled.Psychology       // 🧠
        else -> Icons.AutoMirrored.Filled.Label
    }

    /** Badge → icon, keyed on badge category with an emoji fallback. */
    fun forBadge(badge: Badge): ImageVector = when (badge.category) {
        "exploration" -> Icons.Filled.TravelExplore
        "collecting" -> Icons.Filled.Collections
        "curating" -> Icons.Filled.Edit
        "social" -> Icons.Filled.Group
        "streaks" -> Icons.Filled.LocalFireDepartment
        "contributing" -> Icons.Filled.AddTask
        "engagement" -> Icons.Filled.Favorite
        "secret" -> Icons.Filled.Lock
        "milestone" -> Icons.Filled.MilitaryTech
        "gift" -> Icons.Filled.CardGiftcard
        else -> forEmoji(badge.icon)
    }

    /** Hidden (locked, un-revealed) badge glyph. */
    val HiddenBadge: ImageVector get() = Icons.AutoMirrored.Filled.HelpOutline

    /** Curated emoji → icon table with a trophy fallback. */
    fun forEmoji(emoji: String): ImageVector = when (emoji) {
        "\uD83C\uDFC6" -> Icons.Filled.EmojiEvents          // 🏆
        "\uD83C\uDFC5" -> Icons.Filled.EmojiEvents          // 🏅
        "\uD83D\uDD25" -> Icons.Filled.LocalFireDepartment  // 🔥
        "\uD83C\uDF19" -> Icons.Filled.Bedtime              // 🌙
        "\u2B50" -> Icons.Filled.Star                       // ⭐
        "\u2764\uFE0F", "\u2764" -> Icons.Filled.Favorite   // ❤️ / ❤
        "\uD83D\uDC4D" -> Icons.Filled.ThumbUp              // 👍
        "\uD83D\uDCD6" -> Icons.AutoMirrored.Filled.MenuBook             // 📖
        "\uD83C\uDFAF" -> Icons.Filled.GpsFixed             // 🎯
        else -> Icons.Filled.EmojiEvents
    }
}