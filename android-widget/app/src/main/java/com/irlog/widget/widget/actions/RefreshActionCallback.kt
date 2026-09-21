package com.irlog.widget.widget.actions

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.updateAll
import com.irlog.widget.data.api.IRLogApiService
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.widget.IRLogMediumWidget
import com.irlog.widget.widget.IRLogSmallWidget
import com.irlog.widget.widget.IRLogWidget
import com.irlog.widget.widget.MonthlyCumulativeWidget
import com.irlog.widget.widget.MonthlyTrendsWidget
import com.irlog.widget.widget.YearlyCumulativeWidget

class RefreshActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val storage = SecureTokenStorage(context)
        if (storage.isAuthenticated) {
            try {
                val apiService = IRLogApiService(storage)
                apiService.fetchTodayWorklist()
                apiService.syncAllAnalytics()
            } catch (_: Exception) {
            }
        }

        // Refresh all worklist widgets
        IRLogWidget().updateAll(context)
        IRLogSmallWidget().updateAll(context)
        IRLogMediumWidget().updateAll(context)

        // Refresh all analytics widgets
        MonthlyTrendsWidget().updateAll(context)
        MonthlyCumulativeWidget().updateAll(context)
        YearlyCumulativeWidget().updateAll(context)

        // Reset next background sync timer from this point forward
        com.irlog.widget.worker.WidgetSyncWorker.scheduleNextSync(context)
    }
}
