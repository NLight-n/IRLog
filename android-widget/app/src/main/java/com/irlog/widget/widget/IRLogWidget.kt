package com.irlog.widget.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.ui.MainActivity
import com.irlog.widget.ui.theme.IRLogColors
import com.irlog.widget.widget.components.EmptyWorklistState
import com.irlog.widget.widget.components.WidgetHeader
import com.irlog.widget.widget.components.WorkItemRow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class IRLogWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val storage = SecureTokenStorage(context)
        val isAuth = storage.isAuthenticated
        val cachedResponse = storage.getCachedWorklist()
        val serverUrl = storage.serverUrl
        val lastSync = storage.lastSyncTime
        val isDark = storage.isDarkMode()

        provideContent {
            WidgetContent(
                context = context,
                isAuth = isAuth,
                cachedResponse = cachedResponse,
                serverUrl = serverUrl,
                lastSync = lastSync,
                isDark = isDark
            )
        }
    }

    @Composable
    private fun WidgetContent(
        context: Context,
        isAuth: Boolean,
        cachedResponse: com.irlog.widget.data.model.TodayWorklistResponse?,
        serverUrl: String,
        lastSync: Long,
        isDark: Boolean
    ) {
        val theme = IRLogColors.getThemeColors(isDark)

        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(theme.background)
                .cornerRadius(18.dp)
        ) {
            if (!isAuth) {
                UnauthenticatedWidgetView(isDark = isDark)
            } else {
                val items = cachedResponse?.items ?: emptyList()
                val totalCount = cachedResponse?.summary?.total ?: items.size
                val scheduledCount = cachedResponse?.summary?.scheduled ?: items.count { it.status == "Scheduled" }
                val isAllDone = totalCount > 0 && scheduledCount == 0

                Column(
                    modifier = GlanceModifier.fillMaxSize()
                ) {
                    // Top Header with IRLog Branding & Theme Toggle
                    WidgetHeader(
                        totalCases = totalCount,
                        scheduledCases = scheduledCount,
                        lastSyncTimestamp = lastSync,
                        isDark = isDark
                    )

                    // Thin Divider
                    Box(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(theme.divider)
                    ) {}

                    // Content: Empty State or Scrollable List
                    if (items.isEmpty()) {
                        Box(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .defaultWeight()
                        ) {
                            EmptyWorklistState(
                                context = context,
                                isAllDone = isAllDone,
                                serverUrl = serverUrl,
                                isDark = isDark
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .defaultWeight()
                                .padding(vertical = 4.dp)
                        ) {
                            items(items) { item ->
                                WorkItemRow(
                                    context = context,
                                    item = item,
                                    serverUrl = serverUrl,
                                    isDark = isDark
                                )
                            }
                        }
                    }

                    // Bottom Status Footer
                    if (lastSync > 0) {
                        val timeStr = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date(lastSync))
                        Row(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 4.dp),
                            horizontalAlignment = Alignment.End,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Synced $timeStr",
                                style = TextStyle(
                                    color = ColorProvider(theme.textMuted),
                                    fontSize = 9.sp
                                )
                            )
                        }
                    }
                }
            }
        }
    }

    @Composable
    private fun UnauthenticatedWidgetView(isDark: Boolean) {
        val theme = IRLogColors.getThemeColors(isDark)

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .padding(16.dp)
                .clickable(actionStartActivity<MainActivity>()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "IRLog Setup Required",
                style = TextStyle(
                    color = ColorProvider(theme.textPrimary),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            )

            Spacer(modifier = GlanceModifier.height(4.dp))

            Text(
                text = "Tap here to sign in with your Passkey and connect to today's worklist.",
                style = TextStyle(
                    color = ColorProvider(theme.textSecondary),
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center
                )
            )

            Spacer(modifier = GlanceModifier.height(12.dp))

            Box(
                modifier = GlanceModifier
                    .background(IRLogColors.Primary)
                    .cornerRadius(8.dp)
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text(
                    text = "Sign In",
                    style = TextStyle(
                        color = ColorProvider(IRLogColors.Light.background),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                )
            }
        }
    }
}
