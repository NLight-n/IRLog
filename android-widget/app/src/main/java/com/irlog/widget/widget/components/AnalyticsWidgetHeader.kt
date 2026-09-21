package com.irlog.widget.widget.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
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
import com.irlog.widget.ui.IRLogTwaLauncherActivity
import com.irlog.widget.ui.theme.IRLogColors
import com.irlog.widget.widget.actions.RefreshActionCallback
import com.irlog.widget.widget.actions.ToggleThemeActionCallback

@Composable
fun AnalyticsWidgetHeader(
    title: String,
    subtitle: String,
    badgeText: String,
    serverUrl: String,
    isDark: Boolean = false
) {
    val theme = IRLogColors.getThemeColors(isDark)
    val targetUrlKey = ActionParameters.Key<String>(IRLogTwaLauncherActivity.EXTRA_TARGET_URL)
    val analyticsUrl = if (serverUrl.isNotBlank()) {
        "${serverUrl.trimEnd('/')}/analytics"
    } else {
        IRLogTwaLauncherActivity.DEFAULT_URL + "/analytics"
    }

    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // App Logo & Title (Click to open TWA Analytics)
        Row(
            modifier = GlanceModifier
                .defaultWeight()
                .clickable(
                    actionStartActivity<IRLogTwaLauncherActivity>(
                        actionParametersOf(targetUrlKey to analyticsUrl)
                    )
                ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Image(
                provider = ImageProvider(R.drawable.ic_irlog_logo),
                contentDescription = "IRLog",
                modifier = GlanceModifier.size(24.dp)
            )

            Spacer(modifier = GlanceModifier.width(6.dp))

            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "IRLog",
                        style = TextStyle(
                            color = ColorProvider(IRLogColors.Primary),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    )
                    Spacer(modifier = GlanceModifier.width(3.dp))
                    Text(
                        text = "• $title",
                        style = TextStyle(
                            color = ColorProvider(theme.textPrimary),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    )
                }
                Text(
                    text = subtitle,
                    style = TextStyle(
                        color = ColorProvider(theme.textSecondary),
                        fontSize = 10.sp
                    )
                )
            }
        }

        // Stats Pill Badge
        if (badgeText.isNotBlank()) {
            Box(
                modifier = GlanceModifier
                    .background(theme.badgeBg)
                    .cornerRadius(10.dp)
                    .padding(horizontal = 7.dp, vertical = 3.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = badgeText,
                    style = TextStyle(
                        color = ColorProvider(theme.badgeText),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                )
            }
            Spacer(modifier = GlanceModifier.width(5.dp))
        }

        // Dark/Light Theme Toggle Button
        Box(
            modifier = GlanceModifier
                .size(26.dp)
                .background(theme.actionBg)
                .cornerRadius(13.dp)
                .clickable(actionRunCallback<ToggleThemeActionCallback>()),
            contentAlignment = Alignment.Center
        ) {
            Image(
                provider = ImageProvider(if (isDark) R.drawable.ic_sun else R.drawable.ic_moon),
                contentDescription = "Toggle Theme",
                modifier = GlanceModifier.size(15.dp),
                colorFilter = ColorFilter.tint(
                    ColorProvider(if (isDark) IRLogColors.Primary else theme.textPrimary)
                )
            )
        }

        Spacer(modifier = GlanceModifier.width(5.dp))

        // Refresh Button
        Box(
            modifier = GlanceModifier
                .size(26.dp)
                .background(theme.actionBg)
                .cornerRadius(13.dp)
                .clickable(actionRunCallback<RefreshActionCallback>()),
            contentAlignment = Alignment.Center
        ) {
            Image(
                provider = ImageProvider(R.drawable.ic_refresh),
                contentDescription = "Refresh",
                modifier = GlanceModifier.size(15.dp),
                colorFilter = ColorFilter.tint(ColorProvider(theme.textPrimary))
            )
        }
    }
}
