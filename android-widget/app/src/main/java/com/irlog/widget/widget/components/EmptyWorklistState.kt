package com.irlog.widget.widget.components

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.irlog.widget.R
import com.irlog.widget.ui.theme.IRLogColors

@Composable
fun EmptyWorklistState(
    isAllDone: Boolean = false,
    serverUrl: String = ""
) {
    val pwaUrl = if (serverUrl.isNotBlank()) {
        val base = if (serverUrl.endsWith("/")) serverUrl.dropLast(1) else serverUrl
        "$base/worklist"
    } else {
        "https://irlog.app/worklist"
    }

    val openWorklistIntent = Intent(Intent.ACTION_VIEW, Uri.parse(pwaUrl)).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }

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
                color = ColorProvider(IRLogColors.TextPrimary),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        )

        Spacer(modifier = GlanceModifier.height(2.dp))

        Text(
            text = if (isAllDone) "Great job! All worklist cases are completed." else "Enjoy your day or check back later.",
            style = TextStyle(
                color = ColorProvider(IRLogColors.TextSecondary),
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
                .padding(horizontal = 12.dp, vertical = 6.dp)
                .clickable(actionStartActivity(openWorklistIntent)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "Open Worklist",
                style = TextStyle(
                    color = ColorProvider(IRLogColors.WidgetBackground),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            )
        }
    }
}
