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
import com.irlog.widget.data.model.CumulativeYearlyResponse
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.ui.IRLogTwaLauncherActivity
import com.irlog.widget.ui.WidgetAuthRedirectActivity
import com.irlog.widget.ui.theme.IRLogColors
import com.irlog.widget.widget.chart.ChartBitmapRenderer
import com.irlog.widget.widget.components.AnalyticsWidgetHeader

class YearlyCumulativeWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val storage = SecureTokenStorage(context)
        val isAuth = storage.isAuthenticated
        val cachedData = storage.getCachedCumulativeYearly()
        val serverUrl = storage.serverUrl
        val isDark = storage.isDarkMode()

        provideContent {
            WidgetContent(
                isAuth = isAuth,
                cachedData = cachedData,
                serverUrl = serverUrl,
                isDark = isDark
            )
        }
    }

    @Composable
    private fun WidgetContent(
        isAuth: Boolean,
        cachedData: CumulativeYearlyResponse?,
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
                val currentYear = cachedData?.currentYear
                val prevYears = cachedData?.years ?: emptyList()
                val prevYear = prevYears.getOrNull(0)
                val twoYrsAgo = prevYears.getOrNull(1)

                val badgeText = if (currentYear != null) "${currentYear.total} This Yr" else ""

                Column(
                    modifier = GlanceModifier.fillMaxSize()
                ) {
                    // Header
                    AnalyticsWidgetHeader(
                        title = "Yearly Worm",
                        subtitle = "Jan–Dec • Cumulative Cases",
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

                    if (currentYear == null) {
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
                                    text = "No yearly worm data cached yet",
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
                        val currentMonthIdx = ((currentYear.currentMonth ?: 12) - 1).coerceIn(0, 11)
                        val chartBitmap = ChartBitmapRenderer.renderYearlyCumulativeChart(
                            currentYearData = currentYear.data,
                            previousYearData = prevYear?.data ?: emptyList(),
                            twoYearsAgoData = twoYrsAgo?.data ?: emptyList(),
                            currentMonthIndex = currentMonthIdx,
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
                                contentDescription = "Cumulative Yearly Worm Chart",
                                modifier = GlanceModifier.fillMaxSize(),
                                contentScale = ContentScale.Fit
                            )
                        }

                        // Compact Chart Legend Footer (3 curves)
                        Row(
                            modifier = GlanceModifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Current Year (Blue)
                            Box(
                                modifier = GlanceModifier
                                    .size(7.dp)
                                    .background(androidx.compose.ui.graphics.Color(0xFF2563EB))
                                    .cornerRadius(4.dp)
                            ) {}
                            Spacer(modifier = GlanceModifier.width(4.dp))
                            Text(
                                text = "${currentYear.year} (${currentYear.total})",
                                style = TextStyle(
                                    color = ColorProvider(theme.textSecondary),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            )

                            if (prevYear != null) {
                                Spacer(modifier = GlanceModifier.width(12.dp))
                                // Prev Year (Green)
                                Box(
                                    modifier = GlanceModifier
                                        .size(7.dp)
                                        .background(androidx.compose.ui.graphics.Color(0xFF10B981))
                                    .cornerRadius(4.dp)
                                ) {}
                                Spacer(modifier = GlanceModifier.width(4.dp))
                                Text(
                                    text = "${prevYear.year} (${prevYear.total})",
                                    style = TextStyle(
                                        color = ColorProvider(theme.textSecondary),
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                )
                            }

                            if (twoYrsAgo != null) {
                                Spacer(modifier = GlanceModifier.width(12.dp))
                                // 2 Years Ago (Amber)
                                Box(
                                    modifier = GlanceModifier
                                        .size(7.dp)
                                        .background(androidx.compose.ui.graphics.Color(0xFFF59E0B))
                                    .cornerRadius(4.dp)
                                ) {}
                                Spacer(modifier = GlanceModifier.width(4.dp))
                                Text(
                                    text = "${twoYrsAgo.year} (${twoYrsAgo.total})",
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
                text = "Tap to connect and view Yearly Worm Trends",
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
