package com.irlog.widget.widget.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.irlog.widget.R
import com.irlog.widget.ui.PwaLauncherActivity
import com.irlog.widget.ui.theme.IRLogColors

@Composable
fun EmptyWorklistState(
    isAllDone: Boolean = false,
    serverUrl: String = "",
    isDark: Boolean = false
) {
    val theme = IRLogColors.getThemeColors(isDark)

    val pwaUrl = if (serverUrl.isNotBlank()) {
        val base = if (serverUrl.endsWith("/")) serverUrl.dropLast(1) else serverUrl
        "$base/worklist"
    } else {
        "https://irlog.app/worklist"
    }

    val targetUrlKey = ActionParameters.Key<String>(com.irlog.widget.ui.IRLogTwaLauncherActivity.EXTRA_TARGET_URL)

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Image(
            provider = ImageProvider(if (isAllDone) R.drawable.ic_check_circle else R.drawable.ic_calendar),
            contentDescription = null,
            modifier = GlanceModifier.size(36.dp)
        )

        Spacer(modifier = GlanceModifier.height(8.dp))

        Text(
            text = if (isAllDone) "All Done for Today!" else "No Procedures Scheduled",
            style = TextStyle(
                color = ColorProvider(theme.textPrimary),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        )

        Spacer(modifier = GlanceModifier.height(2.dp))

        Text(
            text = if (isAllDone) "Great job! All worklist cases are completed." else "No appointments found for today's worklist.",
            style = TextStyle(
                color = ColorProvider(theme.textSecondary),
                fontSize = 11.sp,
                textAlign = TextAlign.Center
            )
        )

        Spacer(modifier = GlanceModifier.height(10.dp))

        // Open Worklist Button
        Box(
            modifier = GlanceModifier
                .background(IRLogColors.Primary)
                .cornerRadius(8.dp)
                .padding(horizontal = 14.dp, vertical = 6.dp)
                .clickable(
                    actionStartActivity<com.irlog.widget.ui.IRLogTwaLauncherActivity>(
                        actionParametersOf(targetUrlKey to pwaUrl)
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "Open Worklist",
                style = TextStyle(
                    color = ColorProvider(IRLogColors.Light.background),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            )
        }
    }
}
