package com.irlog.widget.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
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
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.irlog.widget.R
import com.irlog.widget.data.model.WorkItemDto
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.ui.MainActivity
import com.irlog.widget.ui.WidgetAuthRedirectActivity
import com.irlog.widget.ui.theme.IRLogColors
import com.irlog.widget.widget.actions.RefreshActionCallback
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class IRLogMediumWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val storage = SecureTokenStorage(context)
        val isAuth = storage.isAuthenticated
        val cachedResponse = storage.getCachedWorklist()
        val isDark = storage.isDarkMode()

        provideContent {
            MediumWidgetContent(isAuth = isAuth, cachedResponse = cachedResponse, isDark = isDark)
        }
    }

    @Composable
    private fun MediumWidgetContent(
        isAuth: Boolean,
        cachedResponse: com.irlog.widget.data.model.TodayWorklistResponse?,
        isDark: Boolean
    ) {
        val theme = IRLogColors.getThemeColors(isDark)
        val dateStr = SimpleDateFormat("EEE, dd MMM", Locale.getDefault()).format(Date())

        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(theme.background)
                .cornerRadius(16.dp)
        ) {
            if (!isAuth) {
                Column(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .padding(12.dp)
                        .clickable(actionStartActivity<WidgetAuthRedirectActivity>()),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Image(
                        provider = ImageProvider(R.drawable.ic_irlog_logo),
                        contentDescription = "IRLog",
                        modifier = GlanceModifier.size(36.dp)
                    )
                    Spacer(modifier = GlanceModifier.height(6.dp))
                    Text(
                        text = "Tap to connect IRLog",
                        style = TextStyle(
                            color = ColorProvider(theme.textSecondary),
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center
                        )
                    )
                }
            } else {
                val items = cachedResponse?.items ?: emptyList()
                val summary = cachedResponse?.summary
                val pending = summary?.scheduled ?: 0
                val done = summary?.done ?: 0
                val notDone = summary?.notDone ?: 0
                val cancelled = summary?.cancelled ?: 0

                Column(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .padding(10.dp)
                ) {
                    // ── Header Row: Logo + Title + Date + Refresh ──
                    Row(
                        modifier = GlanceModifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Image(
                            provider = ImageProvider(R.drawable.ic_irlog_logo),
                            contentDescription = "IRLog",
                            modifier = GlanceModifier.size(26.dp)
                        )
                        Spacer(modifier = GlanceModifier.width(8.dp))
                        Column(modifier = GlanceModifier.defaultWeight()) {
                            Text(
                                text = "IRLog",
                                style = TextStyle(
                                    color = ColorProvider(IRLogColors.Primary),
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            Text(
                                text = dateStr,
                                style = TextStyle(
                                    color = ColorProvider(theme.textMuted),
                                    fontSize = 11.sp
                                )
                            )
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

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    // ── Counts Row: Pending + Done + NotDone + Cancelled ──
                    Row(
                        modifier = GlanceModifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Pending
                        CountBadge(
                            count = pending,
                            label = "Pending",
                            color = IRLogColors.Primary,
                            isDark = isDark
                        )
                        Spacer(modifier = GlanceModifier.width(6.dp))
                        // Done
                        val doneColor = IRLogColors.getStatusColors("Done", isDark)
                        CountBadge(
                            count = done,
                            label = "Done",
                            color = doneColor.border,
                            isDark = isDark
                        )
                        if (notDone > 0) {
                            Spacer(modifier = GlanceModifier.width(6.dp))
                            val ndColor = IRLogColors.getStatusColors("NotDone", isDark)
                            CountBadge(
                                count = notDone,
                                label = "N/D",
                                color = ndColor.border,
                                isDark = isDark
                            )
                        }
                        if (cancelled > 0) {
                            Spacer(modifier = GlanceModifier.width(6.dp))
                            val cxColor = IRLogColors.getStatusColors("Cancelled", isDark)
                            CountBadge(
                                count = cancelled,
                                label = "Cxl",
                                color = cxColor.border,
                                isDark = isDark
                            )
                        }
                    }

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    // ── Divider ──
                    Box(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(theme.divider)
                    ) {}

                    Spacer(modifier = GlanceModifier.height(4.dp))

                    // ── Modality Breakdown with Dots ──
                    val modalityGroups = items.groupBy { it.modality.uppercase() }
                    if (modalityGroups.isNotEmpty()) {
                        Column(modifier = GlanceModifier.fillMaxWidth()) {
                            for ((modality, modalItems) in modalityGroups) {
                                ModalityDotRow(
                                    modality = modality,
                                    items = modalItems,
                                    isDark = isDark
                                )
                            }
                        }
                    } else {
                        Box(
                            modifier = GlanceModifier.fillMaxWidth().defaultWeight(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No cases today",
                                style = TextStyle(
                                    color = ColorProvider(theme.textMuted),
                                    fontSize = 12.sp
                                )
                            )
                        }
                    }
                }
            }
        }
    }

    @Composable
    private fun CountBadge(count: Int, label: String, color: Color, isDark: Boolean) {
        val theme = IRLogColors.getThemeColors(isDark)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "$count",
                style = TextStyle(
                    color = ColorProvider(color),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            )
            Spacer(modifier = GlanceModifier.width(3.dp))
            Text(
                text = label,
                style = TextStyle(
                    color = ColorProvider(theme.textMuted),
                    fontSize = 11.sp
                )
            )
        }
    }

    @Composable
    private fun ModalityDotRow(modality: String, items: List<WorkItemDto>, isDark: Boolean) {
        val modalityColors = IRLogColors.getModalityColors(isDark)

        val scheduledCount = items.count { it.status == "Scheduled" }
        val doneCount = items.count { it.status == "Done" }
        val notDoneCount = items.count { it.status == "NotDone" }
        val cancelledCount = items.count { it.status == "Cancelled" }

        // Dot colors
        val blueDot = if (isDark) Color(0xFF60A5FA) else Color(0xFF3B82F6)   // Scheduled/Pending
        val greenDot = if (isDark) Color(0xFF4ADE80) else Color(0xFF22C55E)  // Done
        val yellowDot = if (isDark) Color(0xFFFDE047) else Color(0xFFF59E0B) // Not Done
        val redDot = if (isDark) Color(0xFFF87171) else Color(0xFFEF4444)    // Cancelled

        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .padding(vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Modality tag
            Box(
                modifier = GlanceModifier
                    .background(modalityColors.badgeBg)
                    .cornerRadius(4.dp)
                    .padding(horizontal = 8.dp, vertical = 2.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = modality,
                    style = TextStyle(
                        color = ColorProvider(modalityColors.badgeText),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                )
            }

            Spacer(modifier = GlanceModifier.width(8.dp))

            // Blue dots (Scheduled)
            if (scheduledCount > 0) {
                Text(
                    text = "● ".repeat(scheduledCount).trimEnd(),
                    style = TextStyle(
                        color = ColorProvider(blueDot),
                        fontSize = 16.sp
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
            }

            // Green dots (Done)
            if (doneCount > 0) {
                Text(
                    text = "● ".repeat(doneCount).trimEnd(),
                    style = TextStyle(
                        color = ColorProvider(greenDot),
                        fontSize = 16.sp
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
            }

            // Yellow dots (Not Done)
            if (notDoneCount > 0) {
                Text(
                    text = "● ".repeat(notDoneCount).trimEnd(),
                    style = TextStyle(
                        color = ColorProvider(yellowDot),
                        fontSize = 16.sp
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
            }

            // Red dots (Cancelled)
            if (cancelledCount > 0) {
                Text(
                    text = "● ".repeat(cancelledCount).trimEnd(),
                    style = TextStyle(
                        color = ColorProvider(redDot),
                        fontSize = 16.sp
                    )
                )
            }
        }
    }
}
