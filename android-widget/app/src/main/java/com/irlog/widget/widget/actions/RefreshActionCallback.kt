package com.irlog.widget.widget.actions

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.updateAll
import com.irlog.widget.data.api.IRLogApiService
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.widget.IRLogWidget

class RefreshActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val storage = SecureTokenStorage(context)
        if (storage.isAuthenticated) {
            val apiService = IRLogApiService(storage)
            apiService.fetchTodayWorklist()
        }
        IRLogWidget().updateAll(context)
    }
}
