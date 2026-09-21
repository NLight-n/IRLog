package com.irlog.widget.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.irlog.widget.data.model.MonthlyTrendsResponse
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.ui.IRLogTwaLauncherActivity
import com.irlog.widget.ui.WidgetAuthRedirectActivity
import com.irlog.widget.ui.theme.IRLogColors
import com.irlog.widget.widget.chart.ChartBitmapRenderer
import com.irlog.widget.widget.components.AnalyticsWidgetHeader
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MonthlyTrendsWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val storage = SecureTokenStorage(context)
        val isAuth = storage.isAuthenticated
        val cachedTrends = storage.getCachedMonthlyTrends()
        val serverUrl = storage.serverUrl
        val isDark = storage.isDarkMode()

        provideContent {
            WidgetContent(
                isAuth = isAuth,
                cachedTrends = cachedTrends,
                serverUrl = serverUrl,
                isDark = isDark
            )
        }
    }

    @Composable
    private fun WidgetContent(
        isAuth: Boolean,
        cachedTrends: MonthlyTrendsResponse?,
        serverUrl: String,
        isDark: Boolean
    ) {
        val theme = IRLogColors.getThemeColors(isDark)
        val targetUrlKey = ActionParameters.Key<String>(IRLogTwaLauncherActivity.EXTRA_TARGET_URL)
        val analyticsUrl = if (serverUrl.isNotBlank()) {
            "${serverUrl.trimEnd('/')}/analytics"
        } else {
            IRLogTwaLauncherActivity.DEFAULT_URL + "/analytics"
        }

        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(theme.background)
                .cornerRadius(18.dp)
        ) {
            if (!isAuth) {
                UnauthenticatedView(isDark = isDark)
            } else {
                val labels = cachedTrends?.labels ?: emptyList()
                val seriesList = cachedTrends?.series ?: emptyList()
                val casesSeries = seriesList.find { it.name.contains("Procedure", ignoreCase = true) && !it.name.contains("Cost", ignoreCase = true) }
                    ?: seriesList.getOrNull(0)
                val costSeries = seriesList.find { it.name.contains("Cost", ignoreCase = true) }
                    ?: seriesList.getOrNull(1)

                val casesData = casesSeries?.data ?: emptyList()
                val costData = costSeries?.data ?: emptyList()

                val lastMonthCases = casesData.filterNotNull().lastOrNull()?.toInt()
                val badgeText = if (lastMonthCases != null) "$lastMonthCases This Mo" else ""

                Column(
                    modifier = GlanceModifier.fillMaxSize()
                ) {
                    // Header
                    AnalyticsWidgetHeader(
                        title = "Monthly Trends",
                        subtitle = "Last 6 Mo • Cases & Cost",
                        badgeText = badgeText,
                        serverUrl = serverUrl,
                        isDark = isDark
                    )

                    // Thin Divider
                    Box(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(theme.divider)
                    ) {}

                    if (labels.isEmpty() || casesData.isEmpty()) {
                        // Empty / Loading State
                        Box(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .defaultWeight()
                                .clickable(
                                    actionStartActivity<IRLogTwaLauncherActivity>(
                                        actionParametersOf(targetUrlKey to analyticsUrl)
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "No analytics cached yet",
                                    style = TextStyle(
                                        color = ColorProvider(theme.textPrimary),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                Spacer(modifier = GlanceModifier.height(4.dp))
                                Text(
                                    text = "Tap ↻ or open IRLog to sync",
                                    style = TextStyle(
                                        color = ColorProvider(theme.textSecondary),
                                        fontSize = 11.sp
                                    )
                                )
                            }
                        }
                    } else {
                        // Chart Body
                        val chartBitmap = ChartBitmapRenderer.renderMonthlyTrendsChart(
                            labels = labels,
                            casesData = casesData,
                            costData = costData,
                            isDark = isDark,
                            width = 720,
                            height = 250
                        )

                        // Chart container with TWA click navigation
                        Box(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .defaultWeight()
                                .padding(horizontal = 4.dp, vertical = 2.dp)
                                .clickable(
                                    actionStartActivity<IRLogTwaLauncherActivity>(
                                        actionParametersOf(targetUrlKey to analyticsUrl)
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Image(
                                provider = ImageProvider(chartBitmap),
                                contentDescription = "Monthly Trends: Cases vs Cost",
                                modifier = GlanceModifier.fillMaxSize(),
                                contentScale = ContentScale.Fit
                            )
                        }

                        // Compact Chart Legend Footer
                        Row(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Cases indicator (Blue dot)
                            Box(
                                modifier = GlanceModifier
                                    .size(7.dp)
                                    .background(androidx.compose.ui.graphics.Color(0xFF2563EB))
                                    .cornerRadius(4.dp)
                            ) {}
                            Spacer(modifier = GlanceModifier.width(4.dp))
                            Text(
                                text = "Cases",
                                style = TextStyle(
                                    color = ColorProvider(theme.textSecondary),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            )

                            Spacer(modifier = GlanceModifier.width(16.dp))

                            // Cost indicator (Red/Amber dot with $)
                            Box(
                                modifier = GlanceModifier
                                    .size(7.dp)
                                    .background(androidx.compose.ui.graphics.Color(0xFFEF4444))
                                    .cornerRadius(4.dp)
                            ) {}
                            Spacer(modifier = GlanceModifier.width(4.dp))
                            Text(
                                text = "Cost ($)",
                                style = TextStyle(
                                    color = ColorProvider(theme.textSecondary),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            )
                        }
                    }
                }
            }
        }
    }

    @Composable
    private fun UnauthenticatedView(isDark: Boolean) {
        val theme = IRLogColors.getThemeColors(isDark)

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .padding(16.dp)
                .clickable(actionStartActivity<WidgetAuthRedirectActivity>()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Connect IRLog Widget",
                style = TextStyle(
                    color = ColorProvider(theme.textPrimary),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            )
            Spacer(modifier = GlanceModifier.height(4.dp))
            Text(
                text = "Tap to connect and view Monthly Trends",
                style = TextStyle(
                    color = ColorProvider(theme.textSecondary),
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center
                )
            )
            Spacer(modifier = GlanceModifier.height(10.dp))
            Box(
                modifier = GlanceModifier
                    .background(IRLogColors.Primary)
                    .cornerRadius(8.dp)
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "Connect Widget",
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
