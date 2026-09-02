package com.irlog.widget.widget.components

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.action.clickable
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

@Composable
fun WorkItemRow(
    item: WorkItemDto,
    serverUrl: String
) {
    // Open PWA or browser to the specific worklist item on click
    val pwaUrl = if (serverUrl.isNotBlank()) {
        val base = if (serverUrl.endsWith("/")) serverUrl.dropLast(1) else serverUrl
        "$base/worklist?id=${item.id}"
    } else {
        "https://irlog.app/worklist"
    }

    val openPwaIntent = Intent(Intent.ACTION_VIEW, Uri.parse(pwaUrl)).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }

    // Get exact modality colors (matching Analytics daily trends graph)
    val modalityColors = IRLogColors.getModalityColors(item.modality)

    // Status styling
    val (statusBg, statusText) = when (item.status) {
        "Done" -> Pair(IRLogColors.StatusDoneBg, IRLogColors.StatusDone)
        "NotDone" -> Pair(IRLogColors.StatusNotDoneBg, IRLogColors.StatusNotDone)
        "Cancelled" -> Pair(IRLogColors.StatusCancelledBg, IRLogColors.StatusCancelled)
        else -> Pair(IRLogColors.StatusScheduledBg, IRLogColors.StatusScheduled)
    }

    // Format Age / Sex
    val ageSexStr = buildString {
        if (item.patientAge != null) append("${item.patientAge}Y")
        if (!item.patientSex.isNullOrBlank()) {
            if (isNotEmpty()) append(" / ")
            append(item.patientSex)
        }
    }

    Box(
        modifier = GlanceModifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 3.dp)
            .background(IRLogColors.WidgetCardBg)
            .cornerRadius(12.dp)
            .clickable(actionStartActivity(openPwaIntent))
    ) {
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Time & Modality Column
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = GlanceModifier.width(58.dp)
            ) {
                // Time
                Text(
                    text = item.appointmentTime?.ifBlank { "--:--" } ?: "--:--",
                    style = TextStyle(
                        color = ColorProvider(IRLogColors.TextPrimary),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                )

                Spacer(modifier = GlanceModifier.height(4.dp))

                // Modality Chip with Analytics Graph Color
                Box(
                    modifier = GlanceModifier
                        .background(modalityColors.badgeBg)
                        .cornerRadius(6.dp)
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = item.modality.uppercase(),
                        style = TextStyle(
                            color = ColorProvider(modalityColors.badgeText),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    )
                }
            }

            Spacer(modifier = GlanceModifier.width(8.dp))

            // Patient Info & Procedure Column
            Column(
                modifier = GlanceModifier.defaultWeight()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = item.patientName,
                        style = TextStyle(
                            color = ColorProvider(IRLogColors.TextPrimary),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        ),
                        maxLines = 1
                    )

                    if (ageSexStr.isNotBlank()) {
                        Spacer(modifier = GlanceModifier.width(4.dp))
                        Text(
                            text = "($ageSexStr)",
                            style = TextStyle(
                                color = ColorProvider(IRLogColors.TextSecondary),
                                fontSize = 11.sp
                            )
                        )
                    }
                }

                Spacer(modifier = GlanceModifier.height(2.dp))

                // Procedure Name
                Text(
                    text = item.procedureName,
                    style = TextStyle(
                        color = ColorProvider(IRLogColors.TextSecondary),
                        fontSize = 11.sp
                    ),
                    maxLines = 1
                )

                if (item.patientID.isNotBlank()) {
                    Text(
                        text = "ID: ${item.patientID}",
                        style = TextStyle(
                            color = ColorProvider(IRLogColors.TextMuted),
                            fontSize = 9.sp
                        ),
                        maxLines = 1
                    )
                }
            }

            Spacer(modifier = GlanceModifier.width(6.dp))

            // Status Pill
            Box(
                modifier = GlanceModifier
                    .background(statusBg)
                    .cornerRadius(8.dp)
                    .padding(horizontal = 6.dp, vertical = 3.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = item.status,
                    style = TextStyle(
                        color = ColorProvider(statusText),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium
                    )
                )
            }
        }
    }
}
