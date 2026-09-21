package com.irlog.widget

import android.app.Application
import android.content.Intent
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.work.WorkManager
import com.irlog.widget.ui.SettingsActivity
import com.irlog.widget.worker.WidgetSyncWorker

class IRLogApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        setupPeriodicWidgetSync()
        setupAppShortcuts()
    }

    private fun setupPeriodicWidgetSync() {
        // Cancel legacy periodic work if previously enqueued
        WorkManager.getInstance(this).cancelUniqueWork(WidgetSyncWorker.WORK_NAME)

        // Start dynamic smart-interval sync (15 min work hours / 60 min off hours)
        WidgetSyncWorker.scheduleNextSync(this, isInitial = false)
    }

    private fun setupAppShortcuts() {
        try {
            val shortcut = ShortcutInfoCompat.Builder(this, "widget_settings")
                .setShortLabel(getString(R.string.shortcut_settings_short))
                .setLongLabel(getString(R.string.shortcut_settings_long))
                .setIcon(IconCompat.createWithResource(this, R.drawable.ic_settings))
                .setIntent(
                    Intent(this, SettingsActivity::class.java).apply {
                        action = Intent.ACTION_VIEW
                    }
                )
                .build()
            ShortcutManagerCompat.setDynamicShortcuts(this, listOf(shortcut))
        } catch (_: Exception) {
            // Ignore if launcher doesn't support shortcuts
        }
    }
}
