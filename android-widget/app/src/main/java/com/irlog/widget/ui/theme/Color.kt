package com.irlog.widget.ui.theme

import androidx.compose.ui.graphics.Color

object IRLogColors {
    val Primary = Color(0xFF2563EB)
    val PrimaryDark = Color(0xFF1D4ED8)
    val PrimaryLight = Color(0xFFDBEAFE)

    data class ThemeColors(
        val background: Color,
        val cardBg: Color,
        val cardBorder: Color,
        val textPrimary: Color,
        val textSecondary: Color,
        val textMuted: Color,
        val divider: Color,
        val notesBg: Color,
        val notesText: Color,
        val actionBg: Color,
        val badgeBg: Color,
        val badgeText: Color
    )

    val Light = ThemeColors(
        background = Color(0xFFFFFFFF),
        cardBg = Color(0xFFF8FAFC),
        cardBorder = Color(0xFFE2E8F0),
        textPrimary = Color(0xFF0F172A),
        textSecondary = Color(0xFF475569),
        textMuted = Color(0xFF94A3B8),
        divider = Color(0xFFE2E8F0),
        notesBg = Color(0xFFF1F5F9),
        notesText = Color(0xFF334155),
        actionBg = Color(0xFFF1F5F9),
        badgeBg = Color(0xFFDBEAFE),
        badgeText = Color(0xFF1D4ED8)
    )

    val Dark = ThemeColors(
        background = Color(0xFF0F172A),
        cardBg = Color(0xFF1E293B),
        cardBorder = Color(0xFF334155),
        textPrimary = Color(0xFFF8FAFC),
        textSecondary = Color(0xFF94A3B8),
        textMuted = Color(0xFF64748B),
        divider = Color(0xFF334155),
        notesBg = Color(0xFF0F172A),
        notesText = Color(0xFFCBD5E1),
        actionBg = Color(0xFF334155),
        badgeBg = Color(0xFF1E3A8A),
        badgeText = Color(0xFF93C5FD)
    )

    fun getThemeColors(isDark: Boolean): ThemeColors = if (isDark) Dark else Light

    data class ModalityColorSet(
        val badgeBg: Color,
        val badgeText: Color,
        val accent: Color
    )

    fun getModalityColors(modality: String?, isDark: Boolean = false): ModalityColorSet {
        val mod = modality?.uppercase()?.trim() ?: ""
        return if (!isDark) {
            when (mod) {
                "USG" -> ModalityColorSet(Color(0xFFDBEAFE), Color(0xFF1D4ED8), Color(0xFF3B82F6))
                "CT" -> ModalityColorSet(Color(0xFFDCFCE7), Color(0xFF15803D), Color(0xFF22C55E))
                "OT" -> ModalityColorSet(Color(0xFFFEF9C3), Color(0xFFA16207), Color(0xFFEAB308))
                "XF" -> ModalityColorSet(Color(0xFFF3E8FF), Color(0xFF7E22CE), Color(0xFFA855F7))
                "DSA" -> ModalityColorSet(Color(0xFFFEE2E2), Color(0xFFB91C1C), Color(0xFFEF4444))
                else -> ModalityColorSet(Color(0xFFF1F5F9), Color(0xFF334155), Color(0xFF64748B))
            }
        } else {
            // Dark Mode Modality Badges (High Contrast)
            when (mod) {
                "USG" -> ModalityColorSet(Color(0xFF1E3A8A), Color(0xFF93C5FD), Color(0xFF60A5FA))
                "CT" -> ModalityColorSet(Color(0xFF14532D), Color(0xFF86EFAC), Color(0xFF4ADE80))
                "OT" -> ModalityColorSet(Color(0xFF713F12), Color(0xFFFDE047), Color(0xFFFACC15))
                "XF" -> ModalityColorSet(Color(0xFF581C87), Color(0xFFD8B4FE), Color(0xFFC084FC))
                "DSA" -> ModalityColorSet(Color(0xFF7F1D1D), Color(0xFFFCA5A5), Color(0xFFF87171))
                else -> ModalityColorSet(Color(0xFF334155), Color(0xFFCBD5E1), Color(0xFF94A3B8))
            }
        }
    }

    data class StatusColorSet(
        val bg: Color,
        val text: Color
    )

    fun getStatusColors(status: String?, isDark: Boolean = false): StatusColorSet {
        return if (!isDark) {
            when (status) {
                "Done" -> StatusColorSet(Color(0xFFF0FDF4), Color(0xFF16A34A))
                "NotDone" -> StatusColorSet(Color(0xFFFEF2F2), Color(0xFFDC2626))
                "Cancelled" -> StatusColorSet(Color(0xFFF3F4F6), Color(0xFF6B7280))
                else -> StatusColorSet(Color(0xFFEFF6FF), Color(0xFF2563EB))
            }
        } else {
            when (status) {
                "Done" -> StatusColorSet(Color(0xFF14532D), Color(0xFF86EFAC))
                "NotDone" -> StatusColorSet(Color(0xFF7F1D1D), Color(0xFFFCA5A5))
                "Cancelled" -> StatusColorSet(Color(0xFF334155), Color(0xFF94A3B8))
                else -> StatusColorSet(Color(0xFF1E3A8A), Color(0xFF93C5FD))
            }
        }
    }
}
