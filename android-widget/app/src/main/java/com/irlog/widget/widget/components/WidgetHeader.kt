package com.irlog.widget.widget.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.irlog.widget.R
import com.irlog.widget.ui.MainActivity
import com.irlog.widget.ui.theme.IRLogColors
import com.irlog.widget.widget.actions.RefreshActionCallback
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun WidgetHeader(
    totalCases: Int,
    scheduledCases: Int,
    lastSyncTimestamp: Long
) {
    val dateStr = SimpleDateFormat("EEE, dd MMM", Locale.getDefault()).format(Date())

    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // App Icon and Title
        Row(
            modifier = GlanceModifier
                .defaultWeight()
                .clickable(actionStartActivity<MainActivity>()),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Image(
                provider = ImageProvider(R.drawable.ic_irlog_logo),
                contentDescription = "IRLog",
                modifier = GlanceModifier.size(24.dp)
            )

            Spacer(modifier = GlanceModifier.width(8.dp))

            Column {
                Text(
                    text = "Today's Worklist",
                    style = TextStyle(
                        color = ColorProvider(IRLogColors.TextPrimary),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                )
                Text(
                    text = dateStr,
                    style = TextStyle(
                        color = ColorProvider(IRLogColors.TextSecondary),
                        fontSize = 11.sp
                    )
                )
            }
        }

        // Count Pill Badge
        val badgeText = when {
            totalCases == 0 -> "0 Cases"
            scheduledCases == 0 && totalCases > 0 -> "All Done ✓"
            else -> "$scheduledCases Pending"
        }
        val badgeBg = if (scheduledCases == 0 && totalCases > 0) IRLogColors.StatusDoneBg else IRLogColors.PrimaryLight
        val badgeTextColor = if (scheduledCases == 0 && totalCases > 0) IRLogColors.StatusDone else IRLogColors.PrimaryDark

        Box(
            modifier = GlanceModifier
                .background(badgeBg)
                .cornerRadius(12.dp)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = badgeText,
                style = TextStyle(
                    color = ColorProvider(badgeTextColor),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            )
        }

        Spacer(modifier = GlanceModifier.width(8.dp))

        // Refresh Button
        Box(
            modifier = GlanceModifier
                .size(30.dp)
                .background(IRLogColors.WidgetCardBg)
                .cornerRadius(15.dp)
                .clickable(actionRunCallback<RefreshActionCallback>()),
            contentAlignment = Alignment.Center
        ) {
            Image(
                provider = ImageProvider(R.drawable.ic_refresh),
                contentDescription = "Refresh",
                modifier = GlanceModifier.size(16.dp)
            )
        }
    }
}
