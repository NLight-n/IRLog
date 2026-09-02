package com.irlog.widget.widget.components

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.irlog.widget.data.model.WorkItemDto
import com.irlog.widget.ui.theme.IRLogColors
import com.irlog.widget.util.PwaIntentHelper

@Composable
fun WorkItemRow(
    context: Context,
    item: WorkItemDto,
    serverUrl: String,
    isDark: Boolean = false
) {
    val theme = IRLogColors.getThemeColors(isDark)

    // Build URL directly to the specific procedure in the worklist
    val pwaUrl = if (serverUrl.isNotBlank()) {
        val base = if (serverUrl.endsWith("/")) serverUrl.dropLast(1) else serverUrl
        "$base/worklist?id=${item.id}"
    } else {
        "https://irlog.app/worklist"
    }

    // Launch installed PWA / Chrome WebAPK explicitly
    val openPwaIntent = PwaIntentHelper.createPwaOpenIntent(context, pwaUrl)

    // Modality colors (matches Analytics daily trends graph)
    val modalityColors = IRLogColors.getModalityColors(item.modality, isDark)

    // Status colors
    val statusColors = IRLogColors.getStatusColors(item.status, isDark)

    // Format Age / Sex
    val ageSexStr = buildString {
        if (item.patientAge != null) append("${item.patientAge}Y")
        if (!item.patientSex.isNullOrBlank()) {
            if (isNotEmpty()) append(" / ")
            append(item.patientSex)
        }
    }

    val hasTime = !item.appointmentTime.isNullOrBlank()
    val hasNotes = !item.notes.isNullOrBlank()

    Box(
        modifier = GlanceModifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 3.dp)
            .background(theme.cardBg)
            .cornerRadius(12.dp)
            .clickable(actionStartActivity(openPwaIntent))
    ) {
        Column(
            modifier = GlanceModifier
                .fillMaxWidth()
                .padding(10.dp)
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Left Column: Modality Chip as Main + Time only if available
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = GlanceModifier.width(54.dp)
                ) {
                    // Modality Chip (Main tag)
                    Box(
                        modifier = GlanceModifier
                            .background(modalityColors.badgeBg)
                            .cornerRadius(6.dp)
                            .padding(horizontal = 7.dp, vertical = 3.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = item.modality.uppercase(),
                            style = TextStyle(
                                color = ColorProvider(modalityColors.badgeText),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }

                    // Time field: Show ONLY if available (no '--:--')
                    if (hasTime) {
                        Spacer(modifier = GlanceModifier.height(3.dp))
                        Text(
                            text = item.appointmentTime!!,
                            style = TextStyle(
                                color = ColorProvider(theme.textSecondary),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Medium
                            )
                        )
                    }
                }

                Spacer(modifier = GlanceModifier.width(10.dp))

                // Center Column: Procedure Name (Prominent) + Patient Info
                Column(
                    modifier = GlanceModifier.defaultWeight()
                ) {
                    // Procedure Name with increased font size
                    Text(
                        text = item.procedureName,
                        style = TextStyle(
                            color = ColorProvider(theme.textPrimary),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        ),
                        maxLines = 1
                    )

                    Spacer(modifier = GlanceModifier.height(2.dp))

                    // Patient Name and Age/Sex
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = item.patientName,
                            style = TextStyle(
                                color = ColorProvider(theme.textSecondary),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            ),
                            maxLines = 1
                        )

                        if (ageSexStr.isNotBlank()) {
                            Spacer(modifier = GlanceModifier.width(4.dp))
                            Text(
                                text = "• $ageSexStr",
                                style = TextStyle(
                                    color = ColorProvider(theme.textMuted),
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }

                    if (item.patientID.isNotBlank()) {
                        Text(
                            text = "ID: ${item.patientID}",
                            style = TextStyle(
                                color = ColorProvider(theme.textMuted),
                                fontSize = 10.sp
                            ),
                            maxLines = 1
                        )
                    }
                }

                Spacer(modifier = GlanceModifier.width(6.dp))

                // Right Status Badge
                Box(
                    modifier = GlanceModifier
                        .background(statusColors.bg)
                        .cornerRadius(8.dp)
                        .padding(horizontal = 6.dp, vertical = 3.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = item.status,
                        style = TextStyle(
                            color = ColorProvider(statusColors.text),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    )
                }
            }

            // Notes Block: Show if notes content is present
            if (hasNotes) {
                Spacer(modifier = GlanceModifier.height(6.dp))
                Box(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .background(theme.notesBg)
                        .cornerRadius(6.dp)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "📝 ${item.notes}",
                        style = TextStyle(
                            color = ColorProvider(theme.notesText),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Normal
                        ),
                        maxLines = 2
                    )
                }
            }
        }
    }
}
