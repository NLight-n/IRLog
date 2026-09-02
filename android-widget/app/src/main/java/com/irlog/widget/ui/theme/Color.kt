package com.irlog.widget.ui.theme

import androidx.compose.ui.graphics.Color

object IRLogColors {
    val Primary = Color(0xFF2563EB)
    val PrimaryDark = Color(0xFF1D4ED8)
    val PrimaryLight = Color(0xFFDBEAFE)

    // Modality Colors (Matches IRLog Analytics Daily Trends Graph)
    val ModalityUSG = Color(0xFF3B82F6)
    val ModalityUSGBg = Color(0xFFDBEAFE)
    val ModalityUSGText = Color(0xFF1D4ED8)

    val ModalityCT = Color(0xFF22C55E)
    val ModalityCTBg = Color(0xFFDCFCE7)
    val ModalityCTText = Color(0xFF15803D)

    val ModalityOT = Color(0xFFEAB308)
    val ModalityOTBg = Color(0xFFFEF9C3)
    val ModalityOTText = Color(0xFFA16207)

    val ModalityXF = Color(0xFFA855F7)
    val ModalityXFBg = Color(0xFFF3E8FF)
    val ModalityXFText = Color(0xFF7E22CE)

    val ModalityDSA = Color(0xFFEF4444)
    val ModalityDSABg = Color(0xFFFEE2E2)
    val ModalityDSAText = Color(0xFFB91C1C)

    val ModalityOther = Color(0xFF64748B)
    val ModalityOtherBg = Color(0xFFF1F5F9)
    val ModalityOtherText = Color(0xFF334155)

    // Status Colors
    val StatusScheduled = Color(0xFF2563EB)
    val StatusScheduledBg = Color(0xFFEFF6FF)
    val StatusDone = Color(0xFF16A34A)
    val StatusDoneBg = Color(0xFFF0FDF4)
    val StatusNotDone = Color(0xFFDC2626)
    val StatusNotDoneBg = Color(0xFFFEF2F2)
    val StatusCancelled = Color(0xFF6B7280)
    val StatusCancelledBg = Color(0xFFF3F4F6)

    // Widget Surfaces & Text
    val WidgetBackground = Color(0xFFFFFFFF)
    val WidgetCardBg = Color(0xFFF8FAFC)
    val WidgetCardBorder = Color(0xFFE2E8F0)
    val TextPrimary = Color(0xFF0F172A)
    val TextSecondary = Color(0xFF64748B)
    val TextMuted = Color(0xFF94A3B8)
    val Divider = Color(0xFFE2E8F0)

    data class ModalityColorSet(
        val badgeBg: Color,
        val badgeText: Color,
        val accent: Color
    )

    fun getModalityColors(modality: String?): ModalityColorSet {
        return when (modality?.uppercase()?.trim()) {
            "USG" -> ModalityColorSet(ModalityUSGBg, ModalityUSGText, ModalityUSG)
            "CT" -> ModalityColorSet(ModalityCTBg, ModalityCTText, ModalityCT)
            "OT" -> ModalityColorSet(ModalityOTBg, ModalityOTText, ModalityOT)
            "XF" -> ModalityColorSet(ModalityXFBg, ModalityXFText, ModalityXF)
            "DSA" -> ModalityColorSet(ModalityDSABg, ModalityDSAText, ModalityDSA)
            else -> ModalityColorSet(ModalityOtherBg, ModalityOtherText, ModalityOther)
        }
    }
}
