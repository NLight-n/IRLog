package com.irlog.widget.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.irlog.widget.R
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.ui.IRLogTwaLauncherActivity
import com.irlog.widget.ui.MainActivity
import com.irlog.widget.ui.WidgetAuthRedirectActivity
import com.irlog.widget.ui.theme.IRLogColors
import com.irlog.widget.widget.actions.RefreshActionCallback
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class IRLogSmallWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val storage = SecureTokenStorage(context)
        val isAuth = storage.isAuthenticated
        val cachedResponse = storage.getCachedWorklist()
        val isDark = storage.isDarkMode()

        provideContent {
            SmallWidgetContent(isAuth = isAuth, cachedResponse = cachedResponse, isDark = isDark)
        }
    }

    @Composable
    private fun SmallWidgetContent(
        isAuth: Boolean,
        cachedResponse: com.irlog.widget.data.model.TodayWorklistResponse?,
        isDark: Boolean
    ) {
        val theme = IRLogColors.getThemeColors(isDark)
        val dateStr = SimpleDateFormat("EEE, dd MMM", Locale.getDefault()).format(Date())

        val clickAction = if (isAuth) {
            actionStartActivity<IRLogTwaLauncherActivity>()
        } else {
            actionStartActivity<WidgetAuthRedirectActivity>()
        }

        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(theme.background)
                .cornerRadius(16.dp)
                .clickable(clickAction)
        ) {
            if (!isAuth) {
                // Unauthenticated: Show setup prompt
                Row(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Image(
                        provider = ImageProvider(R.drawable.ic_irlog_logo),
                        contentDescription = "IRLog",
                        modifier = GlanceModifier.size(28.dp)
                    )
                    Spacer(modifier = GlanceModifier.width(10.dp))
                    Text(
                        text = "Tap to connect IRLog",
                        style = TextStyle(
                            color = ColorProvider(theme.textSecondary),
                            fontSize = 13.sp
                        )
                    )
                }
            } else {
                val summary = cachedResponse?.summary
                val pending = summary?.scheduled ?: 0
                val done = summary?.done ?: 0

                Row(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Logo
                    Image(
                        provider = ImageProvider(R.drawable.ic_irlog_logo),
                        contentDescription = "IRLog",
                        modifier = GlanceModifier.size(28.dp)
                    )

                    Spacer(modifier = GlanceModifier.width(10.dp))

                    // Date + Counts
                    Column(
                        modifier = GlanceModifier.defaultWeight()
                    ) {
                        Text(
                            text = dateStr,
                            style = TextStyle(
                                color = ColorProvider(theme.textSecondary),
                                fontSize = 12.sp
                            ),
                            maxLines = 1
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            // Pending count
                            Text(
                                text = "$pending",
                                style = TextStyle(
                                    color = ColorProvider(IRLogColors.Primary),
                                    fontSize = 19.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            Text(
                                text = " pending",
                                style = TextStyle(
                                    color = ColorProvider(theme.textMuted),
                                    fontSize = 12.sp
                                )
                            )
                            Spacer(modifier = GlanceModifier.width(8.dp))
                            // Done count
                            val doneColor = IRLogColors.getStatusColors("Done", isDark)
                            Text(
                                text = "$done",
                                style = TextStyle(
                                    color = ColorProvider(doneColor.border),
                                    fontSize = 19.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            Text(
                                text = " done",
                                style = TextStyle(
                                    color = ColorProvider(theme.textMuted),
                                    fontSize = 12.sp
                                )
                            )
                        }
                    }

                    // Refresh button
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
                            modifier = GlanceModifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}
