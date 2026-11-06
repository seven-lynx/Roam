package app.roam.android.ui.component

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp
import app.roam.android.model.Badge
import java.util.Locale

/**
 * Renders the webapp's badge glyph markup (see [RoamBadgeGlyphData], ported from
 * web/src/lib/icons.ts) into Compose [ImageVector]s, using the same resolution
 * order as the web app:
 *
 *   exact slug -> category (normalized) -> DEFAULT_GLYPH,
 *   with per-tier pips appended for slug-matched (chained) badges.
 *
 * Glyphs are stroke-based (like the web's `strokeWidth 1.7` SVG pass) and painted
 * in a neutral colour so the hosting `Icon(tint = …)` recolours them like the
 * web's `currentColor` theming. Hidden/locked badges use the web's HIDDEN_GLYPH.
 */
object RoamBadgeGlyphs {

    private val cache = mutableMapOf<String, ImageVector>()

    /** Legacy `engagement` category was renamed to `curiosity` (mirrors web). */
    fun normalizeCategory(category: String): String =
        if (category == "engagement") "curiosity" else category

    /**
     * Mirror of web `resolveBadgeGlyph(slug, category, tier)`. Every badge resolves
     * to a non-null vector: slug override (with tier pips), else category glyph
     * (normalized), else the default medal.
     */
    fun resolveBadgeGlyph(slug: String, category: String, tier: Int = 0): ImageVector {
        val base = RoamBadgeGlyphData.badgeGlyphs[slug]
        if (base != null) {
            val key = "$slug|$tier"
            return cache.getOrPut(key) { buildImageVector(base, tierPipsMarkup(tier)) }
        }
        val cat = normalizeCategory(category)
        val catGlyph = RoamBadgeGlyphData.categoryGlyphs[cat]
            ?: RoamBadgeGlyphData.categoryGlyphs[category]
            ?: RoamBadgeGlyphData.defaultGlyph
        return cache.getOrPut("__cat__:$catGlyph") { buildImageVector(catGlyph, "") }
    }

    /** Question-mark medal for locked, un-revealed badges (web HIDDEN_GLYPH). */
    val hiddenGlyph: ImageVector by lazy {
        buildImageVector(RoamBadgeGlyphData.hiddenGlyph, "")
    }

    /** Icon for a badge, matching the web `BadgeGlyph` (hidden -> HIDDEN_GLYPH). */
    fun forBadge(badge: Badge): ImageVector {
        if (badge.isHidden && !badge.isUnlocked) return hiddenGlyph
        return resolveBadgeGlyph(badge.slug, badge.category, badge.tier)
    }

    // ── Tier pips (web tierAccent): N small filled dots under the glyph ───────
    private fun tierPipsMarkup(tier: Int): String {
        val n = tier.coerceIn(0, 5)
        if (n == 0) return ""
        val x0 = 12f - ((n - 1) * 2.5f) / 2f
        val sb = StringBuilder()
        for (i in 0 until n) {
            val cx = two(x0 + i * 2.5f)
            sb.append("<circle cx=\"").append(cx).append("\" cy=\"21.2\" r=\"0.85\"/>")
        }
        return sb.toString()
    }

    private fun two(v: Float): String = String.format(Locale.US, "%.2f", v)

    // ── SVG subset -> ImageVector ─────────────────────────────────────────────
    // Only the element types the web glyph pack uses: <path d>, <circle>,
    // <rect (rx)>. Converted to SVG path data and added with the correct paint
    // (body stroked, tier pips filled).
    private fun buildImageVector(bodyMarkup: String, pipMarkup: String): ImageVector =
        ImageVector.Builder(
            name = "RoamBadgeGlyph",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
            val body = svgMarkupToPathData(bodyMarkup)
            if (body.isNotEmpty()) {
                addPath(
                    pathData = PathParser().parsePathString(body).toNodes(),
                    stroke = SolidColor(Color.Black),
                    strokeLineWidth = 1.7f,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                    strokeLineMiter = 4f,
                )
            }
            val pips = svgMarkupToPathData(pipMarkup)
            if (pips.isNotEmpty()) {
                addPath(pathData = PathParser().parsePathString(pips).toNodes(), fill = SolidColor(Color.Black))
            }
        }.build()

    private val ELEMENT = Regex("<(path|circle|rect)\\b([^>]*?)/?>")
    private val ATTR = Regex("([a-zA-Z]+)=\"(-?[0-9.]+)\"")
    private val D_ATTR = Regex("d=\"([^\"]*)\"")

    /** Converts a sequence of <path|circle|rect> elements into one path-data string. */
    private fun svgMarkupToPathData(markup: String): String {
        val sb = StringBuilder()
        for (el in ELEMENT.findAll(markup)) {
            val tag = el.groupValues[1]
            val raw = el.groupValues[2]
            val attrs = mutableMapOf<String, Float>()
            for (a in ATTR.findAll(raw)) {
                attrs[a.groupValues[1]] = a.groupValues[2].toFloat()
            }
            when (tag) {
                "path" -> sb.append(D_ATTR.find(raw)?.groupValues?.get(1) ?: "")
                "circle" -> {
                    val cx = attrs["cx"] ?: 0f
                    val cy = attrs["cy"] ?: 0f
                    val r = attrs["r"] ?: 0f
                    sb.append("M${cx - r} $cy a $r $r 0 1 0 ${2 * r} 0 a $r $r 0 1 0 ${-2 * r} 0 Z")
                }
                "rect" -> sb.append(rectPath(attrs))
            }
        }
        return sb.toString()
    }

    private fun rectPath(a: Map<String, Float>): String {
        val x = a["x"] ?: 0f
        val y = a["y"] ?: 0f
        val w = a["width"] ?: 0f
        val h = a["height"] ?: 0f
        val rx = (a["rx"] ?: 0f).coerceAtMost(w / 2f)
        val ry = (a["ry"] ?: rx).coerceAtMost(h / 2f)
        if (rx <= 0f || ry <= 0f) {
            return "M$x $y L${x + w} $y L${x + w} ${y + h} L$x ${y + h} Z"
        }
        return buildString {
            append("M${x + rx} $y ")
            append("L${x + w - rx} $y ")
            append("A$rx $ry 0 0 1 ${x + w} ${y + ry} ")
            append("L${x + w} ${y + h - ry} ")
            append("A$rx $ry 0 0 1 ${x + w - rx} ${y + h} ")
            append("L${x + rx} ${y + h} ")
            append("A$rx $ry 0 0 1 $x ${y + h - ry} ")
            append("L$x ${y + ry} ")
            append("A$rx $ry 0 0 1 ${x + rx} $y Z")
        }
    }
}