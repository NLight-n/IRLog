package com.irlog.widget.widget.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
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
import com.irlog.widget.ui.PwaLauncherActivity
import com.irlog.widget.ui.theme.IRLogColors

@Composable
fun WorkItemRow(
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

    val targetUrlKey = ActionParameters.Key<String>(com.irlog.widget.ui.IRLogTwaLauncherActivity.EXTRA_TARGET_URL)

    // Modality colors (clean, consistent for all modalities)
    val modalityColors = IRLogColors.getModalityColors(isDark)

    // Status colors & border (replicates worklist page card styling)
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

    // Outer Box: Card Border
    Box(
        modifier = GlanceModifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 3.dp)
            .background(statusColors.border)
            .cornerRadius(12.dp)
            .padding(1.dp) // Reliable 1dp border thickness
            .clickable(
                actionStartActivity<com.irlog.widget.ui.IRLogTwaLauncherActivity>(
                    actionParametersOf(targetUrlKey to pwaUrl)
                )
            )
    ) {
        // Inner Box: Card Background (covers the outer box except for the 1dp padding)
        Box(
            modifier = GlanceModifier
                .fillMaxWidth()
                .background(theme.cardBg)
                .cornerRadius(11.dp) // Radius - BorderThickness
                .padding(horizontal = 10.dp, vertical = 8.dp)
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Left Column: Modality Tag (Main) + Time (only if available)
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = GlanceModifier.width(52.dp)
                ) {
                    // Modality Chip
                    Box(
                        modifier = GlanceModifier
                            .background(modalityColors.badgeBg)
                            .cornerRadius(6.dp)
                            .padding(horizontal = 6.dp, vertical = 3.dp),
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

                    // Time: Shown ONLY when available (no --:--)
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

                // Center Column: Patient Name first (normal), Procedure Name second (bold), Notes third (aligned)
                Column(
                    modifier = GlanceModifier.defaultWeight()
                ) {
                    // 1. Patient Name (Normal/Medium) + Age/Sex
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = item.patientName,
                            style = TextStyle(
                                color = ColorProvider(theme.textPrimary),
                                fontSize = 13.sp,
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

                    // Patient ID
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

                    Spacer(modifier = GlanceModifier.height(2.dp))

                    // 2. Procedure Name (Bold)
                    Text(
                        text = item.procedureName,
                        style = TextStyle(
                            color = ColorProvider(theme.textPrimary),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        ),
                        maxLines = 1
                    )

                    // 3. Notes Content: Seamlessly aligned in level with text (no different background box)
                    if (hasNotes) {
                        Spacer(modifier = GlanceModifier.height(3.dp))
                        Text(
                            text = "📝 ${item.notes}",
                            style = TextStyle(
                                color = ColorProvider(theme.textSecondary),
                                fontSize = 11.sp
                            ),
                            maxLines = 2
                        )
                    }
                }

                Spacer(modifier = GlanceModifier.width(6.dp))

                // Right Status Badge
                Box(
                    modifier = GlanceModifier
                        .background(statusColors.bg)
                        .cornerRadius(6.dp)
                        .padding(horizontal = 6.dp, vertical = 3.dp),
                    contentAlignment = Alignment.Center
                ) {
                    val statusLabel = when (item.status) {
                        "NotDone" -> "Not Done"
                        else -> item.status
                    }
                    Text(
                        text = statusLabel,
                        style = TextStyle(
                            color = ColorProvider(statusColors.text),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold
                        )
                    )
                }
            }
        }
    }
}
