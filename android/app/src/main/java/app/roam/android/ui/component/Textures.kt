package app.roam.android.ui.component

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Shader
import androidx.compose.ui.graphics.ShaderBrush
import app.roam.android.R

/** Selectable chassis/deck materials backed by CC0 tileable textures (ambientCG). */
enum class DeckTexture(val key: String, val label: String, val resId: Int) {
    Metal("metal", "Metal", R.drawable.texture_metal),
    Plastic("plastic", "Plastic", R.drawable.texture_plastic),
    Wood("wood", "Wood", R.drawable.texture_wood),
    Leather("leather", "Leather", R.drawable.texture_leather);

    companion object {
        fun fromKey(key: String): DeckTexture = values().firstOrNull { it.key == key } ?: Metal
    }
}

/** Loads a tileable material texture as a repeating [ShaderBrush]. */
fun deckTextureBrush(context: Context, texture: DeckTexture): ShaderBrush {
    val bmp = BitmapFactory.decodeResource(context.resources, texture.resId)
        ?: Bitmap.createBitmap(4, 4, Bitmap.Config.ARGB_8888)
    return ShaderBrush(BitmapShader(bmp, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT))
}