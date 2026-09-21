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
        val actionBg: Color,
        val badgeBg: Color,
        val badgeText: Color
    )

    val Light = ThemeColors(
        background = Color(0xFFFFFFFF),
        cardBg = Color(0xFFFFFFFF),
        cardBorder = Color(0xFFE2E8F0),
        textPrimary = Color(0xFF0F172A),
        textSecondary = Color(0xFF475569),
        textMuted = Color(0xFF94A3B8),
        divider = Color(0xFFE2E8F0),
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
        actionBg = Color(0xFF334155),
        badgeBg = Color(0xFF1E3A8A),
        badgeText = Color(0xFF93C5FD)
    )

    fun getThemeColors(isDark: Boolean): ThemeColors = if (isDark) Dark else Light

    data class ModalityColorSet(
        val badgeBg: Color,
        val badgeText: Color
    )

    // Unified neutral tag for all modalities
    fun getModalityColors(isDark: Boolean = false): ModalityColorSet {
        return if (!isDark) {
            ModalityColorSet(
                badgeBg = Color(0xFFF1F5F9),
                badgeText = Color(0xFF334155)
            )
        } else {
            ModalityColorSet(
                badgeBg = Color(0xFF334155),
                badgeText = Color(0xFFF1F5F9)
            )
        }
    }

    data class StatusColorSet(
        val bg: Color,
        val text: Color,
        val border: Color
    )

    fun getStatusColors(status: String?, isDark: Boolean = false): StatusColorSet {
        return if (!isDark) {
            when (status) {
                "Done" -> StatusColorSet(Color(0xFFDCFCE7), Color(0xFF15803D), Color(0xFF22C55E))
                "NotDone" -> StatusColorSet(Color(0xFFFEF3C7), Color(0xFF92400E), Color(0xFFF59E0B))
                "Cancelled" -> StatusColorSet(Color(0xFFFEE2E2), Color(0xFFB91C1C), Color(0xFFEF4444))
                else -> StatusColorSet(Color(0xFFEFF6FF), Color(0xFF1E40AF), Color(0xFF3B82F6))
            }
        } else {
            when (status) {
                "Done" -> StatusColorSet(Color(0xFF14532D), Color(0xFF86EFAC), Color(0xFF22C55E))
                "NotDone" -> StatusColorSet(Color(0xFF78350F), Color(0xFFFDE047), Color(0xFFF59E0B))
                "Cancelled" -> StatusColorSet(Color(0xFF7F1D1D), Color(0xFFFCA5A5), Color(0xFFEF4444))
                else -> StatusColorSet(Color(0xFF1E3A8A), Color(0xFF93C5FD), Color(0xFF60A5FA))
            }
        }
    }
}
