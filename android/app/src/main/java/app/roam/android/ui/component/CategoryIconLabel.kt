package app.roam.android.ui.component

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** A category emoji + name rendered as an icon + label row (chips, dropdowns, buttons). */
@Composable
fun CategoryIconLabel(
    emoji: String,
    name: String,
    modifier: Modifier = Modifier,
    textStyle: TextStyle? = null,
    textColor: Color = Color.Unspecified,
    iconSize: Dp = 18.dp,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(
            imageVector = RoamOsIcons.forCategoryIcon(emoji),
            contentDescription = null,
            modifier = Modifier.size(iconSize),
        )
        Spacer(Modifier.width(6.dp))
        if (textStyle != null) {
            Text(name, style = textStyle, color = textColor)
        } else {
            Text(name, color = textColor)
        }
    }
}
