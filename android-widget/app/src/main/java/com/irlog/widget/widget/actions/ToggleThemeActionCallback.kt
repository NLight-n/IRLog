package com.irlog.widget.widget.actions

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.updateAll
import com.irlog.widget.data.storage.SecureTokenStorage
import com.irlog.widget.widget.IRLogWidget

class ToggleThemeActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val storage = SecureTokenStorage(context)
        storage.toggleDarkMode()
        IRLogWidget().updateAll(context)
    }
}
